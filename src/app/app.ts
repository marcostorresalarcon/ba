import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NotificationCenterComponent } from './shared/ui/notification-center/notification-center.component';
import { BackButtonService } from './core/services/navigation/back-button.service';
import { DrawingCanvasService } from './core/services/drawing-canvas/drawing-canvas.service';
import { DrawingCanvasComponent } from './shared/ui/drawing-canvas/drawing-canvas.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NotificationCenterComponent, DrawingCanvasComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {
  private readonly backButtonService = inject(BackButtonService);
  protected readonly drawingCanvasService = inject(DrawingCanvasService);

  ngOnInit(): void {
    // Inicializar el manejo del botón de atrás
    this.backButtonService.initialize();
  }

  protected async onCanvasSave(dataUrl: string): Promise<void> {
    await this.drawingCanvasService.handleSave(dataUrl);
  }

  protected onCanvasCancel(): void {
    this.drawingCanvasService.closeCanvas();
  }
}
