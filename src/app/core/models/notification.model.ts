export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastPayload {
  title: string;
  message?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface Toast extends ToastPayload {
  id: number;
  variant: ToastVariant;
  durationMs: number;
}


