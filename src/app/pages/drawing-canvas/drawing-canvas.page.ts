import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DrawingCanvasComponent } from '../../shared/ui/drawing-canvas/drawing-canvas.component';
import { LayoutService } from '../../core/services/layout/layout.service';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-drawing-canvas-page',
  standalone: true,
  imports: [CommonModule, DrawingCanvasComponent],
  template: `
    <div class="h-screen w-full flex flex-col bg-white overflow-hidden">
      <app-drawing-canvas (save)="onSave($event)" (cancel)="onCancel()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawingCanvasPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);

  protected readonly breadcrumbs: LayoutBreadcrumb[] = [{ label: 'Drawing Canvas' }];

  constructor() {
    this.layoutService.setBreadcrumbs(this.breadcrumbs);
  }

  protected async onSave(dataUrl: string): Promise<void> {
    console.log('[DrawingCanvasPage] onSave - Iniciando guardado');
    console.log('[DrawingCanvasPage] onSave - dataUrl recibido:', dataUrl.substring(0, 50) + '...');
    
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    const callback = this.route.snapshot.queryParamMap.get('callback');
    console.log('[DrawingCanvasPage] onSave - returnUrl:', returnUrl);
    console.log('[DrawingCanvasPage] onSave - callback:', callback);
    
    // Guardar el dataUrl en sessionStorage para que el componente que lo llamó pueda recuperarlo
    if (callback) {
      const result = { dataUrl, action: 'save' };
      console.log('[DrawingCanvasPage] onSave - Guardando resultado en sessionStorage');
      sessionStorage.setItem('drawingCanvasResult', JSON.stringify(result));
      
      // Verificar que se guardó
      const saved = sessionStorage.getItem('drawingCanvasResult');
      console.log('[DrawingCanvasPage] onSave - Verificación: resultado guardado:', !!saved);
    } else {
      console.warn('[DrawingCanvasPage] onSave - No hay callback, no se guardará el resultado');
    }
    
    console.log('[DrawingCanvasPage] onSave - Navegando a:', returnUrl);
    await this.router.navigateByUrl(returnUrl);
  }

  protected onCancel(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    const callback = this.route.snapshot.queryParamMap.get('callback');
    
    // Notificar cancelación
    if (callback) {
      sessionStorage.setItem('drawingCanvasResult', JSON.stringify({ action: 'cancel' }));
    }
    
    void this.router.navigateByUrl(returnUrl);
  }
}


