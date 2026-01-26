import { CommonModule, DecimalPipe, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import {
  NgApexchartsModule
} from 'ng-apexcharts';

import { CompanyContextService } from '../../core/services/company/company-context.service';
import { Router } from '@angular/router';
import { KpiService } from '../../core/services/kpi/kpi.service';
import { HttpErrorService } from '../../core/services/error/http-error.service';
import { LayoutService } from '../../core/services/layout/layout.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import type { SalesDashboardResponse, KpiResponse } from '../../core/models/kpi.model';
import type { LayoutBreadcrumb } from '../../shared/ui/page-layout/page-layout.component';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, DecimalPipe, CurrencyPipe],
  templateUrl: './sales-dashboard.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesDashboardPage {
  private readonly kpiService = inject(KpiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly layoutService = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly data = signal<SalesDashboardResponse | null>(null);
  protected readonly kpiData = signal<KpiResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly selectedCompany = this.companyContext.selectedCompany;

  protected readonly breadcrumbs: LayoutBreadcrumb[] = [
    { label: 'Admin Dashboard', route: '/admin-dashboard' },
    { label: 'Sales Intelligence' }
  ];

  // Chart Options
  protected readonly funnelChartOptions = computed(() => {
    const pipeline = this.data()?.pipeline || {};
    const categories = Object.keys(pipeline);
    const values = Object.values(pipeline);

    return {
      series: [{ name: 'Quotes', data: values }],
      chart: { type: 'bar' as const, height: 350, toolbar: { show: false } },
      plotOptions: {
        bar: {
          borderRadius: 10,
          horizontal: true,
          barHeight: '80%',
          distributed: true,
          isFunnel: true,
        },
      },
      colors: ['#3a7344', '#ead1ba', '#2d3436', '#6b7280', '#10b981', '#f59e0b'],
      dataLabels: {
        enabled: true,
        formatter: (val: number | string | number[], opt?: { w: { globals: { labels: string[] } }, dataPointIndex: number }) => {
          return (opt?.w?.globals?.labels[opt.dataPointIndex] || '') + ': ' + val;
        },
        dropShadow: { enabled: true }
      },
      xaxis: { categories: categories },
      legend: { show: false }
    };
  });

  protected readonly timesChartOptions = computed(() => {
    const times = this.data()?.timesPerStage || { quote: {}, project: {} };
    
    const quoteLabels = Object.keys(times.quote).map(k => `Quote: ${k}`);
    const quoteValues = Object.values(times.quote);
    
    const projectLabels = Object.keys(times.project).map(k => `Project: ${k}`);
    const projectValues = Object.values(times.project);

    return {
      series: [{ name: 'Avg. Days', data: [...quoteValues, ...projectValues] }],
      chart: { type: 'bar' as const, height: 350, toolbar: { show: false } },
      plotOptions: {
        bar: { borderRadius: 10, columnWidth: '50%' }
      },
      xaxis: {
        categories: [...quoteLabels, ...projectLabels],
        labels: { rotate: -45, maxHeight: 100 }
      },
      title: { text: 'Avg. Days per Stage', align: 'left' as const, style: { color: '#2d3436' } },
      colors: ['#3a7344']
    };
  });

  constructor() {
    effect(() => {
      this.layoutService.setBreadcrumbs(this.breadcrumbs);
    });

    effect(() => {
      const company = this.selectedCompany();
      if (company) {
        this.loadSalesData(company._id);
      }
    });
  }

  protected loadSalesData(companyId: string): void {
    // Validar que companyId sea válido
    if (!companyId || companyId.trim() === '') {
      console.warn('Invalid companyId, redirecting to company selection');
      void this.router.navigate(['/company']);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    
    // Cargar ambos datos en paralelo
    forkJoin({
      salesDashboard: this.kpiService.getSalesDashboard({ companyId }),
      kpis: this.kpiService.getKpis(companyId)
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: ({ salesDashboard, kpis }) => {
          this.data.set(salesDashboard);
          this.kpiData.set(kpis);
        },
        error: (err) => {
          const msg = this.errorService.handle(err);
          this.notificationService.error('Error loading dashboard data', msg);
          this.isLoading.set(false);
        }
      });
  }

  // Computed para métricas del flujo de aprobación
  protected readonly approvalMetrics = computed(() => {
    const quotes = this.kpiData()?.quotes;
    if (!quotes) return null;

    const byStatus = quotes.byStatus || {};
    const pending = byStatus['pending'] || 0;
    const sent = byStatus['sent'] || 0;
    const approved = byStatus['approved'] || 0;
    const rejected = byStatus['rejected'] || 0;
    const inProgress = byStatus['in_progress'] || 0;
    const completed = byStatus['completed'] || 0;
    const totalInWorkflow = pending + sent + approved + rejected;
    
    const approvalRate = totalInWorkflow > 0 
      ? ((approved / (approved + rejected)) * 100) || 0 
      : 0;
    
    const rejectionRate = totalInWorkflow > 0 
      ? ((rejected / (approved + rejected)) * 100) || 0 
      : 0;

    return {
      pending,
      sent,
      approved,
      rejected,
      inProgress,
      completed,
      totalInWorkflow,
      approvalRate,
      rejectionRate
    };
  });
}
