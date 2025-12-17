import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private readonly loadingCount = signal<number>(0);
  readonly isLoading = signal<boolean>(false);

  /**
   * Inicia el loading
   */
  start(): void {
    this.loadingCount.update(count => {
      const newCount = count + 1;
      this.isLoading.set(newCount > 0);
      return newCount;
    });
  }

  /**
   * Detiene el loading
   */
  stop(): void {
    this.loadingCount.update(count => {
      const newCount = Math.max(0, count - 1);
      this.isLoading.set(newCount > 0);
      return newCount;
    });
  }

  /**
   * Resetea el loading (útil para casos de error)
   */
  reset(): void {
    this.loadingCount.set(0);
    this.isLoading.set(false);
  }
}

