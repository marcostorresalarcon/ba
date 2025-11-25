import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import type { Project } from '../../core/models/project.model';
import type { Customer } from '../../core/models/customer.model';
import { ProjectService } from '../../core/services/project/project.service';
import { CustomerService } from '../../core/services/customer/customer.service';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { PageLayoutComponent, type LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { KitchenQuoteFormComponent } from '../../features/quotes/ui/kitchen-quote-form/kitchen-quote-form.component';

@Component({
  selector: 'app-quote-create-kitchen-page',
  standalone: true,
  imports: [CommonModule, PageLayoutComponent, KitchenQuoteFormComponent],
  templateUrl: './quote-create-kitchen.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteCreateKitchenPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly errorService = inject(HttpErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly isLoadingProject = signal(true);
  protected readonly isLoadingCustomer = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly selectedExperience = signal<string | null>(null);
  protected readonly quoteId = signal<string | null>(null);

  protected readonly selectedCompany = this.companyContext.selectedCompany;
  protected readonly companyId = computed(() => this.selectedCompany()?._id ?? null);

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const company = this.selectedCompany();
    const project = this.project();
    return [
      { label: 'Choose the company', route: '/company' },
      { label: company?.name ?? '—', route: '/customers' },
      { label: 'Customers', route: '/customers' },
      { label: project?.name ?? 'Project', route: `/projects/${this.projectId() ?? ''}` },
      { label: 'Create Kitchen Estimate' }
    ];
  });

  constructor() {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    const experience = this.route.snapshot.queryParamMap.get('experience');
    const quoteId = this.route.snapshot.queryParamMap.get('quoteId');
    
    if (projectId) {
      this.projectId.set(projectId);
      this.loadProject(projectId);
    } else {
      this.notificationService.error('Invalid project', 'Project ID is required');
      void this.router.navigateByUrl('/customers');
    }

    if (quoteId) {
      this.quoteId.set(quoteId);
    }

    if (experience) {
      this.selectedExperience.set(experience);
    } else {
      // Si no hay experiencia seleccionada y no es una nueva versión (quoteId),
      // redirigir a la página de selección
      // Si es una nueva versión, el experience se cargará del quote en el formulario
      if (projectId && !quoteId) {
        void this.router.navigateByUrl(`/projects/${projectId}/quotes/select-experience`);
      }
    }
  }

  private loadProject(id: string): void {
    this.isLoadingProject.set(true);

    this.projectService
      .getProject(id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoadingProject.set(false)))
      .subscribe({
        next: (project) => {
          this.project.set(project);
          if (project.customerId) {
            this.loadCustomer(project.customerId);
          }
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Unable to load project', message);
          void this.router.navigateByUrl('/customers');
        }
      });
  }

  private loadCustomer(id: string): void {
    this.isLoadingCustomer.set(true);

    this.customerService
      .getCustomer(id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoadingCustomer.set(false)))
      .subscribe({
        next: (customer) => this.customer.set(customer),
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Unable to load customer', message);
        }
      });
  }

  protected handleSubmit(_formValue: unknown): void {
    // This will be handled by the form component
    this.isSubmitting.set(true);
  }

  protected handleCancel(): void {
    const projectId = this.projectId();
    if (projectId) {
      void this.router.navigateByUrl(`/projects/${projectId}`);
    } else {
      void this.router.navigateByUrl('/customers');
    }
  }
}

