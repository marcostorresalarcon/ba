import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HttpErrorService {
  private readonly lastMessage = signal<string | null>(null);

  readonly message = this.lastMessage.asReadonly();

  handle(error: unknown): string {
    const message = this.extractMessage(error);
    this.lastMessage.set(message);
    console.error('[HTTP Error]', error);
    return message;
  }

  extractMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (this.isApiMessage(error.error)) {
        return error.error.message;
      }

      if (typeof error.error === 'string') {
        return error.error;
      }

      return error.message || 'Unexpected server error';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unexpected error';
  }

  private isApiMessage(payload: unknown): payload is { message: string } {
    return typeof payload === 'object' && payload !== null && 'message' in payload;
  }
}


