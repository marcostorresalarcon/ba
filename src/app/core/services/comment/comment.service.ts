import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { Comment } from '../../models/comment.model';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getCommentsByProject(projectId: string): Observable<Comment[]> {
    const params = { projectId };
    return this.http.get<Comment[]>(`${this.baseUrl}/comment`, { params });
  }

  createComment(projectId: string, text: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.baseUrl}/comment`, { projectId, text });
  }

  updateComment(id: string, text: string): Observable<Comment> {
    return this.http.patch<Comment>(`${this.baseUrl}/comment/${id}`, { text });
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/comment/${id}`);
  }
}
