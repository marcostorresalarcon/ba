import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ConfirmPaymentPayload, CreatePaymentIntentPayload } from '../../models/invoice.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  createPaymentIntent(payload: CreatePaymentIntentPayload): Observable<{ clientSecret: string; id: string }> {
    return this.http.post<{ clientSecret: string; id: string }>(`${this.baseUrl}/payment/create-intent`, payload);
  }

  confirmPayment(payload: ConfirmPaymentPayload): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/payment/confirm`, payload);
  }

  getPayments(filters?: {
    companyId?: string;
    projectId?: string;
    customerId?: string;
    status?: string;
  }): Observable<any[]> {
    // Note: Based on API docs, there is a GET /payment endpoint with filters.
    // However, if it returns 404, it might not be implemented yet or the URL structure is different.
    // Checking the API docs provided (lines 997-1010), GET /payment exists.
    // If it fails, we might need to check the backend logs or if the base URL is correct.
    
    let params = new HttpParams();
    if (filters?.companyId) params = params.set('companyId', filters.companyId);
    if (filters?.projectId) params = params.set('projectId', filters.projectId);
    if (filters?.customerId) params = params.set('customerId', filters.customerId);
    if (filters?.status) params = params.set('status', filters.status);

    return this.http.get<any[]>(`${this.baseUrl}/payment`, { params });
  }
}

