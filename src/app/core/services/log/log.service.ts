import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { CompanyContextService } from '../company/company-context.service';

export type LogType = 'notification' | 'error';
export type LogSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CreateLogPayload {
  type: LogType;
  severity?: LogSeverity;
  message: string;
  description?: string;
  companyId?: string;
  userId?: string;
  source?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface LogResponse {
  _id: string;
  type: LogType;
  severity?: LogSeverity;
  message: string;
  description?: string;
  companyId?: string;
  userId?: string;
  source?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Crea un log de error en el sistema
   */
  async logError(
    message: string,
    error?: unknown,
    options?: {
      severity?: LogSeverity;
      description?: string;
      source?: string;
      metadata?: Record<string, unknown>;
      endpoint?: string;
      method?: string;
      statusCode?: number;
    }
  ): Promise<void> {
    try {
      const severity = options?.severity ?? this.determineSeverity(error);
      const description = options?.description ?? this.extractErrorDescription(error);
      const stackTrace = error instanceof Error ? error.stack : undefined;

      const payload: CreateLogPayload = {
        type: 'error',
        severity,
        message: message.substring(0, 500), // Máximo 500 caracteres
        description: description ? description.substring(0, 2000) : undefined, // Máximo 2000 caracteres
        companyId: this.companyContext.selectedCompanyId() ?? undefined,
        userId: this.authService.user()?.id,
        source: options?.source ?? 'frontend',
        stackTrace,
        metadata: {
          ...options?.metadata,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          timestamp: new Date().toISOString()
        },
        endpoint: options?.endpoint,
        method: options?.method,
        statusCode: options?.statusCode,
        userAgent: navigator.userAgent,
        resolved: false
      };

      await firstValueFrom(this.http.post<LogResponse>(`${this.baseUrl}/log`, payload));
    } catch (logError) {
      // No queremos que los errores de logging rompan la aplicación
      console.error('[LogService] Error al registrar log:', logError);
    }
  }

  /**
   * Crea un log de notificación en el sistema
   */
  async logNotification(
    message: string,
    options?: {
      description?: string;
      source?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    try {
      const payload: CreateLogPayload = {
        type: 'notification',
        message: message.substring(0, 500),
        description: options?.description ? options.description.substring(0, 2000) : undefined,
        companyId: this.companyContext.selectedCompanyId() ?? undefined,
        userId: this.authService.user()?.id,
        source: options?.source ?? 'frontend',
        metadata: {
          ...options?.metadata,
          timestamp: new Date().toISOString()
        },
        resolved: false
      };

      await firstValueFrom(this.http.post<LogResponse>(`${this.baseUrl}/log`, payload));
    } catch (logError) {
      console.error('[LogService] Error al registrar notificación:', logError);
    }
  }

  /**
   * Determina la severidad del error basándose en el tipo de error
   */
  private determineSeverity(error: unknown): LogSeverity {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Errores críticos
      if (message.includes('network') || message.includes('timeout') || message.includes('500')) {
        return 'critical';
      }
      
      // Errores altos
      if (message.includes('unauthorized') || message.includes('403') || message.includes('404')) {
        return 'high';
      }
      
      // Errores medios
      if (message.includes('bad request') || message.includes('400') || message.includes('validation')) {
        return 'medium';
      }
    }
    
    return 'low';
  }

  /**
   * Extrae una descripción del error
   */
  private extractErrorDescription(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    
    return undefined;
  }

  /**
   * Obtiene logs con filtros opcionales
   */
  getLogs(filters?: {
    type?: LogType;
    severity?: LogSeverity;
    companyId?: string;
    userId?: string;
    source?: string;
    resolved?: boolean;
    limit?: number;
    skip?: number;
  }): Observable<LogResponse[]> {
    const params = new URLSearchParams();
    
    if (filters?.type) params.append('type', filters.type);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.companyId) params.append('companyId', filters.companyId);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.source) params.append('source', filters.source);
    if (filters?.resolved !== undefined) params.append('resolved', String(filters.resolved));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.skip) params.append('skip', String(filters.skip));

    const queryString = params.toString();
    const url = queryString ? `${this.baseUrl}/log?${queryString}` : `${this.baseUrl}/log`;
    
    return this.http.get<LogResponse[]>(url);
  }

  /**
   * Obtiene un log específico por ID
   */
  getLogById(id: string): Observable<LogResponse> {
    return this.http.get<LogResponse>(`${this.baseUrl}/log/${id}`);
  }

  /**
   * Marca un log como resuelto
   */
  resolveLog(id: string, resolvedBy?: string): Observable<LogResponse> {
    return this.http.patch<LogResponse>(`${this.baseUrl}/log/${id}/resolve`, {
      resolvedBy: resolvedBy ?? this.authService.user()?.id
    });
  }
}


