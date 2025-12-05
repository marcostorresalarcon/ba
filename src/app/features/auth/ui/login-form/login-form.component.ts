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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  private readonly errorMessageSignal = signal<string | null>(null);

  @Input({ required: true }) isSubmitting = false;
  
  @Input() 
  set errorMessage(value: string | null) {
    this.errorMessageSignal.set(value);
  }
  
  get errorMessage(): string | null {
    return this.errorMessageSignal();
  }

  @Output() readonly submitCredentials = new EventEmitter<LoginPayload>();
  @Output() readonly clearError = new EventEmitter<void>();

  constructor() {
    // Limpiar el error cuando el usuario empiece a escribir
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.errorMessageSignal()) {
          this.clearError.emit();
        }
      });
  }

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


