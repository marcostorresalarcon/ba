import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NotificationCenterComponent } from './shared/ui/notification-center/notification-center.component';
import { LoadingOverlayComponent } from './shared/ui/loading-overlay/loading-overlay.component';
import { BackButtonService } from './core/services/navigation/back-button.service';
import { MediaPreviewService } from './core/services/media-preview/media-preview.service';
import { MediaPreviewPage } from './pages/media-preview/media-preview.page';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NotificationCenterComponent, LoadingOverlayComponent, MediaPreviewPage],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly backButtonService = inject(BackButtonService);
  protected readonly mediaPreview = inject(MediaPreviewService);

  ngOnInit(): void {
    // Inicializar el manejo del botón de atrás
    this.backButtonService.initialize();
  }
}
