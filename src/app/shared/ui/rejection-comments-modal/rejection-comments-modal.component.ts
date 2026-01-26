import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

export interface RejectionCommentData {
  comment: string;
  mediaFiles?: string[];
}

@Component({
  selector: 'app-rejection-comments-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rejection-comments-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RejectionCommentsModalComponent {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) isOpen = false;
  @Input() title = 'Rechazar Cotización';
  @Input() message = 'Por favor, proporciona un comentario explicando el motivo del rechazo.';

  @Output() readonly confirm = new EventEmitter<RejectionCommentData>();
  @Output() readonly cancel = new EventEmitter<void>();

  protected readonly form = this.fb.group({
    comment: ['', [Validators.required, Validators.minLength(10)]],
    mediaFiles: [[] as string[]]
  });

  protected readonly isSubmitting = signal(false);

  constructor() {
    // Resetear formulario cuando el modal se cierra después de un submit exitoso
    effect(() => {
      if (!this.isOpen && !this.isSubmitting()) {
        // Si el modal se cerró y no está procesando, resetear el formulario
        this.form.reset();
        this.isSubmitting.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen) {
      this.handleCancel();
    }
  }

  protected handleConfirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.form.value;
    this.confirm.emit({
      comment: formValue.comment || '',
      mediaFiles: formValue.mediaFiles || []
    });
  }

  protected handleCancel(): void {
    if (!this.isSubmitting()) {
      this.form.reset();
      this.cancel.emit();
    }
  }

  protected handleBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.isSubmitting()) {
      this.handleCancel();
    }
  }

  protected get commentError(): string | null {
    const control = this.form.get('comment');
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return 'El comentario es obligatorio';
      }
      if (control.errors['minlength']) {
        return 'El comentario debe tener al menos 10 caracteres';
      }
    }
    return null;
  }
}
