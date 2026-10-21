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
    '(mouseenter)': 'ajustar()',
    '(focusin)': 'ajustar()',
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

  /** Si el tooltip se saldría de la pantalla, se corre lo justo para que se lea completo. */
  protected ajustar(): void {
    const tip = this.elemento.nativeElement.querySelector<HTMLElement>('.tooltip');
    if (!tip) return;
    tip.style.transform = '';
    const r = tip.getBoundingClientRect();
    const margen = 8;
    const ancho = document.documentElement.clientWidth;
    let dx = 0;
    if (r.right > ancho - margen) dx = ancho - margen - r.right;
    if (r.left + dx < margen) dx = margen - r.left;
    if (dx !== 0) tip.style.transform = `translateX(${dx}px)`;
  }

  protected cerrarAfuera(e: Event): void {
    if (this.abierta() && !this.elemento.nativeElement.contains(e.target as Node)) {
      this.abierta.set(false);
    }
  }
}
