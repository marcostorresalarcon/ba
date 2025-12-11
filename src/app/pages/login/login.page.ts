import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

import type { LoginPayload } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { LoginFormComponent } from '../../features/auth/ui/login-form/login-form.component';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { CredentialsStorageService } from '../../core/services/auth/credentials-storage.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, LoginFormComponent],
  templateUrl: './login.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly credentialsStorage = inject(CredentialsStorageService);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  async handleSubmit(payload: LoginPayload): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      // Preparar payload para el backend (sin rememberMe)
      const { rememberMe, ...loginData } = payload;
      
      const response = await firstValueFrom(this.authService.login(loginData));
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      this.companyContext.clear();

      // Manejar "Remember Me"
      if (rememberMe) {
        this.credentialsStorage.saveCredentials(payload.email, payload.password);
      } else {
        this.credentialsStorage.clearCredentials();
      }

      this.notificationService.success('Welcome back!', `Hello ${response.user.name}`);
      await this.router.navigateByUrl('/company');
    } catch (error) {
      const message = this.errorService.handle(error);
      this.errorMessage.set(message);
      this.notificationService.error('Login failed', message);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}


