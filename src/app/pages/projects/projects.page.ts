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

import { CompanyContextService } from '../../core/services/company/company-context.service';
import { ProjectService } from '../../core/services/project/project.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { ProjectListComponent } from '../../features/projects/ui/project-list/project-list.component';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { LayoutService } from '../../core/services/layout/layout.service';
import type { ProjectWithQuoteCount } from '../../core/models/project.model';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, ProjectListComponent],
  templateUrl: './projects.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsPage {
  private readonly projectService = inject(ProjectService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layoutService = inject(LayoutService);

  protected readonly selectedCompany = this.companyContext.selectedCompany;
  protected readonly isLoading = signal(true);
  protected readonly projects = signal<ProjectWithQuoteCount[]>([]);

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const company = this.selectedCompany();
    return [
      { label: 'Dashboard', route: '/dashboard' },
      { label: 'Projects' }
    ];
  });

  constructor() {
    // Actualizar breadcrumbs en el layout service
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs());
    });

    effect(() => {
      const company = this.selectedCompany();
      if (company) {
        this.loadProjects(company._id);
      } else {
        // Redirect if no company selected, or handle global admin view
        // For now assuming context is required or handled by guard, but here we can list all if API supports it
        // If admin can see all projects from all companies, we might not need companyId, but let's stick to context for now
        // If company is null, maybe redirect to company selection
        this.router.navigate(['/company']);
      }
    });
  }

  private loadProjects(companyId: string): void {
    this.isLoading.set(true);
    this.projectService.getProjects({ companyId })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (data) => {
          // Cast to ProjectWithQuoteCount if backend returns it, otherwise it's Project[]
          // The ProjectListComponent expects ProjectWithQuoteCount
          // If backend doesn't return quoteCount, we might need to map or update backend
          // Assuming backend returns Project[] compatible or we cast
          this.projects.set(data as ProjectWithQuoteCount[]);
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Error loading projects', message);
        }
      });
  }

  // Admin likely won't create projects from here directly unless we add the flow
  // Usually projects are created under a Customer
  // So we just view/edit/delete
  
  protected editProject(project: ProjectWithQuoteCount): void {
    // Admin might want to edit project details
    // Navigate to project detail or open modal?
    // Reusing existing pattern: navigate to detail
    this.router.navigate(['/projects', project._id]);
  }

  protected deleteProject(project: ProjectWithQuoteCount): void {
    if (!confirm(`Are you sure you want to delete project "${project.name}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.projectService.deleteProject(project._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Project deleted', project.name);
          // Reload
          const company = this.selectedCompany();
          if (company) this.loadProjects(company._id);
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Error deleting project', message);
        }
      });
  }
}

