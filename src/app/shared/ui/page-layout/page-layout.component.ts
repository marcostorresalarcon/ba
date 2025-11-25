import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import type { AuthUser } from '../../../core/models/auth.model';
import { CompanyContextService } from '../../../core/services/company/company-context.service';
import { AuthService } from '../../../core/services/auth/auth.service';

export interface LayoutBreadcrumb {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-page-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './page-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageLayoutComponent {
  private readonly companyContext = inject(CompanyContextService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly selectedCompany = this.companyContext.selectedCompany;
  protected readonly user = this.authService.user;
  protected readonly isUserMenuOpen = signal(false);

  @Input({ required: false }) breadcrumbs: LayoutBreadcrumb[] = [];
  @Input({ required: false }) background = 'bg-sand/80';

  protected readonly navItems = computed(() => {
    const user = this.user();
    if (!user) return [];

    const role = user.role?.toLowerCase();

    if (role === 'customer') {
      return [
        { label: 'My Projects', route: '/my-projects' }
      ];
    }

    if (role === 'administrator' || role === 'admin') {
      return [
        { label: 'Dashboard', route: '/dashboard' },
        { label: 'Customers', route: '/customers' },
        { label: 'Projects', route: '/projects' },
        { label: 'Estimates', route: '/quotes' },
        { label: 'Invoices', route: '/invoices' }
      ];
    }

    // Estimator
    return [
      { label: 'Customers', route: '/customers' },
      { label: 'Projects', route: '/projects' },
      { label: 'Estimates', route: '/quotes' }
    ];
  });

  protected hasRoute(breadcrumb: LayoutBreadcrumb): boolean {
    return Boolean(breadcrumb.route);
  }

  protected toggleUserMenu(): void {
    this.isUserMenuOpen.update((value) => !value);
  }

  protected logout(): void {
    this.authService.logout();
    this.companyContext.clear();
    this.isUserMenuOpen.set(false);
    void this.router.navigateByUrl('/login');
  }
}


