import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { CompanyContextService } from '../../core/services/company/company-context.service';
import { KpiService } from '../../core/services/kpi/kpi.service';
import { CustomerService } from '../../core/services/customer/customer.service';
import { ProjectService } from '../../core/services/project/project.service';
import { QuoteService } from '../../core/services/quote/quote.service';
import { InvoiceService } from '../../core/services/invoice/invoice.service';
import { PaymentService } from '../../core/services/payment/payment.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';
import { LayoutService } from '../../core/services/layout/layout.service';
import type { KpiResponse, InvoiceKpiResponse } from '../../core/models/kpi.model';
import type { Customer } from '../../core/models/customer.model';
import type { Project } from '../../core/models/project.model';
import type { Quote } from '../../core/models/quote.model';
import type { Invoice } from '../../core/models/invoice.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardPage {
  private readonly companyContext = inject(CompanyContextService);
  private readonly kpiService = inject(KpiService);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly quoteService = inject(QuoteService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly paymentService = inject(PaymentService);
  private readonly errorService = inject(HttpErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);

  protected readonly kpis = signal<KpiResponse | null>(null);
  protected readonly invoiceKpis = signal<InvoiceKpiResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly selectedCompany = this.companyContext.selectedCompany;

  protected readonly recentCustomers = signal<Customer[]>([]);
  protected readonly recentProjects = signal<Project[]>([]);
  protected readonly recentQuotes = signal<Quote[]>([]);
  protected readonly recentInvoices = signal<any[]>([]);
  protected readonly recentPayments = signal<any[]>([]);

  protected readonly activeTab = signal<'dashboard' | 'customers' | 'projects' | 'quotes' | 'invoices' | 'payments'>('dashboard');

  protected readonly breadcrumbs: LayoutBreadcrumb[] = [{ label: 'Admin Dashboard' }];

  constructor() {
    // Actualizar breadcrumbs en el layout service
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs);
    });

    effect(() => {
      const company = this.selectedCompany();
      this.loadDashboardData(company?._id);
    });
  }

  private loadDashboardData(companyId?: string): void {
    this.isLoading.set(true);

    const requests: any = {
      kpis: this.kpiService.getKpis(companyId).pipe(catchError(() => of(null))),
      invoiceKpis: this.kpiService.getInvoiceKpis(companyId).pipe(catchError(() => of(null))),
      // Load recent items for dashboard summary
      customers: this.customerService.getCustomers(companyId).pipe(catchError(() => of([]))),
      projects: this.projectService.getProjects(companyId ? { companyId } : {}).pipe(catchError(() => of([]))),
      quotes: this.quoteService.getQuotes(companyId ? { companyId } : {}).pipe(catchError(() => of([]))),
      invoices: this.invoiceService.getInvoices(companyId ? { companyId } : {}).pipe(catchError(() => of([]))),
      payments: this.paymentService.getPayments(companyId ? { companyId } : {}).pipe(catchError(() => of([])))
    };

    forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: any) => {
          if (data.kpis) this.kpis.set(data.kpis);
          if (data.invoiceKpis) this.invoiceKpis.set(data.invoiceKpis);
          
          this.recentCustomers.set((data.customers || []).slice(0, 5));
          this.recentProjects.set((data.projects || []).slice(0, 5));
          this.recentQuotes.set((data.quotes || []).slice(0, 5));
          this.recentInvoices.set((data.invoices || []).slice(0, 5));
          
          // Handle potential 404 from payments or empty array if skipped
          if (data.payments && Array.isArray(data.payments)) {
             this.recentPayments.set(data.payments.slice(0, 5));
          } else {
             this.recentPayments.set([]);
          }

          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Dashboard Load Error', error);
          // Even if one fails (like payments 404), try to keep others?
          // ForkJoin fails all if one fails. We should catch individual errors in forkJoin.
          this.isLoading.set(false);
        }
      });
  }

  protected setActiveTab(tab: 'dashboard' | 'customers' | 'projects' | 'quotes' | 'invoices' | 'payments'): void {
    this.activeTab.set(tab);
    
    // Navigation logic for full lists
    if (tab === 'customers') this.router.navigate(['/customers']);
    if (tab === 'invoices') this.router.navigate(['/invoices']);
    if (tab === 'projects') this.router.navigate(['/projects']);
    if (tab === 'quotes') this.router.navigate(['/quotes']);
    // if (tab === 'payments') this.router.navigate(['/payments']); // Page not yet created
  }

  // Navigation helpers
  viewCustomer(id: string) { /* this.router.navigate(['/customers', id]); */ } // Route might not exist yet
  viewProject(id: string) { this.router.navigate(['/projects', id]); }
  viewQuote(id: string) { this.router.navigate(['/quotes', id]); }
  viewInvoice(id: string) { this.router.navigate(['/invoices', id]); }
}

