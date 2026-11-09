import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ModoAccesible } from './modo-accesible';

/** Lo que se deja inerte (sin foco ni lectura) mientras la pregunta inicial está abierta. */
const FONDO = 'header, main, .saltar';

/**
 * Lo que la web aporta a los lectores de pantalla (VoiceOver, TalkBack, NVDA, el lector de Google):
 *  - la pregunta inicial («¿es usted una persona con discapacidad visual?»): el foco va a su título, el resto de la página
 *    queda inerte mientras está abierta y no lleva roles de «ventana» ni avisos de más: el lector lee solo lo que dice;
 *  - el paso del foco al título de cada pantalla nueva, que en una aplicación de una sola página el lector no hace por su
 *    cuenta (el lector lee el título al recibir el foco, sin un aviso aparte que lo repita).
 */
@Component({
  selector: 'app-accesibilidad',
  templateUrl: './accesibilidad.html',
  styleUrl: './accesibilidad.scss',
})
export class Accesibilidad implements OnInit {
  protected readonly modo = inject(ModoAccesible);
  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);
  private readonly destruir = inject(DestroyRef);
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  constructor() {
    // Con la pregunta abierta, el resto de la página no se puede alcanzar ni leer; el foco va al diálogo.
    effect(() => {
      const abierta = !this.modo.respondida();
      this.documento.querySelectorAll(FONDO).forEach((el) => el.toggleAttribute('inert', abierta));
      const t = this.titulo();
      if (abierta && t) setTimeout(() => t.nativeElement.focus(), 50);
    });
  }

  ngOnInit(): void {
    // En una página de una sola página el lector no se entera de que cambió la pantalla: se anuncia y el foco va al título.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe(() => setTimeout(() => this.alCambiarDePantalla(), 150));
  }

  private alCambiarDePantalla(): void {
    if (!this.modo.respondida()) return;
    const h1 = this.documento.querySelector<HTMLElement>('main h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus();
    }
  }

  protected responder(activar: boolean): void {
    this.modo.fijar(activar);
    // El foco vuelve a la página, al título, para que el lector empiece a leerla desde ahí.
    setTimeout(() => {
      const h1 = this.documento.querySelector<HTMLElement>('main h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus();
      }
    }, 100);
  }
}
