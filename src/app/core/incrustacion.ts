import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { CanActivateFn, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Mensajes que el portal ciudadano le envía a la página que lo incrusta (iframe). */
export const MENSAJE_ALTURA = 'estimulo-transporte:altura';
export const MENSAJE_NAVEGACION = 'estimulo-transporte:navegacion';

/** El portal está dentro de un iframe de otra página (por ejemplo, la de la Alcaldía). */
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

/**
 * Portal ciudadano dentro de la página institucional (iframe). El portal no guarda nada en cookies ni en el
 * almacenamiento del navegador, así que funciona igual dentro de un iframe de otro sitio. Este servicio le avisa a la
 * página que lo contiene cuánto mide su contenido (para que ajuste el alto del iframe sin barras internas) y cuándo
 * la persona cambia de pantalla (para que lleve el iframe a la vista).
 */
@Injectable({ providedIn: 'root' })
export class Incrustacion {
  private readonly documento = inject(DOCUMENT);
  private readonly router = inject(Router);
  private ultimaAltura = 0;

  /** ¿Está este portal dentro de un iframe? */
  incrustado(): boolean {
    return estaIncrustado(this.documento.defaultView);
  }

  iniciar(): void {
    const ventana = this.documento.defaultView;
    if (!ventana || !this.incrustado() || typeof ResizeObserver === 'undefined') return;
    const raiz = this.documento.querySelector('app-root');
    if (raiz) {
      new ResizeObserver(() => this.avisarAltura(ventana, raiz as HTMLElement)).observe(raiz);
      this.avisarAltura(ventana, raiz as HTMLElement);
    }
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => ventana.parent.postMessage({ tipo: MENSAJE_NAVEGACION }, '*'));
  }

  private avisarAltura(ventana: Window, raiz: HTMLElement): void {
    const altura = Math.ceil(raiz.getBoundingClientRect().height);
    if (altura === this.ultimaAltura) return;
    this.ultimaAltura = altura;
    // Solo viaja un número: no hay datos de la persona en este mensaje, por eso se admite cualquier origen.
    ventana.parent.postMessage({ tipo: MENSAJE_ALTURA, altura }, '*');
  }
}

/**
 * El portal interno (funcionarios) NUNCA se abre dentro de otra página: evita que alguien lo disfrace con un iframe
 * para engañar a un funcionario (clickjacking). Es una segunda defensa; la primera es la cabecera
 * `frame-ancestors 'none'` del servidor web.
 */
export const noIncrustableGuard: CanActivateFn = (_ruta, estado) => {
  const router = inject(Router);
  if (!inject(Incrustacion).incrustado()) return true;
  return estado.url.startsWith('/interno/no-incrustable')
    ? true
    : router.parseUrl('/interno/no-incrustable');
};
