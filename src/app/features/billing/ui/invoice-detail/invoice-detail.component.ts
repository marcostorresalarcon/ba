import { CommonModule } from '@angular/common';
import type { OnInit} from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { InvoiceService } from '../../../../core/services/invoice/invoice.service';
import { NotificationService } from '../../../../core/services/notification/notification.service';
import { CustomerService } from '../../../../core/services/customer/customer.service';
import { ProjectService } from '../../../../core/services/project/project.service';
import { QuoteService } from '../../../../core/services/quote/quote.service';
import { PdfService } from '../../../../core/services/pdf/pdf.service';
import { KitchenInputsService } from '../../../../core/services/kitchen-inputs/kitchen-inputs.service';
import type { Invoice, InvoicePaymentPlan } from '../../../../core/models/invoice.model';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import type { LayoutBreadcrumb } from '../../../../shared/ui/page-layout/page-layout.component';
import { PageLayoutComponent } from '../../../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, PaymentModalComponent, PageLayoutComponent],
  templateUrl: './invoice-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceDetailComponent implements OnInit {
  private readonly invoiceService = inject(InvoiceService);
  private readonly authService = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly quoteService = inject(QuoteService);
  private readonly pdfService = inject(PdfService);
  private readonly kitchenInputsService = inject(KitchenInputsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isGeneratingPdf = signal(false);
  
  protected readonly paymentModalOpen = signal(false);
  protected readonly selectedInstallment = signal<{ amount: number; index: number; name: string } | null>(null);

  protected readonly isEstimator = computed(() => this.authService.user()?.role === 'estimator');

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const inv = this.invoice();
    if (!inv) return [{ label: 'Invoices', route: '/invoices' }];
    return [
      { label: 'Invoices', route: '/invoices' },
      { label: `Invoice #${inv.number}` }
    ];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadInvoice(id);
    } else {
      this.router.navigate(['/']);
    }
  }

  private loadInvoice(id: string): void {
    this.isLoading.set(true);
    this.invoiceService.getInvoice(id).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.isLoading.set(false);
      },
      error: () => {
        this.notificationService.error('Error', 'Could not load invoice');
        this.isLoading.set(false);
      }
    });
  }

  async downloadPdf(): Promise<void> {
    const inv = this.invoice();
    if (!inv) return;

    this.isGeneratingPdf.set(true);
    try {
      // Handle customerId: could be string or object
      let customerObservable;
      if (typeof inv.customerId === 'string') {
        customerObservable = this.customerService.getCustomer(inv.customerId);
      } else {
        customerObservable = this.customerService.getCustomer(inv.customerId._id);
      }

      // Handle projectId: could be string or object
      let projectObservable;
      const projId: any = inv.projectId;
      if (projId && typeof projId === 'object' && projId._id) {
         projectObservable = this.projectService.getProject(projId._id);
      } else {
         projectObservable = this.projectService.getProject(String(projId));
      }

      // Handle Quote
      let quoteObservable;
      const quoteId: any = inv.quoteId;
      if (quoteId && typeof quoteId === 'object' && quoteId._id) {
         // If populated, use ID to fetch fresh/full data or just to be safe with URL
         quoteObservable = this.quoteService.getQuote(quoteId._id);
      } else {
         quoteObservable = this.quoteService.getQuote(String(quoteId));
      }

      const [customer, project, quote] = await firstValueFrom(
        forkJoin([
          customerObservable,
          projectObservable,
          quoteObservable
        ])
      );

      // Prepare groupedInputs for Quote details
      const groupedInputs = this.kitchenInputsService.getOrderedGroupedInputs(quote.experience);

      await this.pdfService.generateInvoicePdf(inv, customer, project, null, quote, groupedInputs);
      this.notificationService.success('Success', 'PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.notificationService.error('Error', 'Could not generate PDF');
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  openPayment(installment: InvoicePaymentPlan, index: number): void {
    if (this.isEstimator()) {
      return;
    }
    
    this.selectedInstallment.set({
      amount: installment.amount,
      index: index,
      name: installment.name
    });
    this.paymentModalOpen.set(true);
  }

  handlePaymentResult(result: 'success' | 'cancel'): void {
    this.paymentModalOpen.set(false);
    this.selectedInstallment.set(null);
    if (result === 'success' && this.invoice()) {
      // Reload invoice to update status
      this.loadInvoice(this.invoice()!._id);
    }
  }
}

