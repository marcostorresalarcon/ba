import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

type AllowedRole = 'customer' | 'estimator' | 'administrator' | 'admin';

/**
 * Protege rutas por rol. Solo permite acceso si el usuario tiene uno de los roles permitidos.
 * Redirige a la ruta por defecto del rol si no tiene acceso.
 */
export function roleGuard(allowedRoles: AllowedRole[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const role = authService.user()?.role?.toLowerCase();

    const normalizedRole = role === 'admin' ? 'administrator' : role;
    const isAllowed = allowedRoles.some(
      (r) => normalizedRole === r || (r === 'administrator' && role === 'admin')
    );
    if (isAllowed) {
      return true;
    }

    // Redirigir según rol actual
    if (role === 'customer') {
      void router.navigateByUrl('/my-projects');
    } else if (role === 'administrator' || role === 'admin') {
      void router.navigateByUrl('/dashboard');
    } else {
      void router.navigateByUrl('/customers');
    }
    return false;
  };
}
