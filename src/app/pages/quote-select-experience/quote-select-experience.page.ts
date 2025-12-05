import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CompanyContextService } from '../../core/services/company/company-context.service';
import { ProjectService } from '../../core/services/project/project.service';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { LayoutService } from '../../core/services/layout/layout.service';

@Component({
  selector: 'app-quote-select-experience-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quote-select-experience.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteSelectExperiencePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly layoutService = inject(LayoutService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly projectType = signal<string | null>(null);
  protected readonly quoteId = signal<string | null>(null);

  protected readonly selectedCompany = this.companyContext.selectedCompany;

  protected readonly experienceOptions = [
    { value: 'basic', label: 'Basic' },
    { value: 'premium', label: 'Premium' },
    { value: 'luxury', label: 'Luxury' }
  ];

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const company = this.selectedCompany();
    const projectId = this.projectId();
    return [
      { label: 'Choose the company', route: '/company' },
      { label: company?.name ?? '—', route: '/customers' },
      { label: 'Customers', route: '/customers' },
      { label: 'Project', route: projectId ? `/projects/${projectId}` : undefined },
      { label: 'Choose Your Experience' }
    ];
  });

  constructor() {
    // Actualizar breadcrumbs en el layout service
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs());
    });

    const projectId = this.route.snapshot.paramMap.get('projectId');
    const quoteId = this.route.snapshot.queryParamMap.get('quoteId');
    
    if (projectId) {
      this.projectId.set(projectId);
      this.loadProject(projectId);
    }

    if (quoteId) {
      this.quoteId.set(quoteId);
    }
  }

  protected selectExperience(experience: string): void {
    const projectId = this.projectId();
    const quoteId = this.quoteId();
    const projectType = this.projectType();

    if (!projectId) {
      return;
    }

    // Navegar a la página de creación con la experiencia seleccionada
    if (projectType === 'kitchen') {
      const url = quoteId
        ? `/projects/${projectId}/quotes/kitchen/create?experience=${experience}&quoteId=${quoteId}`
        : `/projects/${projectId}/quotes/kitchen/create?experience=${experience}`;
      void this.router.navigateByUrl(url);
    } else {
      // Para otros tipos de proyecto, manejar según corresponda
      void this.router.navigateByUrl(`/projects/${projectId}`);
    }
  }

  protected goBack(): void {
    const projectId = this.projectId();
    if (projectId) {
      void this.router.navigateByUrl(`/projects/${projectId}`);
    } else {
      void this.router.navigateByUrl('/customers');
    }
  }

  private loadProject(id: string): void {
    this.projectService.getProject(id).subscribe({
      next: (project) => {
        this.projectType.set(project.projectType?.toLowerCase().trim() ?? null);
      },
      error: () => {
        // Manejar error si es necesario
      }
    });
  }
}




