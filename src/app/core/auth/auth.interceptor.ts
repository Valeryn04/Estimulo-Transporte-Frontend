import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, tap, throwError } from 'rxjs';
import { API_BASE } from '../api/api';
import { ApiError } from '../api/api-error';
import { RenovadorSesion } from './renovador-sesion';
import { Sesion } from './sesion';

const SIN_TOKEN = ['/auth/login', '/auth/refresh', '/auth/logout'];

const YA_REINTENTADA = new HttpContextToken<boolean>(() => false);

function requiereSesion(url: string): boolean {
  if (!url.startsWith(API_BASE)) return false;
  const ruta = url.slice(API_BASE.length);
  if (SIN_TOKEN.some((p) => ruta.startsWith(p))) return false;
  return /^\/(auth|interno|admin)\b/.test(ruta);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(Sesion);
  const renovador = inject(RenovadorSesion);
  const router = inject(Router);

  const conToken = (token: string | null) =>
    token && requiereSesion(req.url)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  const cerrarPorSesion = (error: unknown, mensaje: string) => {
    sesion.cerrar(mensaje);
    void router.navigate(['/interno/login']);
    return throwError(() => error);
  };

  return next(conToken(sesion.token())).pipe(
    tap((evento) => {
      if (evento instanceof HttpResponse && requiereSesion(req.url) && sesion.autenticada()) {
        sesion.marcarActividad();
      }
    }),
    catchError((error: unknown) => {
      if (!(error instanceof ApiError || error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const codigo = error instanceof ApiError ? error.codigo : '';
      if (!requiereSesion(req.url) || !sesion.autenticada()) return throwError(() => error);

      if (codigo === 'SESION_EXPIRADA' && !req.context.get(YA_REINTENTADA)) {
        return renovador.renovar().pipe(
          switchMap((token) =>
            next(
              req.clone({
                setHeaders: { Authorization: `Bearer ${token}` },
                context: new HttpContext().set(YA_REINTENTADA, true),
              }),
            ),
          ),
          catchError((e: unknown) =>
            e instanceof ApiError && ['SESION_EXPIRADA', 'SESION_INVALIDA'].includes(e.codigo)
              ? cerrarPorSesion(error, 'Su sesión expiró por inactividad. Ingrese de nuevo.')
              : throwError(() => e),
          ),
        );
      }
      if (['SESION_EXPIRADA', 'SESION_INVALIDA', 'NO_AUTENTICADO'].includes(codigo)) {
        return cerrarPorSesion(
          error,
          codigo === 'SESION_EXPIRADA'
            ? 'Su sesión expiró por inactividad. Ingrese de nuevo.'
            : 'Su sesión ya no es válida. Ingrese de nuevo.',
        );
      }
      if (codigo === 'PASSWORD_VENCIDA') void router.navigate(['/interno/cambiar-password']);
      if (codigo === 'SIN_PERMISO' && req.method === 'GET' && !req.url.includes('/auth/')) {
        void router.navigate(['/interno/no-autorizado']);
      }
      return throwError(() => error);
    }),
  );
};
