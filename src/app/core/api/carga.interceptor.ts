import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { Alertas } from '../../shared/alertas/alertas';

/** Peticiones que modifican datos pero ocurren en segundo plano: no se interrumpe con una barra de carga. */
const EN_SEGUNDO_PLANO = /\/auth\/refresh|\/vista-previa|\/items\/\d+|\/variables\/|\/leidas?$/;

/** Mientras una petición que guarda cambios espera respuesta, se muestra una barra de carga (si tarda). */
export const cargaInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || req.method === 'PATCH' || EN_SEGUNDO_PLANO.test(req.url)) {
    return next(req);
  }
  const alertas = inject(Alertas);
  alertas.iniciarCarga();
  return next(req).pipe(finalize(() => alertas.terminarCarga()));
};
