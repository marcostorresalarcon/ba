import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, signal, effect, DestroyRef, inject } from '@angular/core';

@Component({
  selector: 'app-media-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-preview-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MediaPreviewModalComponent {
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) url!: string;
  @Input() type: 'image' | 'video' | 'auto' = 'auto';
  @Input() alt: string = 'Media preview';
  @Output() close = new EventEmitter<void>();

  protected readonly isOpen = signal(true);

  constructor() {
    // Cerrar con Escape
    effect(() => {
      if (this.isOpen()) {
        const handleEscape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            this.closeModal();
          }
        };
        document.addEventListener('keydown', handleEscape);
        return () => {
          document.removeEventListener('keydown', handleEscape);
        };
      }
      return undefined;
    });
  }

  protected getMediaType(): 'image' | 'video' {
    if (this.type !== 'auto') {
      return this.type;
    }

    // Detectar automáticamente
    if (this.isImageUrl(this.url)) {
      return 'image';
    }
    if (this.isVideoUrl(this.url)) {
      return 'video';
    }
    return 'image'; // Default
  }

  protected isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  }

  protected isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|mkv|webm)$/i.test(url);
  }

  protected closeModal(): void {
    this.isOpen.set(false);
    this.close.emit();
  }

  protected stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}

