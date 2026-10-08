import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, input, model } from '@angular/core';
import { Icono } from '../icono/icono';

export interface ElementoOrden {
  id: number;
  nombre: string;
}

interface Fila {
  id: number | null;
  nombre: string;
  actual: boolean;
}

/**
 * Elige la posición de un elemento arrastrándolo dentro de la lista donde va a quedar (al crear o editar).
 * Muestra los demás elementos en su orden y el elemento actual resaltado: se arrastra, o se mueve con las
 * flechas. El número de posición es siempre único: los demás se corren al soltar.
 */
@Component({
  selector: 'app-orden-lista',
  imports: [CdkDrag, CdkDropList, CdkDragHandle, Icono],
  templateUrl: './orden-lista.html',
  styleUrl: './orden-lista.scss',
})
export class OrdenLista {
  /** Los demás elementos de la lista, en su orden (sin el que se está creando o editando). */
  readonly elementos = input.required<ElementoOrden[]>();
  /** Nombre del elemento actual (se ve en la lista mientras se escribe). */
  readonly nombre = input('');
  /** Posición del elemento actual (desde 1). */
  readonly posicion = model<number | null>(null);

  /** Lugar del elemento actual dentro de la lista (desde 0). */
  protected readonly indice = computed(() => {
    const n = this.elementos().length;
    const p = this.posicion();
    return p === null || !Number.isInteger(p) || p < 1 ? n : Math.min(p - 1, n);
  });

  protected readonly filas = computed<Fila[]>(() => {
    const filas: Fila[] = this.elementos().map((e) => ({ ...e, actual: false }));
    filas.splice(this.indice(), 0, {
      id: null,
      nombre: this.nombre().trim() || 'Este elemento',
      actual: true,
    });
    return filas;
  });

  protected readonly puedeSubir = computed(() => this.indice() > 0);
  protected readonly puedeBajar = computed(() => this.indice() < this.elementos().length);

  protected soltar(e: CdkDragDrop<unknown>): void {
    this.posicion.set(e.currentIndex + 1);
  }

  protected subir(): void {
    if (this.puedeSubir()) this.posicion.set(this.indice());
  }

  protected bajar(): void {
    if (this.puedeBajar()) this.posicion.set(this.indice() + 2);
  }
}
