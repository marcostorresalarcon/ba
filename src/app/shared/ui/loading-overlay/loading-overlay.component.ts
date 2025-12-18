import { Component, inject, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../core/services/loading/loading.service';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loadingService.isLoading()) {
      <div 
        class="fixed left-0 right-0 z-[9999] flex items-center justify-center bg-charcoal/20 backdrop-blur-sm transition-opacity duration-200"
        [style.top.px]="scrollTop()"
        [style.height.px]="viewportHeight()"
      >
        <div class="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-lg">
          <!-- Spinner -->
          <svg class="h-10 w-10 animate-spin text-pine" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <!-- Text -->
          <p class="text-base font-semibold text-charcoal">Loading...</p>
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
export class LoadingOverlayComponent implements OnDestroy {
  readonly loadingService = inject(LoadingService);
  
  protected readonly scrollTop = signal(0);
  protected readonly viewportHeight = signal(window.innerHeight);
  
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;

  constructor() {
    // Actualizar posición cuando cambia el scroll
    this.scrollHandler = () => {
      this.scrollTop.set(window.scrollY);
    };
    
    // Actualizar altura del viewport cuando cambia el tamaño de la ventana
    this.resizeHandler = () => {
      this.viewportHeight.set(window.innerHeight);
    };
    
    // Inicializar valores
    this.scrollTop.set(window.scrollY);
    this.viewportHeight.set(window.innerHeight);
    
    // Agregar listeners
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler, { passive: true });
    
    // Actualizar posición cuando el loader se activa
    effect(() => {
      if (this.loadingService.isLoading()) {
        // Actualizar posición al activarse el loader
        this.scrollTop.set(window.scrollY);
        this.viewportHeight.set(window.innerHeight);
      }
    });
  }
  
  ngOnDestroy(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }
}

