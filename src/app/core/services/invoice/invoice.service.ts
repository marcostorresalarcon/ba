import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { CreateInvoicePayload, Invoice } from '../../models/invoice.model';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getInvoices(filters?: {
    companyId?: string;
    projectId?: string;
    customerId?: string;
    status?: string;
    quoteId?: string;
  }): Observable<Invoice[]> {
    let params = new HttpParams();
    if (filters?.companyId) params = params.set('companyId', filters.companyId);
    if (filters?.projectId) params = params.set('projectId', filters.projectId);
    if (filters?.customerId) params = params.set('customerId', filters.customerId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.quoteId) params = params.set('quoteId', filters.quoteId);

    return this.http.get<Invoice[]>(`${this.baseUrl}/invoice`, { params });
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.baseUrl}/invoice/${id}`);
  }

  createInvoice(payload: CreateInvoicePayload): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/invoice`, payload);
  }

  // Additional methods if needed (update, delete)
}

