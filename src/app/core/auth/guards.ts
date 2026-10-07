import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthApi } from './auth-api';
import { RenovadorSesion } from './renovador-sesion';
import { Sesion } from './sesion';

export const sesionGuard: CanActivateFn = (_ruta, estado) => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  const api = inject(AuthApi);
  const login = router.createUrlTree(['/interno/login']);

  const decidir = (cambiarPassword: boolean) => {
    const enCambio = estado.url.startsWith('/interno/cambiar-password');
    return cambiarPassword && !enCambio
      ? router.createUrlTree(['/interno/cambiar-password'])
      : true;
  };

  if (!sesion.autenticada()) {
    return inject(RenovadorSesion)
      .restaurar()
      .pipe(
        map((ok) => {
          const p = sesion.perfil();
          return ok && p ? decidir(p.debeCambiarPassword) : login;
        }),
      );
  }

  const perfil = sesion.perfil();
  if (perfil) return decidir(perfil.debeCambiarPassword);

  return api.yo().pipe(
    map((p) => {
      sesion.perfil.set(p);
      return decidir(p.debeCambiarPassword);
    }),
    catchError(() => {
      sesion.cerrar();
      return of(login);
    }),
  );
};

/**
 * Exige AL MENOS UNO de los permisos para abrir la pantalla; si la persona escribe la dirección a mano y su
 * rol no la incluye, ve «Acceso no autorizado». La API vuelve a validar los permisos en cada llamada.
 */
export function permisoGuard(...permisos: string[]): CanActivateFn {
  return () => {
    const sesion = inject(Sesion);
    return sesion.tieneAlguno(...permisos)
      ? true
      : inject(Router).createUrlTree(['/interno/no-autorizado']);
  };
}
