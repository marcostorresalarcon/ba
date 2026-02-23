import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { MediaPreviewService } from '../../core/services/media-preview/media-preview.service';

@Component({
  selector: 'app-media-preview-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-preview.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MediaPreviewPage implements OnInit {
  private readonly mediaPreview = inject(MediaPreviewService);
  private readonly location = inject(Location);

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
    if (!this.mediaPreview.url()) {
      this.goBack();
    }
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

  protected goBack(): void {
    this.mediaPreview.clear();
    this.location.back();
  }
}
