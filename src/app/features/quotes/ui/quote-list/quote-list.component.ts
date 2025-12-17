import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, computed, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RouterLink } from '@angular/router';
import type { Quote, QuoteCategory } from '../../../../core/models/quote.model';

type CategoryFilter = QuoteCategory | 'all';

interface GroupedQuotes {
  category: QuoteCategory;
  quotes: Quote[];
}

@Component({
  selector: 'app-quote-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './quote-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteListComponent {
  @Input({ required: true }) set quotes(value: Quote[]) {
    this.quotesSignal.set(value);
  }
  get quotes(): Quote[] {
    return this.quotesSignal();
  }
  @Input({ required: true }) isLoading = false;
  @Input() readonly = false;
  @Output() readonly createQuote = new EventEmitter<void>();
  @Output() readonly editQuote = new EventEmitter<Quote>();
  @Output() readonly deleteQuote = new EventEmitter<Quote>();
  @Output() readonly viewInvoices = new EventEmitter<Quote>();

  protected readonly quotesSignal = signal<Quote[]>([]);
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
    let filteredQuotes = this.quotesSignal();

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

  protected trackById(_: number, quote: Quote): string {
    return quote._id;
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

  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  protected onEditQuote(quote: Quote, event: Event): void {
    event.stopPropagation();
    this.editQuote.emit(quote);
  }

  protected onDeleteQuote(quote: Quote, event: Event): void {
    event.stopPropagation();
    this.deleteQuote.emit(quote);
  }

  protected onViewInvoices(quote: Quote, event: Event): void {
    event.stopPropagation();
    this.viewInvoices.emit(quote);
  }
}
