import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Icono } from '../../../shared/icono/icono';
import { LockupDependencia } from '../../../shared/lockup-dependencia/lockup-dependencia';

/**
 * Marco del portal ciudadano con la identidad de la Alcaldía de Barranquilla: logo con el nombre de la
 * dependencia, contenido principal y salto de navegación para teclado y lectores de pantalla (RNF-02). Al
 * cambiar de pantalla el foco pasa a su título, para que el lector de pantalla (VoiceOver, TalkBack, NVDA) lo lea; no
 * hay voz ni preguntas propias: quien tiene un lector encendido lo oye y quien no, no ve nada distinto.
 */
@Component({
  selector: 'app-ciudadano-shell',
  imports: [RouterOutlet, RouterLink, LockupDependencia, Icono],
  templateUrl: './ciudadano-shell.html',
  styleUrl: './ciudadano-shell.scss',
})
export class CiudadanoShell {
  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);

  constructor() {
    // En una aplicación de una sola página el lector no se entera de que cambió la pantalla: el foco va al título.
    // La primera carga no se toca (el lector empieza desde el principio de la página).
    // Si la aplicación ya había navegado cuando se crea el marco, el próximo cambio ya es de pantalla.
    let primera = !this.router.navigated;
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      if (primera) {
        primera = false;
        return;
      }
      setTimeout(() => {
        const h1 = this.documento.querySelector<HTMLElement>('main h1');
        h1?.setAttribute('tabindex', '-1');
        h1?.focus();
      }, 150);
    });
  }

  /** Dirección actual sin parámetros: el inicio es la única pantalla que no necesita «volver». */
  private readonly ruta = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.url.split('?')[0]),
    ),
    { initialValue: this.router.url.split('?')[0] },
  );

  protected enInicio(): boolean {
    return this.ruta() === '/' || this.ruta() === '';
  }
}
