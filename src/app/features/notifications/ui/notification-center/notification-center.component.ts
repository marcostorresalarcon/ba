import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import type { Notification } from '../../../../core/models/notification.model';
import { NotificationApiService } from '../../../../core/services/notification/notification-api.service';
import { HttpErrorService } from '../../../../core/services/error/http-error.service';
import { NotificationService } from '../../../../core/services/notification/notification.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-center.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationCenterComponent {
  private readonly api = inject(NotificationApiService);
  private readonly errorService = inject(HttpErrorService);
  private readonly toastService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly notifications = signal<Notification[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isOpen = signal(false);
  protected readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);
  protected readonly hasUnread = computed(() => this.unreadCount() > 0);

  constructor() {
    this.load(); // Cargar al montar para el badge de no leídas
    effect(() => {
      if (this.isOpen()) this.load();
    });
  }

  protected toggle(): void {
    this.isOpen.update((v) => !v);
  }

  protected load(): void {
    this.isLoading.set(true);
    this.api
      .getMyNotifications({ limit: 20 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (list) => this.notifications.set(list),
        error: (err: unknown) => {
          const msg = this.errorService.handle(err);
          this.toastService.error('Error loading notifications', msg);
        }
      });
  }

  protected markAsRead(n: Notification): void {
    if (n.read) return;
    this.api
      .markAsRead(n._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.notifications.update((list) =>
            list.map((item) => (item._id === n._id ? updated : item))
          );
        }
      });
  }

  protected markAllAsRead(): void {
    this.api
      .markAllAsRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.update((list) =>
            list.map((item) => ({ ...item, read: true }))
          );
        }
      });
  }

  protected typeLabel(type: string): string {
    const labels: Record<string, string> = {
      quote_sent: 'Quote ready',
      quote_changes_requested: 'Changes requested',
      appointment: 'Appointment',
      appointment_confirmed: 'Appointment confirmed',
      payment_enabled: 'Payment enabled',
      project_update: 'Project update',
      generic: 'Notification'
    };
    return labels[type] ?? type;
  }

  protected getIcon(type: string): string {
    switch (type) {
      case 'quote_sent':
      case 'quote_changes_requested':
        return `<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />`;
      case 'appointment':
      case 'appointment_confirmed':
        return `<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />`;
      case 'payment_enabled':
        return `<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`;
      case 'project_update':
        return `<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`;
      default:
        return `<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />`;
    }
  }

  protected formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
