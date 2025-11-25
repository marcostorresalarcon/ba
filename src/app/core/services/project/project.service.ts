import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { Project, ProjectPayload } from '../../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getProjects(filters?: {
    companyId?: string;
    customerId?: string;
    estimatorId?: string;
    status?: string;
  }): Observable<Project[]> {
    let params = new HttpParams();
    if (filters?.companyId) {
      params = params.set('companyId', filters.companyId);
    }
    if (filters?.customerId) {
      params = params.set('customerId', filters.customerId);
    }
    if (filters?.estimatorId) {
      params = params.set('estimatorId', filters.estimatorId);
    }
    if (filters?.status) {
      params = params.set('status', filters.status);
    }

    const endpoint = `${this.baseUrl}/project`;
    return this.http.get<Project[]>(endpoint, { params });
  }

  getProject(id: string): Observable<Project> {
    const endpoint = `${this.baseUrl}/project/${id}`;
    return this.http.get<Project>(endpoint);
  }

  createProject(payload: ProjectPayload): Observable<Project> {
    const endpoint = `${this.baseUrl}/project`;
    return this.http.post<Project>(endpoint, payload);
  }

  updateProject(id: string, payload: Partial<ProjectPayload>): Observable<Project> {
    const endpoint = `${this.baseUrl}/project/${id}`;
    return this.http.patch<Project>(endpoint, payload);
  }

  deleteProject(id: string): Observable<void> {
    const endpoint = `${this.baseUrl}/project/${id}`;
    return this.http.delete<void>(endpoint);
  }
}

