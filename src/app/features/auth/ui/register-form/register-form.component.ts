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
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { FormControl, FormGroup } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { RegisterRequestPayload, RegisterConfirmPayload } from '../../../../core/models/auth.model';

type RegisterDataFormGroup = FormGroup<{
  name: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
}>;

type CodeVerificationFormGroup = FormGroup<{
  code: FormControl<string>;
}>;

@Component({
  selector: 'app-register-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterFormComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly showPassword = signal(false);
  protected readonly currentStep = signal<'data' | 'code'>('data');
  protected readonly userEmail = signal<string>('');
  private readonly errorMessageSignal = signal<string | null>(null);
  private readonly savedRegisterData = signal<RegisterRequestPayload | null>(null);

  protected readonly dataForm: RegisterDataFormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected readonly codeForm: CodeVerificationFormGroup = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  @Input({ required: true }) isSubmitting = false;

  @Input()
  set errorMessage(value: string | null) {
    this.errorMessageSignal.set(value);
  }

  get errorMessage(): string | null {
    return this.errorMessageSignal();
  }

  @Output() readonly submitRegisterData = new EventEmitter<RegisterRequestPayload>();
  @Output() readonly submitCode = new EventEmitter<RegisterConfirmPayload>();
  @Output() readonly clearError = new EventEmitter<void>();
  @Output() readonly resendCode = new EventEmitter<string>();

  // Método público para que el padre pueda cambiar el paso después de recibir respuesta exitosa
  setStep(step: 'data' | 'code'): void {
    this.currentStep.set(step);
  }

  constructor() {
    // Limpiar el error cuando el usuario empiece a escribir
    this.dataForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.errorMessageSignal()) {
        this.clearError.emit();
      }
    });

    this.codeForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.errorMessageSignal()) {
        this.clearError.emit();
      }
    });
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  protected submitDataForm(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.dataForm.invalid) {
      this.dataForm.markAllAsTouched();
      return;
    }

    const { name, email, password } = this.dataForm.getRawValue();
    const registerData: RegisterRequestPayload = { name, email, password };
    this.userEmail.set(email);
    this.savedRegisterData.set(registerData);
    this.submitRegisterData.emit(registerData);
  }

  protected submitCodeForm(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }

    const { code } = this.codeForm.getRawValue();
    this.submitCode.emit({ email: this.userEmail(), code });
  }

  protected handleResendCode(): void {
    if (this.isSubmitting) {
      return;
    }
    const savedData = this.savedRegisterData();
    if (savedData) {
      // Reenviar con los datos originales del registro
      this.submitRegisterData.emit(savedData);
    } else {
      // Fallback: emitir evento resendCode solo con email
      this.resendCode.emit(this.userEmail());
    }
  }

  protected goBackToDataStep(): void {
    this.currentStep.set('data');
    this.codeForm.reset();
    this.errorMessageSignal.set(null);
  }

  protected moveToCodeStep(): void {
    this.currentStep.set('code');
    this.errorMessageSignal.set(null);
  }

  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Solo permitir números
    const value = input.value.replace(/\D/g, '');
    this.codeForm.patchValue({ code: value }, { emitEvent: false });
  }

  protected controlInvalid(form: RegisterDataFormGroup | CodeVerificationFormGroup, controlName: string): boolean {
    let control: AbstractControl | null = null;

    if (form === this.dataForm) {
      control = form.controls[controlName as keyof RegisterDataFormGroup['controls']] as AbstractControl;
    } else if (form === this.codeForm) {
      control = form.controls[controlName as keyof CodeVerificationFormGroup['controls']] as AbstractControl;
    }

    return control ? control.invalid && (control.dirty || control.touched) : false;
  }
}
