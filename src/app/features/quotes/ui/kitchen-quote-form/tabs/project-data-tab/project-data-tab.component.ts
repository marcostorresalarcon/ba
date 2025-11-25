import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import type { KitchenQuoteFormGroup } from '../../kitchen-quote-form.types';

@Component({
  selector: 'app-project-data-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  templateUrl: './project-data-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectDataTabComponent {
  @Input({ required: true }) form!: KitchenQuoteFormGroup;
  @Output() readonly createClient = new EventEmitter<void>();

  protected readonly statusOptions = ['draft', 'sent', 'approved', 'rejected', 'in_progress', 'completed'];
  protected readonly sourceOptions = ['website', 'referral', 'social_media', 'advertisement', 'other'];

  protected controlInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  protected onCreateClient(): void {
    this.createClient.emit();
  }
}

