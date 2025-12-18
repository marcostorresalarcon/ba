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
import { AudioRecorderService } from '../../../../../../core/services/audio/audio-recorder.service';
import { AudioService } from '../../../../../../core/services/audio/audio.service';
import { S3UploadService } from '../../../../../../core/services/upload/s3-upload.service';
import { LogService } from '../../../../../../core/services/log/log.service';
import { LoadingService } from '../../../../../../core/services/loading/loading.service';
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
  private readonly audioRecorderService = inject(AudioRecorderService);
  private readonly audioService = inject(AudioService);
  private readonly s3UploadService = inject(S3UploadService);
  private readonly logService = inject(LogService);
  private readonly loadingService = inject(LoadingService);

  @Input({ required: true }) form!: KitchenQuoteFormGroup;

  protected readonly isRecording = this.audioRecorderService.isRecording;
  protected readonly isUploadingAudio = signal(false);
  protected readonly isProcessingAudio = signal(false);
  protected readonly hasRecording = signal(false);
  protected readonly mediaFiles = signal<File[]>([]);
  protected readonly drawings = signal<string[]>([]);
  protected readonly estimateResult = signal<number | null>(null);

  protected async toggleVoiceRecording(): Promise<void> {
    if (this.isRecording()) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      await this.audioRecorderService.startRecording();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.notificationService.error(
        'Error',
        `Could not start recording. ${errorMsg}`
      );
      await this.logService.logError('Error al iniciar grabación de audio', error, {
        severity: 'medium',
        description: 'Error al intentar iniciar la grabación de audio en additional tab',
        source: 'additional-tab',
        metadata: {
          component: 'AdditionalTabComponent',
          action: 'startRecording'
        }
      });
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      const audioFile = await this.audioRecorderService.stopRecording();
      await this.processAudioFile(audioFile);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.notificationService.error('Error', `Error stopping recording: ${errorMsg}`);
      await this.logService.logError('Error al detener grabación de audio', error, {
        severity: 'medium',
        description: 'Error al intentar detener la grabación de audio en additional tab',
        source: 'additional-tab',
        metadata: {
          component: 'AdditionalTabComponent',
          action: 'stopRecording'
        }
      });
    }
  }

  private async processAudioFile(file: File): Promise<void> {
    this.isUploadingAudio.set(true);
    this.isProcessingAudio.set(true);

    try {
      const url = await this.s3UploadService.uploadFile(file);
      this.isUploadingAudio.set(false);

      // Procesar con API de audio usando la URL de S3
      // El interceptor HTTP activará automáticamente el loader
      this.notificationService.info('Processing', 'Generating audio summary...');

      this.audioService.summarizeAudioFromUrl(url).subscribe({
        next: (response) => {
          const currentAudios = this.form.controls.audioNotes.value || [];
          const newAudio = response.success
            ? {
                url,
                transcription: response.data.transcription,
                summary: response.data.summary,
              }
            : { url };

          // Agregar el nuevo audio al inicio del array (más reciente primero)
          this.form.controls.audioNotes.setValue([newAudio, ...currentAudios], { emitEvent: true });

          if (response.success) {
            this.notificationService.success('Success', 'Audio processed successfully');
          } else {
            this.notificationService.info(
              'Warning',
              'Audio saved, but summary could not be generated'
            );
            void this.logService.logNotification('Audio guardado pero resumen no generado', {
              description: 'El audio se subió correctamente pero no se pudo generar el resumen',
              source: 'additional-tab',
              metadata: {
                component: 'AdditionalTabComponent',
                action: 'processAudioFile',
                audioUrl: url
              }
            });
          }
          this.isProcessingAudio.set(false);
          this.hasRecording.set(true);
          // Asegurar que el loader se cierre después de que el interceptor HTTP termine
          setTimeout(() => this.loadingService.reset(), 200);
        },
        error: (error) => {
          // Si falla el procesamiento, al menos guardar el audio
          const currentAudios = this.form.controls.audioNotes.value || [];
          this.form.controls.audioNotes.setValue([{ url }, ...currentAudios], { emitEvent: true });
          this.notificationService.info('Warning', 'Audio saved, but text processing failed');
          this.isProcessingAudio.set(false);
          this.hasRecording.set(true);
          // Asegurar que el loader se cierre después de que el interceptor HTTP termine
          setTimeout(() => this.loadingService.reset(), 200);

          void this.logService.logError('Error al procesar audio con API', error, {
            severity: 'medium',
            description: 'Error al procesar el audio con la API de resumen, pero el archivo se guardó correctamente',
            source: 'additional-tab',
            metadata: {
              component: 'AdditionalTabComponent',
              action: 'summarizeAudio',
              audioUrl: url
            }
          });
        }
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.notificationService.error('Error', `Could not upload audio file: ${errorMsg}`);
      this.isUploadingAudio.set(false);
      this.isProcessingAudio.set(false);
      // Asegurar que el loader se cierre después de que el interceptor HTTP termine
      setTimeout(() => this.loadingService.reset(), 200);

      await this.logService.logError('Error al subir archivo de audio', error, {
        severity: 'high',
        description: 'Error al subir el archivo de audio a S3',
        source: 'additional-tab',
        metadata: {
          component: 'AdditionalTabComponent',
          action: 'processAudioFile'
        }
      });
    }
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
    } catch {
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

