import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-change-password-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangePasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly errorService = inject(HttpErrorService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  protected readonly isSubmitting = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: this.passwordsMatch }
  );

  private passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const pw = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pw && confirm && pw !== confirm ? { mismatch: true } : null;
  }

  protected hasError(name: 'newPassword' | 'confirmPassword'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    const user = this.authService.user();
    if (!user) {
      this.router.navigateByUrl('/login');
      return;
    }

    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiUrl}/users/${user.id}/change-password`, {
          newPassword: this.form.controls.newPassword.value
        })
      );

      const updated = { ...user, forcePasswordChange: false };
      this.authService.updateUser(updated);
      this.notificationService.success('Password updated', 'Your new password has been saved');
      await this.router.navigateByUrl('/company');
    } catch (error) {
      const message = this.errorService.handle(error);
      this.notificationService.error('Failed to update password', message);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
