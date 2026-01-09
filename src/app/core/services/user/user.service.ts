import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { Role, User, UserPayload } from '../../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Obtiene todos los roles del sistema
   */
  getRoles(): Observable<Role[]> {
    const endpoint = `${this.baseUrl}/role`;
    return this.http.get<Role[]>(endpoint);
  }

  /**
   * Obtiene un role específico por su ID
   */
  getRoleById(id: string): Observable<Role> {
    const endpoint = `${this.baseUrl}/role/${id}`;
    return this.http.get<Role>(endpoint);
  }

  /**
   * Crea un nuevo role
   */
  createRole(payload: UserPayload): Observable<Role> {
    const endpoint = `${this.baseUrl}/role`;
    return this.http.post<Role>(endpoint, payload);
  }

  /**
   * Actualiza un role existente
   */
  updateRole(id: string, payload: Partial<UserPayload>): Observable<Role> {
    const endpoint = `${this.baseUrl}/role/${id}`;
    return this.http.patch<Role>(endpoint, payload);
  }

  /**
   * Elimina un role
   */
  deleteRole(id: string): Observable<void> {
    const endpoint = `${this.baseUrl}/role/${id}`;
    return this.http.delete<void>(endpoint);
  }

  /**
   * Obtiene todos los usuarios del sistema
   */
  getUsers(companyId?: string): Observable<User[]> {
    const endpoint = `${this.baseUrl}/users`;
    let params = new HttpParams();
    
    if (companyId) {
      params = params.set('companyId', companyId);
    }
    
    return this.http.get<User[]>(endpoint, { params });
  }
}

