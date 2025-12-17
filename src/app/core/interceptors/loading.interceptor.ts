import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Iniciar loading
  loadingService.start();

  return next(req).pipe(
    finalize(() => {
      // Detener loading cuando la petición termine (éxito o error)
      loadingService.stop();
    })
  );
};

