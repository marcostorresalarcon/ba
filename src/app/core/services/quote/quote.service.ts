import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { Quote, QuotePayload } from '../../models/quote.model';

@Injectable({
  providedIn: 'root'
})
export class QuoteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getQuotes(filters?: {
    companyId?: string;
    projectId?: string;
    category?: string;
    status?: string;
    userId?: string;
  }): Observable<Quote[]> {
    let params = new HttpParams();
    if (filters?.companyId) {
      params = params.set('companyId', filters.companyId);
    }
    if (filters?.projectId) {
      params = params.set('projectId', filters.projectId);
    }
    if (filters?.category) {
      params = params.set('category', filters.category);
    }
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.userId) {
      params = params.set('userId', filters.userId);
    }

    const endpoint = `${this.baseUrl}/quote`;
    return this.http.get<Quote[]>(endpoint, { params });
  }

  getQuotesByProject(projectId: string): Observable<Quote[]> {
    const endpoint = `${this.baseUrl}/quote/project/${projectId}`;
    return this.http.get<Quote[]>(endpoint);
  }

  getQuote(id: string): Observable<Quote> {
    const endpoint = `${this.baseUrl}/quote/${id}`;
    return this.http.get<Quote>(endpoint);
  }

  createQuote(payload: QuotePayload): Observable<Quote> {
    const endpoint = `${this.baseUrl}/quote`;
    return this.http.post<Quote>(endpoint, payload);
  }

  updateQuote(id: string, payload: Partial<QuotePayload>): Observable<Quote> {
    const endpoint = `${this.baseUrl}/quote/${id}`;
    return this.http.patch<Quote>(endpoint, payload);
  }

  deleteQuote(id: string): Observable<void> {
    const endpoint = `${this.baseUrl}/quote/${id}`;
    return this.http.delete<void>(endpoint);
  }

  /**
   * @deprecated Este endpoint no existe en la API. Para crear una nueva versión,
   * simplemente crea un nuevo quote con el mismo projectId y category usando createQuote().
   * El backend calculará automáticamente el versionNumber.
   */
  // createQuoteVersion(id: string, payload: Partial<QuotePayload>): Observable<Quote> {
  //   const endpoint = `${this.baseUrl}/quote/${id}/version`;
  //   return this.http.post<Quote>(endpoint, payload);
  // }
}

