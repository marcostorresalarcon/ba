import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth/auth.service';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { UserService } from '../../core/services/user/user.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { LayoutService } from '../../core/services/layout/layout.service';
import type { User } from '../../core/models/user.model';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersPage {
  private readonly userService = inject(UserService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutService = inject(LayoutService);

  protected readonly selectedCompanySignal = this.companyContext.selectedCompany;
  protected readonly user = this.authService.user;

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const company = this.selectedCompanySignal();
    return [
      { label: 'Choose the company', route: '/company' },
      { label: company?.name ?? 'Select company' },
      { label: 'Users' }
    ];
  });

  protected readonly users = signal<User[]>([]);
  protected readonly searchQuery = signal('');
  protected readonly isLoading = signal(false);

  protected readonly filteredUsers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return this.users();
    }
    return this.users().filter((user) => {
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.role?.toLowerCase().includes(query)
      );
    });
  });

  protected readonly activeUsersCount = computed(() => {
    return this.users().filter((u) => u.active).length;
  });

  protected readonly uniqueRolesCount = computed(() => {
    return new Set(this.users().map((u) => u.role).filter((role): role is string => !!role)).size;
  });

  constructor() {
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs());
    });

    this.loadUsers();
  }

  private loadUsers(): void {
    this.isLoading.set(true);

    const companyId = this.selectedCompanySignal()?._id;

    this.userService
      .getUsers(companyId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (users) => {
          this.users.set(users);
        },
        error: (error) => {
          console.error('Error loading users:', error);
          const errorMessage = this.errorService.handle(error);
          this.notificationService.error('Error loading users', errorMessage);
        }
      });
  }

  protected onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  protected getRoleBadgeClass(role: string | undefined): string {
    if (!role) {
      return 'bg-gray-100 text-gray-800';
    }
    const roleLower = role.toLowerCase();
    if (roleLower === 'administrator' || roleLower === 'admin') {
      return 'bg-pine/20 text-pine';
    }
    if (roleLower === 'estimator') {
      return 'bg-blue-100 text-blue-800';
    }
    if (roleLower === 'customer') {
      return 'bg-slate/20 text-slate';
    }
    return 'bg-gray-100 text-gray-800';
  }

  protected getStatusBadgeClass(active: boolean | undefined): string {
    return active
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  }
}

