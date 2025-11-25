import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { Company } from '../../models/company.model';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getCompanies(activeOnly = true): Observable<Company[]> {
    const endpoint = `${this.baseUrl}/company`;
    const params = activeOnly
      ? new HttpParams({
          fromObject: { activeOnly: 'true' }
        })
      : undefined;

    return this.http.get<Company[]>(endpoint, { params });
  }
}


