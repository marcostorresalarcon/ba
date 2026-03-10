import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { Notification } from '../../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getMyNotifications(options?: { unreadOnly?: boolean; limit?: number }): Observable<Notification[]> {
    let params: Record<string, string> = {};
    if (options?.unreadOnly) params['unreadOnly'] = 'true';
    if (options?.limit) params['limit'] = String(options.limit);
    return this.http.get<Notification[]>(`${this.baseUrl}/notification`, { params });
  }

  markAsRead(id: string): Observable<Notification> {
    return this.http.post<Notification>(`${this.baseUrl}/notification/${id}/read`, {});
  }

  markAllAsRead(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/notification/read-all`, {});
  }
}
