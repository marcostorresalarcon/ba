import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { CustomerService } from '../../core/services/customer/customer.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserService } from '../../core/services/user/user.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { LayoutService } from '../../core/services/layout/layout.service';
import { Customer, CustomerAddress } from '../../core/models/customer.model';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { AddressListComponent } from '../../features/profile/ui/address-list/address-list.component';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AddressListComponent],
  templateUrl: './profile.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePage {
  private readonly customerService = inject(CustomerService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutService = inject(LayoutService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  protected readonly profile = signal<Customer | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    lastName: [''],
    phone: [''],
    email: ['', [Validators.required, Validators.email]]
  });

  protected readonly breadcrumbs: LayoutBreadcrumb[] = [
    { label: 'Profile', route: '/profile' }
  ];

  protected readonly isCustomer = () => this.authService.user()?.role === 'customer';
  protected readonly linkCopied = signal(false);

  protected readonly inviteLink = computed(() => {
    const user = this.authService.user();
    const companyId = this.companyContext.selectedCompany()?._id;
    const base = window.location.origin;
    const params = new URLSearchParams({ estimatorId: user?.id ?? '' });
    if (companyId) params.set('companyId', companyId);
    return `${base}/register?${params.toString()}`;
  });

  constructor() {
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs);
    });
    this.loadProfile();
  }

  protected loadProfile(): void {
    this.isLoading.set(true);
    if (this.isCustomer()) {
      this.customerService
        .getMe()
        .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: (customer) => {
            this.profile.set(customer);
            this.form.patchValue({
              name: customer.name ?? '',
              lastName: customer.lastName ?? '',
              phone: customer.phone ?? '',
              email: customer.email ?? ''
            });
          },
          error: (err: unknown) => {
            this.notificationService.error('Error loading profile', this.errorService.handle(err));
          }
        });
    } else {
      // Admin / estimator: prefill from auth user signal, no extra API call needed
      const u = this.authService.user();
      this.form.patchValue({ name: u?.name ?? '', email: u?.email ?? '' });
      this.isLoading.set(false);
    }
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    const raw = this.form.getRawValue();

    if (this.isCustomer()) {
      const payload = {
        name: raw.name ?? undefined,
        lastName: raw.lastName || undefined,
        phone: raw.phone || undefined,
        email: raw.email ?? undefined
      };
      this.customerService
        .updateMe(payload)
        .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: (updated) => {
            this.profile.set(updated);
            this.authService.updateUser({
              ...this.authService.user()!,
              name: [updated.name, updated.lastName].filter(Boolean).join(' ') || this.authService.user()!.name
            });
            this.notificationService.success('Profile updated', '');
          },
          error: (err: unknown) => {
            this.notificationService.error('Error updating profile', this.errorService.handle(err));
          }
        });
    } else {
      const userId = this.authService.user()?.id;
      if (!userId) return;
      this.userService
        .updateUser(userId, { name: raw.name ?? undefined, email: raw.email ?? undefined } as any)
        .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: (updated) => {
            this.authService.updateUser({ ...this.authService.user()!, name: updated.name ?? this.authService.user()!.name });
            this.notificationService.success('Profile updated', '');
          },
          error: (err: unknown) => {
            this.notificationService.error('Error updating profile', this.errorService.handle(err));
          }
        });
    }
  }

  protected onAddAddress(address: CustomerAddress) {
    const current = this.profile()?.addresses || [];
    if (address.isPrimary) {
      current.forEach(a => a.isPrimary = false);
    }
    const newAddresses = [...current, address];
    this.updateAddresses(newAddresses);
  }

  protected onEditAddress({ address, index }: { address: CustomerAddress; index: number }) {
    const current = [...(this.profile()?.addresses || [])];
    if (index >= 0 && index < current.length) {
      if (address.isPrimary) {
        current.forEach((a, i) => {
          if (i !== index) a.isPrimary = false;
        });
      }
      current[index] = address;
      this.updateAddresses(current);
    }
  }

  protected onDeleteAddress(index: number) {
    const current = [...(this.profile()?.addresses || [])];
    if (index >= 0 && index < current.length) {
      current.splice(index, 1);
      this.updateAddresses(current);
    }
  }

  protected copyInviteLink(): void {
    navigator.clipboard.writeText(this.inviteLink()).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  private updateAddresses(addresses: CustomerAddress[]) {
    this.isSaving.set(true);
    this.customerService
      .updateMe({ addresses })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSaving.set(false))
      )
      .subscribe({
        next: (updated) => {
          this.profile.set(updated);
          this.notificationService.success('Addresses updated', '');
        },
        error: (err: unknown) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error updating addresses', msg);
        }
      });
  }
}
