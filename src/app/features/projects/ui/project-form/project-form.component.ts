import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  type OnChanges,
  type SimpleChanges
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FormControl, FormGroup } from '@angular/forms';

import type { Project } from '../../../../core/models/project.model';

export type ProjectType = 'kitchen' | 'bathroom' | 'basement' | 'additional-work';

export interface ProjectFormValue {
  name: string;
  description: string;
  projectType: ProjectType;
}

type ProjectFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string>;
  projectType: FormControl<ProjectType>;
}>;

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './project-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) isSubmitting = false;
  @Input({ required: false }) project: Project | null = null;
  @Output() readonly submitProject = new EventEmitter<ProjectFormValue>();
  @Output() readonly cancelForm = new EventEmitter<void>();

  protected readonly form: ProjectFormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    projectType: ['kitchen' as ProjectType, [Validators.required]]
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['project'] && this.project) {
      this.form.patchValue({
        name: this.project.name,
        description: this.project.description ?? '',
        projectType: (this.project.projectType as ProjectType) ?? 'kitchen'
      });
    } else if (changes['project'] && !this.project) {
      this.form.reset({
        name: '',
        description: '',
        projectType: 'kitchen'
      });
    }
  }

  protected readonly projectTypes: { value: ProjectType; label: string }[] = [
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'basement', label: 'Basement' },
    { value: 'additional-work', label: 'Additional Work' }
  ];

  protected submit(): void {
    if (this.isSubmitting || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitProject.emit(this.form.getRawValue());
  }

  protected onCancel(): void {
    this.cancelForm.emit();
  }

  protected controlInvalid(controlName: keyof ProjectFormGroup['controls']): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }
}

