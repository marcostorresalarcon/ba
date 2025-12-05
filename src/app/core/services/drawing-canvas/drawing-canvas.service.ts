import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

type SaveCallback = (dataUrl: string) => void | Promise<void>;

@Injectable({
  providedIn: 'root'
})
export class DrawingCanvasService {
  private saveCallback: SaveCallback | null = null;

  constructor(private readonly router: Router) {}

  /**
   * Navega a la página de drawing canvas
   * @param returnUrl URL a la que regresar después de guardar o cancelar
   * @param saveCallback Callback opcional para procesar el resultado
   */
  openCanvas(returnUrl: string, saveCallback?: SaveCallback): void {
    console.log('[DrawingCanvasService] openCanvas - Iniciando');
    console.log('[DrawingCanvasService] openCanvas - returnUrl:', returnUrl);
    console.log('[DrawingCanvasService] openCanvas - saveCallback existe:', !!saveCallback);
    
    // Guardar el callback antes de navegar
    this.saveCallback = saveCallback ?? null;
    
    // Guardar la posición de scroll actual (sobrescribir el anterior si existe)
    const scrollY = window.scrollY;
    console.log('[DrawingCanvasService] openCanvas - Guardando scrollY:', scrollY);
    sessionStorage.setItem('drawingCanvasScrollY', scrollY.toString());
    
    // Guardar el callback en sessionStorage para recuperarlo después
    if (saveCallback) {
      sessionStorage.setItem('drawingCanvasCallback', 'true');
      console.log('[DrawingCanvasService] openCanvas - Callback guardado en sessionStorage');
    } else {
      sessionStorage.removeItem('drawingCanvasCallback');
      console.log('[DrawingCanvasService] openCanvas - Callback removido de sessionStorage');
    }
    
    // Navegar a la página de drawing canvas con el returnUrl
    console.log('[DrawingCanvasService] openCanvas - Navegando a /drawing-canvas');
    void this.router.navigate(['/drawing-canvas'], {
      queryParams: {
        returnUrl: returnUrl,
        callback: saveCallback ? 'true' : null
      }
    });
  }

  /**
   * Procesa el resultado del canvas cuando se regresa de la página
   * Debe ser llamado desde el componente que navegó al canvas
   */
  async processResult(): Promise<void> {
    console.log('[DrawingCanvasService] processResult - Iniciando');
    const resultStr = sessionStorage.getItem('drawingCanvasResult');
    console.log('[DrawingCanvasService] processResult - resultStr existe:', !!resultStr);
    
    if (!resultStr) {
      console.log('[DrawingCanvasService] processResult - No hay resultado, restaurando scroll');
      // Aún así restaurar scroll si no hay resultado
      this.restoreScrollPosition();
      return;
    }

    const result = JSON.parse(resultStr);
    const hasCallback = sessionStorage.getItem('drawingCanvasCallback') === 'true';
    console.log('[DrawingCanvasService] processResult - result.action:', result.action);
    console.log('[DrawingCanvasService] processResult - result.dataUrl existe:', !!result.dataUrl);
    console.log('[DrawingCanvasService] processResult - hasCallback:', hasCallback);
    console.log('[DrawingCanvasService] processResult - this.saveCallback existe:', !!this.saveCallback);
    
    // No eliminar el resultado todavía, el componente lo hará después de procesarlo
    // sessionStorage.removeItem('drawingCanvasResult');
    // sessionStorage.removeItem('drawingCanvasCallback');

    if (result.action === 'save' && result.dataUrl) {
      // Ejecutar el callback si existe
      if (this.saveCallback) {
        console.log('[DrawingCanvasService] processResult - Ejecutando callback');
        try {
          await this.saveCallback(result.dataUrl);
          console.log('[DrawingCanvasService] processResult - Callback ejecutado exitosamente');
          this.saveCallback = null;
          
          // Limpiar el resultado después de procesarlo exitosamente
          sessionStorage.removeItem('drawingCanvasResult');
          sessionStorage.removeItem('drawingCanvasCallback');
          console.log('[DrawingCanvasService] processResult - Resultado limpiado de sessionStorage');
          
          // Esperar un poco para que el DOM se actualice con el nuevo sketch
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error('[DrawingCanvasService] processResult - Error executing save callback:', error);
          // No limpiar el resultado en caso de error para que se pueda reintentar
        }
      } else if (hasCallback) {
        // Si hay callback marcado pero no está disponible, puede ser que el servicio se reinició
        // En este caso, el componente debería manejar el resultado directamente
        console.warn('[DrawingCanvasService] processResult - Save callback was expected but not available. The component should handle the result directly.');
        // No limpiar el resultado, dejar que el componente lo maneje
      } else {
        console.log('[DrawingCanvasService] processResult - No hay callback disponible');
      }
    } else if (result.action === 'cancel') {
      console.log('[DrawingCanvasService] processResult - Acción cancelada');
      // Limpiar callback y resultado en caso de cancelación
      this.saveCallback = null;
      sessionStorage.removeItem('drawingCanvasResult');
      sessionStorage.removeItem('drawingCanvasCallback');
    }

    // Restaurar posición de scroll después de procesar el resultado y actualizar el DOM
    console.log('[DrawingCanvasService] processResult - Restaurando scroll');
    this.restoreScrollPosition();
  }

  /**
   * Restaura la posición de scroll guardada
   */
  private restoreScrollPosition(): void {
    const scrollYStr = sessionStorage.getItem('drawingCanvasScrollY');
    console.log('[DrawingCanvasService] restoreScrollPosition - scrollYStr:', scrollYStr);
    
    if (!scrollYStr) {
      console.log('[DrawingCanvasService] restoreScrollPosition - No hay scrollY guardado');
      return;
    }

    const scrollY = parseInt(scrollYStr, 10);
    console.log('[DrawingCanvasService] restoreScrollPosition - scrollY parseado:', scrollY);
    console.log('[DrawingCanvasService] restoreScrollPosition - scrollY actual de window:', window.scrollY);
    
    // NO eliminar el scrollY del sessionStorage aquí, se eliminará cuando se abra el canvas de nuevo
    // Esto permite que funcione en múltiples navegaciones
    
    // Esperar a que el DOM esté completamente renderizado antes de restaurar el scroll
    setTimeout(() => {
      console.log('[DrawingCanvasService] restoreScrollPosition - Intentando restaurar scroll a:', scrollY);
      // Usar requestAnimationFrame para asegurar que el DOM esté renderizado
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'smooth' });
        console.log('[DrawingCanvasService] restoreScrollPosition - Primer scrollTo ejecutado, scrollY actual:', window.scrollY);
        
        // Segundo intento después de un pequeño delay para asegurar que funcione
        // incluso si el router intenta restaurar el scroll
        setTimeout(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: scrollY, behavior: 'smooth' });
            console.log('[DrawingCanvasService] restoreScrollPosition - Segundo scrollTo ejecutado, scrollY actual:', window.scrollY);
            // Limpiar el scrollY solo después de restaurarlo exitosamente
            sessionStorage.removeItem('drawingCanvasScrollY');
            console.log('[DrawingCanvasService] restoreScrollPosition - scrollY eliminado de sessionStorage');
          });
        }, 200);
      });
    }, 300);
  }

  /**
   * Verifica si hay un resultado pendiente del canvas
   */
  hasPendingResult(): boolean {
    return sessionStorage.getItem('drawingCanvasResult') !== null;
  }
}
