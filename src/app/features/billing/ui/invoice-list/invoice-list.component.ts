import { CommonModule } from '@angular/common';
import type { OnInit} from '@angular/core';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InvoiceService } from '../../../../core/services/invoice/invoice.service';
import type { Invoice } from '../../../../core/models/invoice.model';
import type { LayoutBreadcrumb } from '../../../../shared/ui/page-layout/page-layout.component';
import { PageLayoutComponent } from '../../../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [CommonModule, RouterLink, PageLayoutComponent],
  templateUrl: './invoice-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceListComponent implements OnInit {
  private readonly invoiceService = inject(InvoiceService);
  private readonly router = inject(Router);

  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly isLoading = signal(true);
  
  protected readonly breadcrumbs: LayoutBreadcrumb[] = [
    { label: 'Invoices' }
  ];

  ngOnInit(): void {
    // Ideally filter by current user context (customer/company)
    // For now loading all (backend should filter based on user role/id)
    this.invoiceService.getInvoices().subscribe({
      next: (data) => {
        this.invoices.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
}

