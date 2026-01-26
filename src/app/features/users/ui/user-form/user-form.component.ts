import { CommonModule, TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import type { User, UserRole } from '../../../../core/models/user.model';

type UserFormGroup = ReturnType<typeof createUserFormGroup>;

function createUserFormGroup(fb: FormBuilder) {
  return fb.nonNullable.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    role: ['', [Validators.required]],
    active: [true]
  });
}

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TitleCasePipe],
  templateUrl: './user-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: false }) user: User | null = null;
  @Input({ required: true }) isSubmitting = false;

  @Output() readonly submitUser = new EventEmitter<{
    name: string;
    email: string;
    role: string;
    active: boolean;
  }>();
  @Output() readonly cancelEdit = new EventEmitter<void>();

  protected readonly form = createUserFormGroup(this.fb);
  protected readonly availableRoles = signal<string[]>(['admin', 'estimator', 'customer']);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']) {
      const value = changes['user'].currentValue as User | null;
      if (value) {
        const activeRole = value.roles?.find((r) => r.active) || value.roles?.[0];
        this.form.patchValue({
          name: value.name,
          email: value.email,
          role: activeRole?.name || '',
          active: value.roles?.some((r) => r.active) ?? true
        });
      } else {
        this.form.reset({
          name: '',
          email: '',
          role: '',
          active: true
        });
      }
    }
  }

  protected hasError(controlName: keyof UserFormGroup['controls']): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected getErrorMessage(controlName: keyof UserFormGroup['controls']): string {
    const control = this.form.controls[controlName];
    if (control.errors?.['required']) {
      return 'This field is required';
    }
    if (control.errors?.['email']) {
      return 'Invalid email format';
    }
    return 'Invalid value';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.getRawValue();
    this.submitUser.emit({
      name: formValue.name,
      email: formValue.email,
      role: formValue.role,
      active: formValue.active
    });
  }
}
