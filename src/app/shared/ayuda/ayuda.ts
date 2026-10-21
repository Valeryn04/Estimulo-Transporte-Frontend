import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { Icono } from '../icono/icono';

let siguiente = 0;

/**
 * Ayuda de un campo: icono «?» que muestra un tooltip al pasar el cursor, al enfocarlo con el teclado o al tocarlo.
 * Se cierra con Escape o al tocar fuera. El texto queda enlazado con `aria-describedby` mediante `idTooltip`.
 */
@Component({
  selector: 'app-ayuda',
  imports: [Icono],
  host: {
    '(document:click)': 'cerrarAfuera($event)',
    '(keydown.escape)': 'abierta.set(false)',
  },
  templateUrl: './ayuda.html',
  styleUrl: './ayuda.scss',
})
export class Ayuda {
  readonly texto = input.required<string>();
  /** A qué se refiere la ayuda (para lectores de pantalla). */
  readonly etiqueta = input.required<string>();
  readonly idTooltip = input<string>(`ayuda-${++siguiente}`);

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly abierta = signal(false);

  protected cerrarAfuera(e: Event): void {
    if (this.abierta() && !this.elemento.nativeElement.contains(e.target as Node)) {
      this.abierta.set(false);
    }
  }
}
