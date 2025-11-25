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

  protected onMediaFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.mediaFiles.set([...this.mediaFiles(), ...files]);
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

