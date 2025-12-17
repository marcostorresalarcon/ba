import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../core/services/loading/loading.service';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loadingService.isLoading()) {
      <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-charcoal/20 backdrop-blur-sm transition-opacity duration-200">
        <div class="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-lg">
          <!-- Spinner -->
          <svg class="h-8 w-8 animate-spin text-pine" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <!-- Text -->
          <p class="text-sm font-medium text-charcoal">Loading...</p>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      pointer-events: none;
    }
    
    :host > div {
      pointer-events: auto;
    }
  `]
})
export class LoadingOverlayComponent {
  readonly loadingService = inject(LoadingService);
}

