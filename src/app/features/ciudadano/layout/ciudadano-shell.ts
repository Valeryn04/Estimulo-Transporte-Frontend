import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Icono } from '../../../shared/icono/icono';
import { Accesibilidad } from '../../../shared/accesibilidad/accesibilidad';
import { LockupDependencia } from '../../../shared/lockup-dependencia/lockup-dependencia';

/**
 * Marco del portal ciudadano con la identidad de la Alcaldía de Barranquilla: logo con el nombre de la
 * dependencia, contenido principal y salto de navegación para teclado y lectores de pantalla (RNF-02). Trae al
 * principio la pregunta del modo accesible y anuncia cada pantalla a los lectores de pantalla.
 */
@Component({
  selector: 'app-ciudadano-shell',
  imports: [RouterOutlet, RouterLink, LockupDependencia, Icono, Accesibilidad],
  templateUrl: './ciudadano-shell.html',
  styleUrl: './ciudadano-shell.scss',
})
export class CiudadanoShell {
  private readonly router = inject(Router);

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
