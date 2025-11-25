import { Injectable, signal } from '@angular/core';

import type { Toast, ToastPayload } from '../../models/notification.model';

const DEFAULT_DURATION = 4500;

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly toastsSignal = signal<Toast[]>([]);
  private readonly timers = new Map<number, number>();
  private counter = 0;

  readonly toasts = this.toastsSignal.asReadonly();

  show(payload: ToastPayload): number {
    const id = ++this.counter;
    const toast: Toast = {
      id,
      variant: payload.variant ?? 'info',
      durationMs: payload.durationMs ?? DEFAULT_DURATION,
      title: payload.title,
      message: payload.message
    };

    this.toastsSignal.update((current) => [...current, toast]);

    if (toast.durationMs > 0) {
      const timer = window.setTimeout(() => this.dismiss(id), toast.durationMs);
      this.timers.set(id, timer);
    }

    return id;
  }

  success(title: string, message?: string, durationMs?: number): number {
    return this.show({ title, message, durationMs, variant: 'success' });
  }

  error(title: string, message?: string, durationMs?: number): number {
    return this.show({ title, message, durationMs, variant: 'error' });
  }

  info(title: string, message?: string, durationMs?: number): number {
    return this.show({ title, message, durationMs, variant: 'info' });
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.toastsSignal.update((current) => current.filter((toast) => toast.id !== id));
  }
}


