import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';

import { RouterLink } from '@angular/router';
import type { Quote } from '../../../../core/models/quote.model';

@Component({
  selector: 'app-quote-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './quote-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteListComponent {
  @Input({ required: true }) quotes: Quote[] = [];
  @Input({ required: true }) isLoading = false;
  @Input() readonly = false;
  @Output() readonly createQuote = new EventEmitter<void>();
  @Output() readonly editQuote = new EventEmitter<Quote>();
  @Output() readonly deleteQuote = new EventEmitter<Quote>();
  @Output() readonly viewInvoices = new EventEmitter<Quote>();

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
