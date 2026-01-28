import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

import type { RegisterRequestPayload, RegisterConfirmPayload } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { RegisterFormComponent } from '../../features/auth/ui/register-form/register-form.component';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { NotificationService } from '../../core/services/notification/notification.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, RegisterFormComponent],
  templateUrl: './register.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPage {
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  @ViewChild(RegisterFormComponent) registerForm?: RegisterFormComponent;

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  async handleRegisterData(payload: RegisterRequestPayload): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      await firstValueFrom(this.authService.registerRequestCode(payload));
      // Cambiar al paso de código después de recibir respuesta exitosa
      this.registerForm?.setStep('code');
      this.notificationService.success(
        'Code sent',
        `We sent a verification code to ${payload.email}`
      );
    } catch (error) {
      const message = this.errorService.handle(error);
      this.errorMessage.set(message);
      this.notificationService.error('Registration failed', message);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleCodeConfirmation(payload: RegisterConfirmPayload): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      const response = await firstValueFrom(this.authService.registerConfirm(payload));
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      this.companyContext.clear();

      this.notificationService.success('Welcome!', `Hello ${response.user.name}`);
      await this.router.navigateByUrl('/company');
    } catch (error) {
      const message = this.errorService.handle(error);
      this.errorMessage.set(message);
      this.notificationService.error('Verification failed', message);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleResendCode(email: string): Promise<void> {
    // El componente register-form maneja el reenvío internamente
    // Este método se llama como fallback si no hay datos guardados
    this.notificationService.info('Resending code', `Requesting a new code for ${email}`);
  }
}
