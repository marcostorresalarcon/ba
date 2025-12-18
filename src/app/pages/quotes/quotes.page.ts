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
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { CompanyContextService } from '../../core/services/company/company-context.service';
import { QuoteService } from '../../core/services/quote/quote.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { LayoutService } from '../../core/services/layout/layout.service';
import type { Quote, QuoteCategory } from '../../core/models/quote.model';

type CategoryFilter = QuoteCategory | 'all';

interface GroupedQuotes {
  category: QuoteCategory;
  quotes: Quote[];
}

@Component({
  selector: 'app-quotes-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quotes.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuotesPage {
  private readonly quoteService = inject(QuoteService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layoutService = inject(LayoutService);

  protected readonly selectedCompany = this.companyContext.selectedCompany;
  protected readonly isLoading = signal(true);
  protected readonly quotes = signal<Quote[]>([]);
  protected readonly categoryFilter = signal<CategoryFilter>('all');
  
  protected readonly categoryOptions: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'additional-work', label: 'Additional Work' },
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'basement', label: 'Basement' }
  ];

  protected readonly groupedQuotes = computed<GroupedQuotes[]>(() => {
    const filter = this.categoryFilter();
    let filteredQuotes = this.quotes();

    // Aplicar filtro si no es 'all'
    if (filter !== 'all') {
      filteredQuotes = filteredQuotes.filter(quote => quote.category === filter);
    }

    // Agrupar por categoría
    const grouped = new Map<QuoteCategory, Quote[]>();
    
    filteredQuotes.forEach(quote => {
      if (!grouped.has(quote.category)) {
        grouped.set(quote.category, []);
      }
      grouped.get(quote.category)!.push(quote);
    });

    // Convertir a array y ordenar cada grupo por fecha (mayor a menor)
    const result: GroupedQuotes[] = Array.from(grouped.entries()).map(([category, quotes]) => {
      // Ordenar por fecha de creación descendente (más reciente primero)
      const sorted = [...quotes].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      return { category, quotes: sorted };
    });

    // Ordenar los grupos por orden de categoría (kitchen, additional-work, bathroom, basement)
    const categoryOrder: Record<QuoteCategory, number> = {
      kitchen: 1,
      'additional-work': 2,
      bathroom: 3,
      basement: 4
    };

    return result.sort((a, b) => {
      const orderA = categoryOrder[a.category] ?? 999;
      const orderB = categoryOrder[b.category] ?? 999;
      return orderA - orderB;
    });
  });

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    return [
      { label: 'Dashboard', route: '/dashboard' },
      { label: 'Estimates' }
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
        this.loadQuotes(company._id);
      } else {
        this.router.navigate(['/company']);
      }
    });
  }

  private loadQuotes(companyId: string): void {
    this.isLoading.set(true);
    this.quoteService.getQuotes({ companyId })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (data) => {
          this.quotes.set(data);
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Error loading estimates', message);
        }
      });
  }

  protected viewQuote(quote: Quote): void {
    this.router.navigate(['/quotes', quote._id]);
  }

  protected getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      draft: 'bg-slate/20 text-slate',
      sent: 'bg-blue-500/20 text-blue-700',
      approved: 'bg-pine/20 text-pine',
      rejected: 'bg-red-500/20 text-red-700',
      in_progress: 'bg-yellow-500/20 text-yellow-700',
      completed: 'bg-green-600/20 text-green-700'
    };
    return colors[status] ?? 'bg-slate/20 text-slate';
  }

  protected getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      kitchen: 'Kitchen',
      bathroom: 'Bathroom',
      basement: 'Basement',
      'additional-work': 'Additional Work'
    };
    return labels[category] ?? category;
  }
}

