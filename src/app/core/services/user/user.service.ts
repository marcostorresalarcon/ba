import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { Role, User, UserPayload, UpdateUserPayload, UserRole } from '../../models/user.model';

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
    
    return this.http.get<User[]>(endpoint, { params }).pipe(
      map((users) => {
        // Transformar usuarios para calcular role y active desde roles array
        return users.map((user) => {
          const activeRole = user.roles?.find((r: UserRole) => r.active) || user.roles?.[0];
          return {
            ...user,
            id: user.id || user._id,
            role: activeRole?.name,
            active: user.roles?.some((r: UserRole) => r.active) ?? false
          };
        });
      })
    );
  }

  /**
   * Actualiza un usuario existente
   */
  updateUser(userId: string, payload: UpdateUserPayload): Observable<User> {
    const endpoint = `${this.baseUrl}/users/${userId}`;
    return this.http.patch<User>(endpoint, payload).pipe(
      map((user) => {
        const activeRole = user.roles?.find((r: UserRole) => r.active) || user.roles?.[0];
        return {
          ...user,
          id: user.id || user._id,
          role: activeRole?.name,
          active: user.roles?.some((r: UserRole) => r.active) ?? false
        };
      })
    );
  }

  /**
   * Elimina un usuario del sistema
   */
  deleteUser(userId: string): Observable<void> {
    const endpoint = `${this.baseUrl}/users/${userId}`;
    return this.http.delete<void>(endpoint);
  }
}

