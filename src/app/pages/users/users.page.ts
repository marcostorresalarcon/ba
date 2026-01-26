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
import { UserFormComponent } from '../../features/users/ui/user-form/user-form.component';
import { ConfirmationModalComponent } from '../../shared/ui/confirmation-modal/confirmation-modal.component';
import type { User } from '../../core/models/user.model';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule, UserFormComponent, ConfirmationModalComponent],
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
  protected readonly selectedUser = signal<User | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly userToDelete = signal<User | null>(null);
  protected readonly showDeleteModal = signal(false);

  protected readonly deleteMessage = computed(() => {
    const user = this.userToDelete();
    if (!user) {
      return '';
    }
    return `Are you sure you want to delete user "${user.name}" (${user.email})? This action cannot be undone.`;
  });

  protected readonly filteredUsers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return this.users();
    }
    return this.users().filter((user) => {
      // Obtener el rol principal (primer rol activo o primer rol)
      const primaryRole = user.roles?.find((r) => r.active) || user.roles?.[0];
      const roleName = user.role || primaryRole?.name || '';
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        roleName.toLowerCase().includes(query)
      );
    });
  });

  protected readonly activeUsersCount = computed(() => {
    return this.users().filter((u) => {
      // Un usuario está activo si tiene al menos un rol activo
      return u.roles?.some((r) => r.active) ?? false;
    }).length;
  });

  protected readonly uniqueRolesCount = computed(() => {
    const roles = this.users().map((u) => {
      // Obtener el rol principal (primer rol activo o primer rol)
      const primaryRole = u.roles?.find((r) => r.active) || u.roles?.[0];
      return u.role || primaryRole?.name || '';
    }).filter((role): role is string => !!role);
    return new Set(roles).size;
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

  /**
   * Obtiene el rol principal de un usuario (primer rol activo o primer rol)
   */
  protected getPrimaryRole(user: User): string {
    const primaryRole = user.roles?.find((r) => r.active) || user.roles?.[0];
    return user.role || primaryRole?.name || 'N/A';
  }

  /**
   * Obtiene el estado activo de un usuario (si tiene al menos un rol activo)
   */
  protected isUserActive(user: User): boolean {
    return user.roles?.some((r) => r.active) ?? false;
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

  protected editUser(user: User): void {
    this.selectedUser.set(user);
  }

  protected cancelEdit(): void {
    this.selectedUser.set(null);
  }

  protected async handleSubmit(payload: {
    name: string;
    email: string;
    role: string;
    active: boolean;
  }): Promise<void> {
    const user = this.selectedUser();
    if (!user) {
      return;
    }

    this.isSubmitting.set(true);

    // Construir el array de roles según el payload
    const roles = [
      {
        name: payload.role,
        active: payload.active
      }
    ];

    this.userService
      .updateUser(user._id, {
        name: payload.name,
        email: payload.email,
        roles
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: (updatedUser) => {
          // Actualizar el usuario en la lista
          this.users.update((users) =>
            users.map((u) => (u._id === updatedUser._id ? updatedUser : u))
          );
          this.selectedUser.set(null);
          this.notificationService.success('User updated', `${updatedUser.name} has been updated successfully`);
        },
        error: (error) => {
          const errorMessage = this.errorService.handle(error);
          this.notificationService.error('Error updating user', errorMessage);
        }
      });
  }

  protected deleteUser(user: User): void {
    if (this.isDeleting()) {
      return;
    }

    this.userToDelete.set(user);
    this.showDeleteModal.set(true);
  }

  protected confirmDelete(): void {
    const user = this.userToDelete();
    if (!user) {
      return;
    }

    this.showDeleteModal.set(false);
    this.isDeleting.set(true);

    this.userService
      .deleteUser(user._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isDeleting.set(false);
          this.userToDelete.set(null);
        })
      )
      .subscribe({
        next: () => {
          // Remover el usuario de la lista
          this.users.update((users) => users.filter((u) => u._id !== user._id));
          if (this.selectedUser()?._id === user._id) {
            this.selectedUser.set(null);
          }
          this.notificationService.success('User deleted', `${user.name} has been deleted successfully`);
        },
        error: (error) => {
          const errorMessage = this.errorService.handle(error);
          this.notificationService.error('Error deleting user', errorMessage);
        }
      });
  }

  protected cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.userToDelete.set(null);
  }
}

