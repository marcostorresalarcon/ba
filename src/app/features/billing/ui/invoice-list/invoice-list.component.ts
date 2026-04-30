import { CommonModule } from '@angular/common';
import type { OnInit} from '@angular/core';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InvoiceService } from '../../../../core/services/invoice/invoice.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { LayoutService } from '../../../../core/services/layout/layout.service';
import type { Invoice } from '../../../../core/models/invoice.model';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './invoice-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceListComponent implements OnInit {
  private readonly invoiceService = inject(InvoiceService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);

  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly isLoading = signal(true);

  constructor() {
    this.layoutService.setBreadcrumbs([{ label: 'Invoices' }]);
  }

  ngOnInit(): void {
    const user = this.authService.user();
    const isCustomer = user?.role === 'customer';

    const customerId = user?.customerId || user?.customerInfo?._id;

    if (isCustomer && !customerId) {
      this.invoices.set([]);
      this.isLoading.set(false);
      return;
    }

    const filters = isCustomer && customerId ? { customerId } : {};

    this.invoiceService.getInvoices(filters).subscribe({
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

