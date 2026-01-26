import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { KpiResponse, InvoiceKpiResponse, SalesDashboardResponse } from '../../models/kpi.model';

@Injectable({
  providedIn: 'root'
})
export class KpiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getKpis(companyId?: string): Observable<KpiResponse> {
    let params = new HttpParams();
    if (companyId) {
      params = params.set('companyId', companyId);
    }

    const endpoint = `${this.baseUrl}/kpi`;
    return this.http.get<KpiResponse>(endpoint, { params });
  }

  getInvoiceKpis(companyId?: string): Observable<InvoiceKpiResponse> {
    let params = new HttpParams();
    if (companyId) {
      params = params.set('companyId', companyId);
    }

    const endpoint = `${this.baseUrl}/kpi/invoices`;
    return this.http.get<InvoiceKpiResponse>(endpoint, { params });
  }

  getSalesDashboard(filters: {
    companyId: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<SalesDashboardResponse> {
    let params = new HttpParams();
    params = params.set('companyId', filters.companyId);
    
    if (filters.userId) params = params.set('userId', filters.userId);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);

    const endpoint = `${this.baseUrl}/kpi/sales-dashboard`;
    return this.http.get<SalesDashboardResponse>(endpoint, { params });
  }
}

