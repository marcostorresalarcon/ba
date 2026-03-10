export interface Toast {
  id: number;
  variant: 'success' | 'error' | 'info';
  durationMs: number;
  title: string;
  message?: string;
}

export interface ToastPayload {
  title: string;
  message?: string;
  variant?: 'success' | 'error' | 'info';
  durationMs?: number;
}

export type NotificationType =
  | 'quote_sent'
  | 'quote_changes_requested'
  | 'appointment'
  | 'appointment_confirmed'
  | 'payment_enabled'
  | 'project_update'
  | 'generic';

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  read: boolean;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}
