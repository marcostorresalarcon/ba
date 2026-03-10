import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { LayoutService } from '../../core/services/layout/layout.service';
import { Customer, CustomerAddress } from '../../core/models/customer.model';
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
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutService = inject(LayoutService);
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

  constructor() {
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs);
    });

    if (this.isCustomer()) {
      this.loadProfile();
    }
  }

  protected loadProfile(): void {
    this.isLoading.set(true);
    this.customerService
      .getMe()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
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
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error loading profile', msg);
        }
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name ?? undefined,
      lastName: raw.lastName || undefined,
      phone: raw.phone || undefined,
      email: raw.email ?? undefined
    };
    this.customerService
      .updateMe(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSaving.set(false))
      )
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
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error updating profile', msg);
        }
      });
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
