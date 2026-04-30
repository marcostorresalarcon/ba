import { CommonModule } from '@angular/common';
import type { OnInit} from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
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
import { LayoutService } from '../../../../core/services/layout/layout.service';
import type { Invoice, InvoicePaymentPlan } from '../../../../core/models/invoice.model';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import type { LayoutBreadcrumb } from '../../../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, PaymentModalComponent],
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
  private readonly layoutService = inject(LayoutService);

  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isGeneratingPdf = signal(false);

  protected readonly paymentModalOpen = signal(false);
  protected readonly selectedInstallment = signal<{ amount: number; index: number; name: string } | null>(null);

  protected readonly isEstimator = computed(() => this.authService.user()?.role === 'estimator');
  protected readonly canDelete = computed(() => {
    const role = this.authService.user()?.role;
    return role !== 'customer' && role !== 'estimator';
  });
  protected readonly isDeleting = signal(false);
  protected readonly generatingInstallmentIndex = signal<number | null>(null);

  protected readonly breadcrumbs = computed<LayoutBreadcrumb[]>(() => {
    const inv = this.invoice();
    if (!inv) return [{ label: 'Invoices', route: '/invoices' }];
    return [
      { label: 'Invoices', route: '/invoices' },
      { label: inv.invoiceNumber }
    ];
  });

  constructor() {
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs());
    });
  }

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

  private async loadPdfData(inv: Invoice) {
    const custId = typeof inv.customerId === 'string' ? inv.customerId : (inv.customerId as any)._id;
    const projId: any = inv.projectId;
    const projIdStr = projId && typeof projId === 'object' && projId._id ? projId._id : String(projId);
    const quoteId: any = inv.quoteId;
    const quoteIdStr = quoteId && typeof quoteId === 'object' && quoteId._id ? quoteId._id : String(quoteId);

    return firstValueFrom(
      forkJoin([
        this.customerService.getCustomer(custId),
        this.projectService.getProject(projIdStr),
        this.quoteService.getQuote(quoteIdStr),
      ])
    );
  }

  async downloadPdf(): Promise<void> {
    const inv = this.invoice();
    if (!inv) return;

    this.isGeneratingPdf.set(true);
    try {
      const [customer, project, quote] = await this.loadPdfData(inv);
      const groupedInputs = this.kitchenInputsService.getOrderedGroupedInputs(quote.experience);
      await this.pdfService.generateInvoicePdf(inv, customer, project, null, quote, groupedInputs, this.authService.user()?.role);
      this.notificationService.success('Success', 'PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.notificationService.error('Error', 'Could not generate PDF');
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  async downloadInstallmentPdf(installmentIndex: number): Promise<void> {
    const inv = this.invoice();
    if (!inv || !inv.paymentPlan[installmentIndex]) return;

    this.generatingInstallmentIndex.set(installmentIndex);
    try {
      const [customer, project, quote] = await this.loadPdfData(inv);
      const groupedInputs = this.kitchenInputsService.getOrderedGroupedInputs(quote.experience);
      await this.pdfService.generateInstallmentPdf(inv, installmentIndex, customer, project, null, quote, groupedInputs, this.authService.user()?.role);
      this.notificationService.success('Success', 'PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating installment PDF:', error);
      this.notificationService.error('Error', 'Could not generate PDF');
    } finally {
      this.generatingInstallmentIndex.set(null);
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
      this.loadInvoice(this.invoice()!._id);
    }
  }

  deleteInvoice(): void {
    const inv = this.invoice();
    if (!inv) return;
    if (!confirm(`Delete invoice ${inv.invoiceNumber}? This cannot be undone.`)) return;

    this.isDeleting.set(true);
    this.invoiceService.deleteInvoice(inv._id).subscribe({
      next: () => {
        this.notificationService.success('Deleted', 'Invoice deleted successfully');
        this.router.navigate(['/invoices']);
      },
      error: () => {
        this.notificationService.error('Error', 'Could not delete invoice');
        this.isDeleting.set(false);
      }
    });
  }
}

