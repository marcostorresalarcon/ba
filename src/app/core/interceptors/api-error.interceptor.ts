import type { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { HttpErrorService } from '../services/error/http-error.service';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorService = inject(HttpErrorService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      errorService.handle(error);
      return throwError(() => error);
    })
  );
};


