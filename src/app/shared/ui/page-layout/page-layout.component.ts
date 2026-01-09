import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import type { AuthUser } from '../../../core/models/auth.model';
import { CompanyContextService } from '../../../core/services/company/company-context.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LayoutService } from '../../../core/services/layout/layout.service';

export interface LayoutBreadcrumb {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-page-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './page-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageLayoutComponent {
  private readonly companyContext = inject(CompanyContextService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);
  private readonly route = inject(ActivatedRoute);

  protected readonly selectedCompany = this.companyContext.selectedCompany;
  protected readonly user = this.authService.user;
  protected readonly isUserMenuOpen = signal(false);

  // Soporte para ambos: @Input (compatibilidad hacia atrás) y servicio (para router-outlet)
  @Input({ required: false }) breadcrumbs: LayoutBreadcrumb[] = [];
  @Input({ required: false }) background = 'bg-sand/80';

  // Usar breadcrumbs del servicio si están disponibles, sino usar @Input
  protected readonly activeBreadcrumbs = computed(() => {
    const serviceBreadcrumbs = this.layoutService.breadcrumbs();
    return serviceBreadcrumbs.length > 0 ? serviceBreadcrumbs : this.breadcrumbs;
  });

  // Usar background del servicio si está disponible, sino usar @Input
  protected readonly activeBackground = computed(() => {
    const serviceBackground = this.layoutService.background();
    return serviceBackground !== 'bg-sand/80' ? serviceBackground : this.background;
  });

  // Detectar si hay rutas hijas activas para decidir entre router-outlet y ng-content
  // Si el componente se carga como ruta padre (con children), usamos router-outlet
  // Si se usa directamente con ng-content, usamos ng-content
  protected readonly hasChildRoutes = computed(() => {
    // Si hay firstChild, significa que hay una ruta hija activa
    return Boolean(this.route.firstChild);
  });

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
        { label: 'Invoices', route: '/invoices' },
        { label: 'Users', route: '/users' }
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


