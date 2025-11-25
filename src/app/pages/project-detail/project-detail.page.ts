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

import type { Project } from '../../core/models/project.model';
import type { Quote } from '../../core/models/quote.model';
import { ProjectService } from '../../core/services/project/project.service';
import { QuoteService } from '../../core/services/quote/quote.service';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { PageLayoutComponent, type LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { QuoteListComponent } from '../../features/quotes/ui/quote-list/quote-list.component';

@Component({
  selector: 'app-project-detail-page',
  standalone: true,
  imports: [CommonModule, PageLayoutComponent, QuoteListComponent],
  templateUrl: './project-detail.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly quoteService = inject(QuoteService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly errorService = inject(HttpErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationService = inject(NotificationService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly quotes = signal<Quote[]>([]);
  protected readonly isLoadingProject = signal(true);
  protected readonly isLoadingQuotes = signal(true);
  protected readonly showQuoteForm = signal(false);

  protected readonly selectedCompany = this.companyContext.selectedCompany;
  protected readonly companyId = computed(() => this.selectedCompany()?._id ?? null);
  protected readonly isReadOnly = signal(false);

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const company = this.selectedCompany();
    const project = this.project();
    return [
      { label: 'Choose the company', route: '/company' },
      { label: company?.name ?? '—', route: '/customers' },
      { label: 'Customers', route: '/customers' },
      { label: project?.name ?? 'Project' }
    ];
  });

  constructor() {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (projectId) {
      this.projectId.set(projectId);
      this.loadProject(projectId);
    }

    effect(() => {
      const id = this.projectId();
      if (id) {
        this.loadQuotes(id);
      }
    });
  }

  protected toggleQuoteForm(): void {
    const projectId = this.projectId();
    const project = this.project();

    console.log('toggleQuoteForm called', { projectId, project, projectType: project?.projectType });

    if (!projectId) {
      this.notificationService.error('Error', 'Project ID is missing');
      return;
    }

    if (!project) {
      this.notificationService.error('Error', 'Project information is not available');
      return;
    }

    const projectType = project.projectType?.toLowerCase().trim();
    console.log('Project type:', projectType);

    if (projectType === 'kitchen') {
      // Navegar primero a la página de selección de experiencia
      const url = `/projects/${projectId}/quotes/select-experience`;
      console.log('Navigating to:', url);
      void this.router.navigateByUrl(url);
    } else if (projectType === 'additional-work') {
      // Navegar directo al formulario de additional work (no necesita experiencia)
      const url = `/projects/${projectId}/quotes/additional-work/create`;
      console.log('Navigating to:', url);
      void this.router.navigateByUrl(url);
    } else {
      // For other project types, show form or navigate accordingly
      this.showQuoteForm.set(!this.showQuoteForm());
      this.notificationService.info('Coming soon', `Estimate form for ${projectType ?? 'this project type'} is not yet available`);
    }
  }

  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  protected formatProjectType(projectType?: string): string {
    if (!projectType) return '';
    const typeMap: Record<string, string> = {
      kitchen: 'Kitchen',
      bathroom: 'Bathroom',
      basement: 'Basement',
      'additional-work': 'Additional Work'
    };
    return typeMap[projectType] ?? projectType.replace('_', ' ').replace('-', ' ');
  }

  private loadProject(id: string): void {
    this.isLoadingProject.set(true);

    this.projectService
      .getProject(id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoadingProject.set(false)))
      .subscribe({
        next: (project) => this.project.set(project),
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Unable to load project', message);
          void this.router.navigateByUrl('/customers');
        }
      });
  }

  private loadQuotes(projectId: string): void {
    this.isLoadingQuotes.set(true);

    this.quoteService
      .getQuotesByProject(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.isLoadingQuotes.set(false)))
      .subscribe({
        next: (quotes) => {
          // Ordenar por versionNumber descendente (última versión primero)
          const sortedQuotes = [...quotes].sort((a, b) => {
            // Primero por versionNumber descendente
            if (b.versionNumber !== a.versionNumber) {
              return b.versionNumber - a.versionNumber;
            }
            // Si tienen la misma versión, ordenar por fecha de creación descendente
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          this.quotes.set(sortedQuotes);
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Unable to load estimates', message);
        }
      });
  }

  protected handleEditQuote(quote: Quote): void {
    const projectId = this.projectId();
    if (!projectId) {
      this.notificationService.error('Error', 'Project ID is missing');
      return;
    }

    const project = this.project();
    if (!project) {
      this.notificationService.error('Error', 'Project information is not available');
      return;
    }

    const projectType = project.projectType?.toLowerCase().trim();

    // Para nueva versión, ir directo al formulario con el experience del quote original
    // No pasar por la selección de experience
    if (projectType === 'kitchen') {
      // Obtener el experience del quote original
      const experience = quote.experience || 'basic';
      // Navegar directo al formulario con el quoteId y experience
      void this.router.navigateByUrl(`/projects/${projectId}/quotes/kitchen/create?experience=${experience}&quoteId=${quote._id}`);
    } else if (projectType === 'additional-work') {
      // Navegar directo al formulario de additional work con el quoteId
      void this.router.navigateByUrl(`/projects/${projectId}/quotes/additional-work/create?quoteId=${quote._id}`);
    } else {
      this.notificationService.info('Coming soon', `Edit form for ${projectType ?? 'this project type'} is not yet available`);
    }
  }

  protected handleDeleteQuote(quote: Quote): void {
    const confirmed = confirm(`¿Estás seguro de que deseas eliminar el estimado v${quote.versionNumber}? Esta acción no se puede deshacer.`);

    if (!confirmed) {
      return;
    }

    this.quoteService
      .deleteQuote(quote._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Estimado eliminado correctamente');
          // Recargar la lista de quotes
          const projectId = this.projectId();
          if (projectId) {
            this.loadQuotes(projectId);
          }
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Error', message);
        }
      });
  }

  protected handleViewInvoices(quote: Quote): void {
    void this.router.navigate(['/quotes', quote._id]);
  }
}

