import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const CLAVE = 'modo_accesible';

const leer = (): boolean | null => {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
};

const guardar = (activo: boolean): void => {
  try {
    localStorage.setItem(CLAVE, activo ? '1' : '0');
  } catch {
    // Sin almacenamiento (modo privado): la respuesta solo dura mientras la pestaña esté abierta.
  }
};

/**
 * Modo accesible del portal ciudadano: lo activa quien dice que tiene una discapacidad visual. No es una voz propia (esa
 * la ponen VoiceOver, TalkBack, NVDA o el lector de pantalla de Google): es una página preparada para ellos, con letra y
 * botones grandes, la ayuda de cada campo siempre a la vista y un recorrido simple. La respuesta se recuerda.
 */
@Injectable({ providedIn: 'root' })
export class ModoAccesible {
  private readonly documento = inject(DOCUMENT);
  private readonly previa = leer();

  /** La persona ya contestó la pregunta inicial (se le hace una sola vez). */
  readonly respondida = signal(this.previa !== null);
  readonly activo = signal(this.previa === true);

  constructor() {
    this.aplicar();
  }

  fijar(activo: boolean): void {
    this.activo.set(activo);
    this.respondida.set(true);
    guardar(activo);
    this.aplicar();
  }

  /** Marca la página para que los estilos del modo accesible se apliquen. */
  private aplicar(): void {
    this.documento.documentElement.toggleAttribute('data-modo-accesible', this.activo());
  }
}
