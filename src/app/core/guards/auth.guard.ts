import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/**
 * Protege rutas que requieren autenticación.
 * Redirige a /login si no hay usuario.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.user()) {
    return true;
  }
  void router.navigateByUrl('/login');
  return false;
};
