import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { Company } from '../../core/models/company.model';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { CompanyService } from '../../core/services/company/company.service';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { CompanyCardComponent } from '../../features/company/ui/company-card/company-card.component';
import { PageLayoutComponent, type LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

interface BadgeConfig {
  id: string;
  label: string;
  color: string;
  accent: string;
}

@Component({
  selector: 'app-company-selection-page',
  standalone: true,
  imports: [CommonModule, PageLayoutComponent, CompanyCardComponent],
  templateUrl: './company-selection.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanySelectionPage {
  private readonly companyService = inject(CompanyService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);

  protected readonly companies = signal<Company[]>([]);
  protected readonly isLoading = signal(true);

  protected readonly selectedCompany = this.companyContext.selectedCompany;

  protected readonly badges: BadgeConfig[] = [
    { id: 'kitchen', label: 'Kitchen & Bath', color: 'bg-pine text-white', accent: 'shadow-raised' },
    { id: 'stones', label: 'Stones Surfaces', color: 'bg-charcoal text-white', accent: 'shadow-brand' },
    { id: 'exteriors', label: 'Exteriors', color: 'bg-alabaster text-charcoal', accent: 'shadow-raised' }
  ];

  protected readonly breadcrumbs: LayoutBreadcrumb[] = [{ label: 'Choose the company' }];

  private readonly brandLogos: Record<string, string> = {
    'BA Kitchen & Bath Design': 'BA Kitchen Bath Design.png',
    'BA Stones Surfaces': 'BA Stones Surfaces.png',
    'BA Exteriors': 'BA Exteriors.png'
  };

  constructor() {
    this.fetchCompanies();
  }

  protected async handleSelection(company: Company): Promise<void> {
    this.companyContext.setCompany(company);
    this.notificationService.success('Company selected', company.name);

    const user = this.authService.user();
    const role = user?.role?.toLowerCase();

    if (role === 'customer') {
      await this.router.navigateByUrl('/my-projects');
    } else if (role === 'administrator' || role === 'admin') {
      // Admin can also view the dashboard, but let's default to dashboard
      await this.router.navigateByUrl('/dashboard');
    } else {
      // Estimator or default
      await this.router.navigateByUrl('/customers');
    }
  }

  protected companyTrackBy(_: number, company: Company): string {
    return company._id;
  }

  protected companyLogo(company: Company): string | null {
    return this.brandLogos[company.name] ?? company.logoUrl ?? null;
  }

  protected reloadCompanies(): void {
    this.fetchCompanies();
  }

  private fetchCompanies(): void {
    this.isLoading.set(true);

    this.companyService
      .getCompanies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (companies) => this.companies.set(companies),
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Unable to load companies', message);
        },
        complete: () => this.isLoading.set(false)
      });
  }
}


