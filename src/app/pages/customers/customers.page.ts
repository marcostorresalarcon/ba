import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import type { Customer, CustomerPayload } from '../../core/models/customer.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { CustomerService } from '../../core/services/customer/customer.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { CustomerSearchComponent } from '../../features/customers/ui/customer-search/customer-search.component';
import { CustomerListComponent } from '../../features/customers/ui/customer-list/customer-list.component';
import { CustomerFormComponent } from '../../features/customers/ui/customer-form/customer-form.component';
import type { CustomerFormValue } from '../../features/customers/ui/customer-form/customer-form.component';
import { PageLayoutComponent, type LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { LayoutService } from '../../core/services/layout/layout.service';

@Component({
  selector: 'app-customers-page',
  standalone: true,
  imports: [
    CommonModule,
    CustomerSearchComponent,
    CustomerListComponent,
    CustomerFormComponent
  ],
  templateUrl: './customers.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomersPage {
  private readonly customerService = inject(CustomerService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly authService = inject(AuthService);
  private readonly errorService = inject(HttpErrorService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutService = inject(LayoutService);

  protected readonly selectedCompanySignal = this.companyContext.selectedCompany;
  protected readonly companyId = computed(() => this.selectedCompanySignal()?. _id ?? null);
  
  protected readonly user = this.authService.user;
  protected readonly canManageCustomers = computed(() => {
    const role = this.user()?.role?.toLowerCase();
    return role === 'estimator' || role === 'administrator' || role === 'admin';
  });

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const company = this.selectedCompanySignal();
    return [
      { label: 'Choose the company', route: '/company' },
      { label: company?.name ?? 'Select company' },
      { label: 'Customers' }
    ];
  });

  protected readonly customers = signal<Customer[]>([]);
  protected readonly searchQuery = signal('');
  protected readonly suggestions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return [];
    }
    return this.customers()
      .filter((customer) => {
        const fullName = `${customer.name} ${customer.lastName}`.toLowerCase();
        return fullName.includes(query) || (customer.email ?? '').toLowerCase().includes(query);
      })
      .slice(0, 5)
      .map((customer) => `${customer.name} ${customer.lastName}`);
  });

  protected readonly filteredCustomers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return this.customers();
    }
    return this.customers().filter((customer) => {
      const fullName = `${customer.name} ${customer.lastName}`.toLowerCase();
      return (
        fullName.includes(query) ||
        (customer.email ?? '').toLowerCase().includes(query) ||
        (customer.city ?? '').toLowerCase().includes(query)
      );
    });
  });

  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly isLoadingList = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly isDeleting = signal(false);

  constructor() {
    // Actualizar breadcrumbs en el layout service
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs());
    });

    effect(() => {
      const id = this.companyId();
      if (!id) {
        void this.router.navigateByUrl('/company');
        return;
      }
      this.loadCustomers(id);
    });
  }

  protected handleSearchChange(value: string): void {
    this.searchQuery.set(value);
  }

  protected handleSuggestionSelected(value: string): void {
    this.searchQuery.set(value);
  }

  protected async handleSubmit(payload: CustomerFormValue): Promise<void> {
    const companyId = this.companyId();
    if (!companyId || !this.canManageCustomers()) {
      return;
    }

    this.isSubmitting.set(true);

    const mergedPayload: CustomerPayload = {
      ...payload,
      companyId,
      name: payload.name.trim(),
      lastName: payload.lastName.trim()
    };

    const customer = this.selectedCustomer();
    const request$ = customer
      ? this.customerService.updateCustomer(customer._id, mergedPayload)
      : this.customerService.createCustomer(mergedPayload);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          const verb = customer ? 'updated' : 'created';
          this.notificationService.success(`Customer ${verb}`, `${payload.name} ${payload.lastName}`);
          this.selectedCustomer.set(null);
          this.loadCustomers(companyId);
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Customer request failed', message);
        }
      });
  }

  protected editCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
  }

  protected cancelEdit(): void {
    this.selectedCustomer.set(null);
  }

  protected deleteCustomer(customer: Customer): void {
    if (this.isDeleting() || !this.canManageCustomers()) {
      return;
    }
    const confirmation = confirm(
      `Are you sure you want to remove ${customer.name} ${customer.lastName}?`
    );
    if (!confirmation) {
      return;
    }

    this.isDeleting.set(true);
    this.customerService
      .deleteCustomer(customer._id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.notificationService.info('Customer deleted', `${customer.name} ${customer.lastName}`);
          const companyId = this.companyId();
          if (companyId) {
            this.selectedCustomer.update((current) =>
              current && current._id === customer._id ? null : current
            );
            this.loadCustomers(companyId);
          }
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Delete failed', message);
        }
      });
  }

  private loadCustomers(companyId: string): void {
    this.isLoadingList.set(true);
    this.customerService
      .getCustomers(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoadingList.set(false)))
      .subscribe({
        next: (customers) => {
          this.customers.set(customers);
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Unable to load customers', message);
        }
      });
  }
}


