import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** El portal está dentro de un iframe de otra página. */
export function estaIncrustado(
  ventana: Window | null = typeof window === 'undefined' ? null : window,
): boolean {
  if (!ventana) return false;
  try {
    return ventana.self !== ventana.top;
  } catch {
    // Un navegador que no deja comparar con la ventana superior indica que está en otro origen: sí está incrustado.
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class Incrustacion {
  private readonly documento = inject(DOCUMENT);

  /** ¿Está este portal dentro de un iframe? */
  incrustado(): boolean {
    return estaIncrustado(this.documento.defaultView);
  }
}

/** Ruta del aviso que ve quien abre el portal dentro de otra página. */
export const RUTA_NO_INCRUSTABLE = '/no-incrustable';

/**
 * Ningún portal (ni el ciudadano ni el interno) se abre dentro de otra página: la página de la Alcaldía enlaza al
 * portal con un botón o enlace y este se abre por sí solo. Así nadie puede disfrazarlo con un iframe para engañar a
 * una persona (clickjacking). Es una segunda defensa; la primera es la cabecera `frame-ancestors 'none'` del
 * servidor web.
 */
export const noIncrustableGuard: CanActivateFn = (_ruta, estado) => {
  const router = inject(Router);
  if (!inject(Incrustacion).incrustado()) return true;
  return estado.url.startsWith(RUTA_NO_INCRUSTABLE) ? true : router.parseUrl(RUTA_NO_INCRUSTABLE);
};
