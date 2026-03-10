import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth/auth.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';

@Component({
  selector: 'app-password-reset-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './password-reset.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordResetPage {
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly step = signal<'request' | 'confirm'>('request');
  protected readonly isSubmitting = signal(false);
  protected readonly requestedEmail = signal<string | null>(null);

  protected readonly requestForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  protected readonly confirmForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.minLength(6)]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected onRequestSubmit(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }
    const email = this.requestForm.getRawValue().email?.trim().toLowerCase() ?? '';
    this.isSubmitting.set(true);
    this.authService
      .requestPasswordReset({ email })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.requestedEmail.set(email);
          this.step.set('confirm');
          this.confirmForm.patchValue({ email });
          this.notificationService.success(res.message ?? 'Code sent to your email', '');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error requesting code', msg);
        }
      });
  }

  protected onConfirmSubmit(): void {
    if (this.confirmForm.invalid) {
      this.confirmForm.markAllAsTouched();
      return;
    }
    const { email, code, newPassword } = this.confirmForm.getRawValue();
    if (!email || !code || !newPassword) return;
    this.isSubmitting.set(true);
    this.authService
      .confirmPasswordReset({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword: newPassword.trim()
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.notificationService.success(res.message ?? 'Password updated', '');
          void this.router.navigateByUrl('/login');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error', msg);
        }
      });
  }

  protected backToRequest(): void {
    this.step.set('request');
    this.requestedEmail.set(null);
  }
}
