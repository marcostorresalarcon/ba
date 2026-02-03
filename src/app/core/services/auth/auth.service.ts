import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  RegisterRequestPayload,
  RegisterConfirmPayload,
  RegisterRequestResponse
} from '../../models/auth.model';
import { CredentialsStorageService } from './credentials-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly storageKey = 'user';
  private readonly credentialsStorage = inject(CredentialsStorageService);

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
    this.credentialsStorage.clearCredentials();
    this.user.set(null);
  }

  /**
   * Elimina la cuenta del usuario autenticado (borrado físico).
   * Requiere JWT en Authorization header.
   * Ruta configurable por environment (authDeleteAccountPath) por si el backend usa prefijo (ej. api/auth/account).
   */
  deleteAccount(): Observable<{ message: string }> {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders(
      token ? { Authorization: `Bearer ${token}` } : {}
    );
    const path = (environment as { authDeleteAccountPath?: string }).authDeleteAccountPath ?? 'auth/account';
    const endpoint = `${this.baseUrl}/${path.replace(/^\//, '')}`;
    return this.http.delete<{ message: string }>(endpoint, { headers });
  }

  registerRequestCode(payload: RegisterRequestPayload): Observable<RegisterRequestResponse> {
    const endpoint = `${this.baseUrl}/auth/register/request-code`;
    return this.http.post<RegisterRequestResponse>(endpoint, payload);
  }

  registerConfirm(payload: RegisterConfirmPayload): Observable<AuthResponse> {
    const endpoint = `${this.baseUrl}/auth/register/confirm`;
    return this.http.post<AuthResponse>(endpoint, payload).pipe(
      tap((response) => {
        this.user.set(response.user);
        localStorage.setItem(this.storageKey, JSON.stringify(response.user));
      })
    );
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


