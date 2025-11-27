import type { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { HttpErrorService } from '../services/error/http-error.service';
import { LogService } from '../services/log/log.service';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorService = inject(HttpErrorService);
  const logService = inject(LogService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Manejar el error con el servicio existente
      errorService.handle(error);

      // Registrar el error en el sistema de logs
      const errorMessage = errorService.extractMessage(error);
      const severity = error.status >= 500 ? 'critical' : error.status >= 400 ? 'high' : 'medium';

      logService.logError(
        `HTTP Error: ${errorMessage}`,
        error,
        {
          severity,
          description: `Error en petición HTTP: ${req.method} ${req.url}`,
          source: 'http-interceptor',
          endpoint: req.url,
          method: req.method,
          statusCode: error.status,
          metadata: {
            errorUrl: error.url,
            errorStatus: error.status,
            errorStatusText: error.statusText,
            errorBody: error.error
          }
        }
      ).catch(() => {
        // Silenciar errores de logging para no crear bucles infinitos
      });

      return throwError(() => error);
    })
  );
};


