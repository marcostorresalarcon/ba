import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { MediaPreviewService } from '../../core/services/media-preview/media-preview.service';

@Component({
  selector: 'app-media-preview-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-preview.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      height: 100dvh !important;
      z-index: 2147483647 !important;
      background-color: #1a1a1a; /* Charcoal background for the overlay */
    }

    /* Video a pantalla completa: resolución nativa, sin escalado que degrade calidad */
    .media-preview-video {
      width: 100%;
      max-width: 100%;
      height: auto;
      min-height: 200px;
      max-height: calc(100vh - 140px);
      max-height: calc(100dvh - 140px);
      object-fit: contain;
      background: #000;
    }
  `]
})
export class MediaPreviewPage implements OnInit {
  private readonly mediaPreview = inject(MediaPreviewService);

  protected readonly url = this.mediaPreview.url;
  protected readonly type = this.mediaPreview.type;

  protected readonly fileName = computed(() => {
    const u = this.url();
    if (!u) return '';
    try {
      const parts = u.split('/');
      return decodeURIComponent(parts[parts.length - 1]?.split('?')[0] ?? 'Media');
    } catch {
      return 'Media';
    }
  });

  ngOnInit(): void {
    // Si no hay URL al inicializar, cerramos (seguridad)
    /*
    if (!this.mediaPreview.url()) {
      this.handleClose();
    }
    */
  }

  protected getMediaType(): 'image' | 'video' {
    const t = this.type();
    if (t !== 'auto') return t;

    const u = this.url();
    if (!u) return 'image';
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(u)) return 'image';
    if (/\.(mp4|mov|avi|mkv|webm)$/i.test(u)) return 'video';
    return 'image';
  }

  protected handleClose(): void {
    this.mediaPreview.close();
  }
}
