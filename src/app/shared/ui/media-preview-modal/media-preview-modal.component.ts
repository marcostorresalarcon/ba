import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, signal, effect, DestroyRef, inject, OnInit } from '@angular/core';

@Component({
  selector: 'app-media-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-preview-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MediaPreviewModalComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  @Input({ required: true }) url!: string;
  @Input() type: 'image' | 'video' | 'auto' = 'auto';
  @Input() alt: string = 'Media preview';
  @Output() close = new EventEmitter<void>();

  protected readonly isOpen = signal(true);
  protected readonly topPosition = signal(0);

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

  ngOnInit(): void {
    // Calcular la posición de scroll actual para mostrar el modal en el viewport correcto
    // Esto soluciona el problema de que el modal aparezca arriba del todo si el padre tiene transform
    const scrollY = window.scrollY || this.document.documentElement.scrollTop || this.document.body.scrollTop || 0;
    this.topPosition.set(scrollY);
    
    // Bloquear scroll del body
    this.document.body.style.overflow = 'hidden';
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
    this.document.body.style.overflow = '';
    this.isOpen.set(false);
    this.close.emit();
  }

  protected stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}

