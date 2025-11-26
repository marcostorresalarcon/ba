import { inject, Injectable, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Subject, filter, takeUntil } from 'rxjs';

/**
 * Servicio para manejar el botón de atrás nativo en Android e iOS
 * Previene que la aplicación se cierre cuando se presiona el botón de atrás
 * y en su lugar navega hacia atrás en el historial de Angular Router
 */
@Injectable({
  providedIn: 'root'
})
export class BackButtonService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroy$ = new Subject<void>();
  private readonly isNative = Capacitor.isNativePlatform();
  
  private navigationHistory: string[] = [];
  private isInitialized = false;

  /**
   * Inicializa el servicio y comienza a escuchar el botón de atrás
   */
  initialize(): void {
    if (this.isInitialized || !this.isNative) {
      return;
    }

    this.isInitialized = true;

    // Agregar la URL inicial al historial
    const initialUrl = this.router.url;
    if (initialUrl) {
      this.navigationHistory.push(initialUrl);
    }

    // Rastrear el historial de navegación
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          // Agregar la URL al historial (evitar duplicados consecutivos)
          const currentUrl = event.urlAfterRedirects;
          const lastUrl = this.navigationHistory[this.navigationHistory.length - 1];
          
          if (currentUrl !== lastUrl) {
            this.navigationHistory.push(currentUrl);
            
            // Limitar el tamaño del historial para evitar problemas de memoria
            if (this.navigationHistory.length > 50) {
              this.navigationHistory.shift();
            }
          }
        }
      });

    // Escuchar el botón de atrás nativo (principalmente Android)
    // En iOS, el gesto de deslizamiento se maneja automáticamente por el sistema
    App.addListener('backButton', () => {
      this.handleBackButton();
    });
  }

  /**
   * Maneja el evento del botón de atrás
   */
  private handleBackButton(): void {
    const currentUrl = this.router.url;
    
    // Verificar si hay historial de navegación
    if (this.navigationHistory.length > 1) {
      // Remover la URL actual del historial
      this.navigationHistory.pop();
      
      // Obtener la URL anterior
      const previousUrl = this.navigationHistory[this.navigationHistory.length - 1];
      
      // Si la URL anterior es diferente a la actual, navegar a ella
      if (previousUrl && previousUrl !== currentUrl) {
        void this.router.navigateByUrl(previousUrl, { replaceUrl: false });
      } else {
        // Si no hay URL anterior válida, intentar usar Location.back()
        // Esto puede funcionar si el navegador tiene historial
        try {
          this.location.back();
        } catch (error) {
          console.warn('Could not navigate back:', error);
          // Fallback: navegar a la ruta raíz
          void this.router.navigate(['/']);
        }
      }
    } else {
      // Si no hay historial suficiente, verificar si estamos en la ruta raíz o login
      if (currentUrl === '/' || currentUrl === '/login') {
        // Si ya estamos en la raíz/login, minimizar la app en lugar de cerrarla
        // Esto es más amigable para el usuario en Android
        App.minimizeApp().catch((error) => {
          console.warn('Could not minimize app:', error);
        });
      } else {
        // Si estamos en otra ruta, navegar a la raíz
        void this.router.navigate(['/']);
      }
    }
  }

  /**
   * Limpia el historial de navegación
   */
  clearHistory(): void {
    this.navigationHistory = [];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Remover el listener del botón de atrás
    if (this.isInitialized && this.isNative) {
      App.removeAllListeners().catch((error) => {
        console.warn('Error removing app listeners:', error);
      });
    }
  }
}

