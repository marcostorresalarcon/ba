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
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import type { Customer } from '../../core/models/customer.model';
import type { ProjectPayload, ProjectWithQuoteCount } from '../../core/models/project.model';
import { CustomerService } from '../../core/services/customer/customer.service';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { ProjectService } from '../../core/services/project/project.service';
import { QuoteService } from '../../core/services/quote/quote.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { LayoutService } from '../../core/services/layout/layout.service';
import { ProjectListComponent } from '../../features/projects/ui/project-list/project-list.component';
import { ProjectFormComponent, type ProjectFormValue } from '../../features/projects/ui/project-form/project-form.component';

@Component({
  selector: 'app-customer-projects-page',
  standalone: true,
  imports: [CommonModule, ProjectListComponent, ProjectFormComponent],
  templateUrl: './customer-projects.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerProjectsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly quoteService = inject(QuoteService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly errorService = inject(HttpErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutService = inject(LayoutService);

  protected readonly customerId = signal<string | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly projects = signal<ProjectWithQuoteCount[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly showForm = signal(false);
  protected readonly selectedProject = signal<ProjectWithQuoteCount | null>(null);

  protected readonly selectedCompany = this.companyContext.selectedCompany;
  protected readonly companyId = computed(() => this.selectedCompany()?._id ?? null);

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const company = this.selectedCompany();
    const customer = this.customer();
    return [
      { label: 'Choose the company', route: '/company' },
      { label: company?.name ?? '—', route: '/customers' },
      { label: 'Customers', route: '/customers' },
      { label: customer ? `${customer.name} ${customer.lastName}` : 'Customer' }
    ];
  });

  constructor() {
    // Actualizar breadcrumbs en el layout service
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs());
    });

    const customerId = this.route.snapshot.paramMap.get('customerId');
    if (customerId) {
      this.customerId.set(customerId);
      this.loadCustomer(customerId);
    }

    effect(() => {
      const id = this.customerId();
      const companyId = this.companyId();
      if (id && companyId) {
        this.loadProjects(id, companyId);
      }
    });
  }

  protected toggleForm(): void {
    this.showForm.set(!this.showForm());
    if (!this.showForm()) {
      this.selectedProject.set(null);
    }
  }

  protected editProject(project: ProjectWithQuoteCount): void {
    this.selectedProject.set(project);
    this.showForm.set(true);
  }

  protected deleteProject(project: ProjectWithQuoteCount): void {
    if (this.isDeleting()) {
      return;
    }

    const confirmation = confirm(
      `Are you sure you want to delete "${project.name}"? This action cannot be undone.`
    );
    if (!confirmation) {
      return;
    }

    this.isDeleting.set(true);
    this.projectService
      .deleteProject(project._id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: () => {
          this.notificationService.info('Project deleted', project.name);
          const companyId = this.companyId();
          const customerId = this.customerId();
          if (companyId && customerId) {
            this.loadProjects(customerId, companyId);
          }
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Failed to delete project', message);
        }
      });
  }

  protected async handleSubmit(payload: ProjectFormValue): Promise<void> {
    const companyId = this.companyId();
    const customerId = this.customerId();
    if (!companyId || !customerId) {
      return;
    }

    const user = this.getCurrentUser();
    if (!user) {
      this.notificationService.error('Authentication required', 'Please sign in again');
      return;
    }

    const project = this.selectedProject();
    this.isSubmitting.set(true);

    if (project) {
      const updatePayload: Partial<ProjectPayload> = {
        name: payload.name.trim(),
        description: payload.description.trim() || undefined,
        projectType: payload.projectType
      };

      this.projectService
        .updateProject(project._id, updatePayload)
        .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isSubmitting.set(false)))
        .subscribe({
          next: () => {
            this.notificationService.success('Project updated', payload.name);
            this.showForm.set(false);
            this.selectedProject.set(null);
            this.loadProjects(customerId, companyId);
          },
          error: (error) => {
            const message = this.errorService.handle(error);
            this.notificationService.error('Failed to update project', message);
          }
        });
    } else {
      const projectPayload: ProjectPayload = {
        name: payload.name.trim(),
        description: payload.description.trim() || undefined,
        projectType: payload.projectType,
        companyId,
        customerId,
        estimatorId: user.id,
        status: 'pending'
      };

      this.projectService
        .createProject(projectPayload)
        .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isSubmitting.set(false)))
        .subscribe({
          next: () => {
            this.notificationService.success('Project created', payload.name);
            this.showForm.set(false);
            this.loadProjects(customerId, companyId);
          },
          error: (error) => {
            const message = this.errorService.handle(error);
            this.notificationService.error('Failed to create project', message);
          }
        });
    }
  }

  private loadCustomer(id: string): void {
    this.customerService
      .getCustomer(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customer) => this.customer.set(customer),
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Unable to load customer', message);
        }
      });
  }

  private loadProjects(customerId: string, companyId: string): void {
    this.isLoading.set(true);

    this.projectService
      .getProjects({ customerId, companyId })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (projects) => {
          const projectsWithCounts: ProjectWithQuoteCount[] = projects.map((project) => ({
            ...project,
            quoteCount: 0
          }));
          this.projects.set(projectsWithCounts);

          projects.forEach((project, index) => {
            this.quoteService
              .getQuotesByProject(project._id)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (quotes) => {
                  const updated = [...this.projects()];
                  updated[index] = { ...updated[index], quoteCount: quotes.length };
                  this.projects.set(updated);
                }
              });
          });
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Unable to load projects', message);
        }
      });
  }

  private getCurrentUser(): { id: string } | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as { id: string };
    } catch {
      return null;
    }
  }
}

