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
import { QuoteService } from '../../core/services/quote/quote.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { LayoutService } from '../../core/services/layout/layout.service';
import type { Quote } from '../../core/models/quote.model';

@Component({
  selector: 'app-quotes-page',
  standalone: true,
  imports: [CommonModule],
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
}

