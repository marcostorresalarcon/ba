import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { QuoteCategory } from '../../core/models/quote.model';
import { CompanyContextService } from '../../core/services/company/company-context.service';
import { ProjectService } from '../../core/services/project/project.service';
import { PageLayoutComponent, type LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-quote-select-category-page',
  standalone: true,
  imports: [CommonModule, PageLayoutComponent],
  templateUrl: './quote-select-category.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteSelectCategoryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly companyContext = inject(CompanyContextService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly quoteId = signal<string | null>(null);

  protected readonly selectedCompany = this.companyContext.selectedCompany;

  protected readonly categoryOptions: { value: QuoteCategory; label: string; description: string; icon: string }[] = [
    { 
      value: 'kitchen', 
      label: 'Kitchen', 
      description: 'Kitchen remodeling and design estimates',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    { 
      value: 'bathroom', 
      label: 'Bathroom', 
      description: 'Bathroom renovation and design estimates',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
    },
    { 
      value: 'basement', 
      label: 'Basement', 
      description: 'Basement finishing and remodeling estimates',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
    },
    { 
      value: 'additional-work', 
      label: 'Additional Work', 
      description: 'Other construction and renovation work',
      icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
    }
  ];

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const company = this.selectedCompany();
    const projectId = this.projectId();
    return [
      { label: 'Choose the company', route: '/company' },
      { label: company?.name ?? '—', route: '/customers' },
      { label: 'Customers', route: '/customers' },
      { label: 'Project', route: projectId ? `/projects/${projectId}` : undefined },
      { label: 'Select Estimate Type' }
    ];
  });

  constructor() {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    const quoteId = this.route.snapshot.queryParamMap.get('quoteId');
    
    if (projectId) {
      this.projectId.set(projectId);
    } else {
      void this.router.navigateByUrl('/customers');
    }

    if (quoteId) {
      this.quoteId.set(quoteId);
    }
  }

  protected selectCategory(category: QuoteCategory): void {
    const projectId = this.projectId();
    const quoteId = this.quoteId();

    if (!projectId) {
      return;
    }

    // Para kitchen, primero seleccionar experiencia
    if (category === 'kitchen') {
      const url = quoteId
        ? `/projects/${projectId}/quotes/select-experience?quoteId=${quoteId}`
        : `/projects/${projectId}/quotes/select-experience`;
      void this.router.navigateByUrl(url);
    } else {
      // Para otras categorías, ir directo al formulario
      const url = quoteId
        ? `/projects/${projectId}/quotes/${category}/create?quoteId=${quoteId}`
        : `/projects/${projectId}/quotes/${category}/create`;
      void this.router.navigateByUrl(url);
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
}

