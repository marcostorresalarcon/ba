import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { Appointment } from '../../models/appointment.model';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getByProject(projectId: string): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.baseUrl}/appointment`, {
      params: { projectId }
    });
  }

  getById(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.baseUrl}/appointment/${id}`);
  }

  create(projectId: string, date: Date, type: string, notes?: string): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/appointment`, {
      projectId,
      date: date.toISOString(),
      type: type || 'other',
      notes
    });
  }

  update(id: string, payload: Partial<{ date: string; type: string; notes: string; status: string }>): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.baseUrl}/appointment/${id}`, payload);
  }

  confirm(id: string): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/appointment/${id}/confirm`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/appointment/${id}`);
  }
}
