import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
  signal
} from '@angular/core';
import type { FormControl} from '@angular/forms';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { NotificationService } from '../../../../../../core/services/notification/notification.service';
import { PermissionsService } from '../../../../../../core/services/permissions/permissions.service';
import { MediaPickerService } from '../../../../../../core/services/media/media-picker.service';
import type { KitchenQuoteFormGroup } from '../../kitchen-quote-form.types';

@Component({
  selector: 'app-additional-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  templateUrl: './additional-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdditionalTabComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly mediaPickerService = inject(MediaPickerService);

  @Input({ required: true }) form!: KitchenQuoteFormGroup;

  protected readonly isRecording = signal(false);
  protected readonly hasRecording = signal(false);
  protected readonly mediaFiles = signal<File[]>([]);
  protected readonly drawings = signal<string[]>([]);
  protected readonly estimateResult = signal<number | null>(null);

  protected toggleVoiceRecording(): void {
    // TODO: Implement voice recording
    this.isRecording.set(!this.isRecording());
  }

  protected async onMediaFileSelected(): Promise<void> {
    try {
      // Verificar permisos antes de abrir el selector
      const hasPermission = await this.permissionsService.requestMediaPermissions();
      if (!hasPermission) {
        this.notificationService.error(
          'Permisos requeridos',
          'Se necesita acceso a la cámara y galería para seleccionar archivos. Por favor, habilita los permisos en la configuración de tu dispositivo.'
        );
        return;
      }

      // Seleccionar medios usando el servicio nativo
      const files = await this.mediaPickerService.pickMultipleMedia(10);
      if (files.length > 0) {
      this.mediaFiles.set([...this.mediaFiles(), ...files]);
      }
    } catch (error) {
      console.error('Error selecting media files:', error);
      this.notificationService.error('Error', 'No se pudieron seleccionar los archivos');
    }
  }

  protected removeMediaFile(index: number): void {
    const files = this.mediaFiles();
    files.splice(index, 1);
    this.mediaFiles.set([...files]);
  }

  protected toggleDrawingTool(): void {
    // TODO: Implement drawing tool
    this.notificationService.info('Drawing Tool', 'Drawing tool will be implemented soon');
  }

  protected viewDrawing(_index: number): void {
    // TODO: Implement drawing viewer
    this.notificationService.info('View Drawing', 'Drawing viewer will be implemented soon');
  }

  protected removeDrawing(index: number): void {
    const drawings = this.drawings();
    drawings.splice(index, 1);
    this.drawings.set([...drawings]);
  }

  protected calculateEstimate(): void {
    const roughQuoteControl = this.form.controls['roughQuote'] as FormControl<number | null>;
    const roughQuote = roughQuoteControl.value;
    if (roughQuote !== null && roughQuote !== undefined && typeof roughQuote === 'number') {
      this.estimateResult.set(roughQuote);
    }
  }
}

