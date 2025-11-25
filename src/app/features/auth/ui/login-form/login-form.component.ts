import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FormControl, FormGroup } from '@angular/forms';

import type { LoginPayload } from '../../../../core/models/auth.model';

type LoginFormGroup = FormGroup<{
  email: FormControl<string>;
  password: FormControl<string>;
  rememberMe: FormControl<boolean>;
}>;

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginFormComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly form: LoginFormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true]
  });

  protected readonly showPassword = signal(false);

  @Input({ required: true }) isSubmitting = false;

  @Output() readonly submitCredentials = new EventEmitter<LoginPayload>();

  protected togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  protected submit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitCredentials.emit({ email, password });
  }

  protected controlInvalid(controlName: keyof LoginFormGroup['controls']): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }
}


