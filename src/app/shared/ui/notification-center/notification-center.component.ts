import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NotificationService } from '../../../core/services/notification/notification.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-center.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationCenterComponent {
  private readonly notifications = inject(NotificationService);

  protected readonly toasts = this.notifications.toasts;

  protected dismiss(id: number): void {
    this.notifications.dismiss(id);
  }

  protected iconPath(variant: 'success' | 'error' | 'info'): string {
    switch (variant) {
      case 'success':
        return 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'error':
        return 'M12 8v4m0 4h.01M4.5 12a7.5 7.5 0 1115 0 7.5 7.5 0 01-15 0z';
      default:
        return 'M11.25 9.75h.008v.008H11.25V9.75zm0 2.25h.008v3H11.25v-3zM12 21a9 9 0 100-18 9 9 0 000 18z';
    }
  }
}


