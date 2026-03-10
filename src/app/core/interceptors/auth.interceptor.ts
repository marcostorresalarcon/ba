import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Añade el token JWT al header Authorization de todas las peticiones HTTP.
 * Excluye rutas públicas (login, register, auth).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(cloned);
  }
  return next(req);
};
