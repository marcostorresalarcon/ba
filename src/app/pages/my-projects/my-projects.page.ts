import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth/auth.service';
import { ProjectService } from '../../core/services/project/project.service';
import { QuoteService } from '../../core/services/quote/quote.service';
import { CustomerService } from '../../core/services/customer/customer.service';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { ProjectListComponent } from '../../features/projects/ui/project-list/project-list.component';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { LayoutService } from '../../core/services/layout/layout.service';
import type { ProjectWithQuoteCount } from '../../core/models/project.model';

@Component({
  selector: 'app-my-projects-page',
  standalone: true,
  imports: [CommonModule, ProjectListComponent],
  templateUrl: './my-projects.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyProjectsPage {
  private readonly authService = inject(AuthService);
  private readonly projectService = inject(ProjectService);
  private readonly quoteService = inject(QuoteService);
  private readonly customerService = inject(CustomerService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly errorService = inject(HttpErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutService = inject(LayoutService);

  protected readonly projects = signal<ProjectWithQuoteCount[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly selectedCompany = this.companyContext.selectedCompany;

  protected readonly breadcrumbs: LayoutBreadcrumb[] = [
    { label: 'My Projects' }
  ];

  constructor() {
    // Actualizar breadcrumbs en el layout service
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs);
    });

    effect(() => {
      const company = this.selectedCompany();
      const user = this.authService.user();

      if (company && user && user.role?.toLowerCase() === 'customer') {
        // Verificar si ya tenemos el customerId para esta compañía
        const customerInfo = user.customerInfo;
        
        if (customerInfo && customerInfo.companyId === company._id) {
          // Ya tenemos la información del customer para esta compañía
          this.loadProjects(customerInfo._id, company._id);
        } else {
          // Necesitamos obtener la información del customer
          this.resolveCustomerAndLoadProjects(user, company._id);
        }
      }
    });
  }

  private resolveCustomerAndLoadProjects(user: { id: string; email: string }, companyId: string): void {
    this.isLoading.set(true);

    // Primero intentar buscar por userId
    this.customerService
      .getCustomerByUserId(user.id, companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customer) => {
          if (customer) {
            this.updateUserWithCustomerInfo(customer, companyId);
            this.loadProjects(customer._id, companyId);
          } else {
            // Si no se encuentra por userId, buscar por email
            this.customerService
              .getCustomerByEmail(user.email, companyId)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (customerByEmail) => {
                  if (customerByEmail) {
                    this.updateUserWithCustomerInfo(customerByEmail, companyId);
                    this.loadProjects(customerByEmail._id, companyId);
                  } else {
                    this.isLoading.set(false);
                    this.notificationService.error(
                      'Access issue',
                      'Could not find a customer profile associated with your account for this company.'
                    );
                  }
                },
                error: (error) => {
                  this.isLoading.set(false);
                  const message = this.errorService.handle(error);
                  this.notificationService.error('Unable to verify customer profile', message);
                }
              });
          }
        },
        error: (error) => {
          // Si falla la búsqueda por userId, intentar por email
          this.customerService
            .getCustomerByEmail(user.email, companyId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (customerByEmail) => {
                if (customerByEmail) {
                  this.updateUserWithCustomerInfo(customerByEmail, companyId);
                  this.loadProjects(customerByEmail._id, companyId);
                } else {
                  this.isLoading.set(false);
                  const message = this.errorService.handle(error);
                  this.notificationService.error('Unable to verify customer profile', message);
                }
              },
              error: (emailError) => {
                this.isLoading.set(false);
                const message = this.errorService.handle(emailError);
                this.notificationService.error('Unable to verify customer profile', message);
              }
            });
        }
      });
  }

  private updateUserWithCustomerInfo(customer: { _id: string; name: string; lastName: string; email?: string; companyId: string }, companyId: string): void {
    const currentUser = this.authService.user();
    if (!currentUser) {
      return;
    }

    const updatedUser = {
      ...currentUser,
      customerId: customer._id,
      customerInfo: {
        _id: customer._id,
        name: customer.name,
        lastName: customer.lastName,
        email: customer.email,
        companyId: companyId
      }
    };

    this.authService.updateUser(updatedUser);
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
          this.notificationService.error('Unable to load your projects', message);
        }
      });
  }
}

