import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import type { AuthResponse, AuthUser, LoginPayload } from '../../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly storageKey = 'user';

  readonly user = signal<AuthUser | null>(this.restoreUser());

  login(payload: LoginPayload): Observable<AuthResponse> {
    const endpoint = `${this.baseUrl}/auth/login`;
    return this.http.post<AuthResponse>(endpoint, payload).pipe(
      tap((response) => {
        this.user.set(response.user);
        localStorage.setItem(this.storageKey, JSON.stringify(response.user));
      })
    );
  }

  updateUser(user: AuthUser): void {
    this.user.set(user);
    localStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem(this.storageKey);
    this.user.set(null);
  }

  private restoreUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}


