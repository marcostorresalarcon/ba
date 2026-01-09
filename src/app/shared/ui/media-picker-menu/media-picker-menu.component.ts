import { CommonModule, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Output,
  signal
} from '@angular/core';

export type MediaType = 'image' | 'video';

@Component({
  selector: 'app-media-picker-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-picker-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MediaPickerMenuComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private clickListener?: () => void;

  @Input({ required: true }) mediaType: MediaType = 'image';
  @Output() captureFromCamera = new EventEmitter<void>();
  @Output() selectFromGallery = new EventEmitter<void>();

  protected readonly isOpen = signal(false);

  protected toggleMenu(): void {
    const newValue = !this.isOpen();
    this.isOpen.set(newValue);
    
    if (newValue) {
      // Agregar listener para cerrar cuando se hace clic fuera
      setTimeout(() => {
        this.clickListener = () => {
          this.closeMenu();
        };
        this.document.addEventListener('click', this.clickListener);
      }, 0);
    } else {
      this.removeClickListener();
    }
  }

  protected onCaptureFromCamera(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.captureFromCamera.emit();
  }

  protected onSelectFromGallery(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.selectFromGallery.emit();
  }

  protected closeMenu(): void {
    this.isOpen.set(false);
    this.removeClickListener();
  }

  private removeClickListener(): void {
    if (this.clickListener) {
      this.document.removeEventListener('click', this.clickListener);
      this.clickListener = undefined;
    }
  }

  ngOnDestroy(): void {
    this.removeClickListener();
  }
}
