import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import type { Customer, CustomerPayload } from '../../models/customer.model';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getCustomers(companyId?: string): Observable<Customer[]> {
    const endpoint = `${this.baseUrl}/customer`;
    let params = new HttpParams();
    if (companyId) {
      params = params.set('companyId', companyId);
    }
    return this.http.get<Customer[]>(endpoint, { params });
  }

  getCustomerByUserId(userId: string, companyId: string): Observable<Customer | null> {
    const endpoint = `${this.baseUrl}/customer`;
    const params = new HttpParams({ fromObject: { companyId } });
    return this.http.get<Customer[]>(endpoint, { params }).pipe(
      map((customers) => {
        // Buscar por userId primero, luego por email como fallback
        const byUserId = customers.find((c) => c.userId === userId);
        if (byUserId) {
          return byUserId;
        }
        // Si no hay userId, buscar por email (necesitamos el email del usuario)
        return null;
      })
    );
  }

  getCustomerByEmail(email: string, companyId: string): Observable<Customer | null> {
    const endpoint = `${this.baseUrl}/customer`;
    const params = new HttpParams({ fromObject: { companyId } });
    return this.http.get<Customer[]>(endpoint, { params }).pipe(
      map((customers) => {
        const customer = customers.find((c) => c.email?.toLowerCase() === email.toLowerCase());
        return customer ?? null;
      })
    );
  }

  getCustomer(id: string): Observable<Customer> {
    const endpoint = `${this.baseUrl}/customer/${id}`;
    return this.http.get<Customer>(endpoint);
  }

  createCustomer(payload: CustomerPayload): Observable<Customer> {
    const endpoint = `${this.baseUrl}/customer`;
    return this.http.post<Customer>(endpoint, payload);
  }

  updateCustomer(customerId: string, payload: Partial<CustomerPayload>): Observable<Customer> {
    const endpoint = `${this.baseUrl}/customer/${customerId}`;
    return this.http.patch<Customer>(endpoint, payload);
  }

  deleteCustomer(customerId: string): Observable<void> {
    const endpoint = `${this.baseUrl}/customer/${customerId}`;
    return this.http.delete<void>(endpoint);
  }
}


