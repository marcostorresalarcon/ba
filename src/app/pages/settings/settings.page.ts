import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth/auth.service';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { LayoutService } from '../../core/services/layout/layout.service';
import { ConfirmationModalComponent } from '../../shared/ui/confirmation-modal/confirmation-modal.component';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, ConfirmationModalComponent],
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPage {
  private readonly authService = inject(AuthService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);

  protected readonly showDeleteAccountModal = signal(false);
  protected readonly isDeleting = signal(false);

  protected readonly breadcrumbs: LayoutBreadcrumb[] = [
    { label: 'Settings', route: '/settings' }
  ];

  constructor() {
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs);
    });
  }

  protected openDeleteAccountModal(): void {
    this.showDeleteAccountModal.set(true);
  }

  protected closeDeleteAccountModal(): void {
    if (!this.isDeleting()) {
      this.showDeleteAccountModal.set(false);
    }
  }

  protected async confirmDeleteAccount(): Promise<void> {
    if (this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);

    try {
      await firstValueFrom(
        this.authService.deleteAccount().pipe(
          finalize(() => this.isDeleting.set(false))
        )
      );
      this.showDeleteAccountModal.set(false);
      this.authService.logout();
      this.companyContext.clear();
      this.notificationService.success('Account deleted', 'Your account has been deleted successfully.');
      await this.router.navigateByUrl('/login');
    } catch (error) {
      this.isDeleting.set(false);
      const message = this.errorService.handle(error);
      this.notificationService.error('Could not delete account', message);
    }
  }
}
