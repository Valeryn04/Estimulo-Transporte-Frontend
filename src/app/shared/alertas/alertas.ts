import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

export interface OpcionesConfirmacion {
  titulo: string;
  texto?: string;
  confirmar?: string;
  cancelar?: string;
  /** Acción difícil de deshacer: el foco queda en cancelar y el botón se muestra en rojo. */
  peligro?: boolean;
}

/** Espera antes de mostrar la barra de carga, para no parpadear en las respuestas rápidas. */
const ESPERA_CARGA_MS = 300;

const CLASES = {
  confirmButton: 'boton',
  cancelButton: 'boton secundario',
  denyButton: 'boton secundario',
};

/**
 * Avisos y confirmaciones con SweetAlert2: preguntar antes de una acción importante, mostrar una barra de carga
 * mientras el servidor responde y confirmar el resultado con un aviso breve.
 */
@Injectable({ providedIn: 'root' })
export class Alertas {
  private pendientes = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private velo: HTMLElement | null = null;
  private seguro: ReturnType<typeof setTimeout> | null = null;

  /** Dentro de un <dialog> modal solo se ve (y se puede usar) lo que está dentro de él. */
  private destino(): HTMLElement {
    return document.querySelector<HTMLElement>('dialog[open]') ?? document.body;
  }

  async confirmar(o: OpcionesConfirmacion): Promise<boolean> {
    const r = await Swal.fire({
      icon: o.peligro ? 'warning' : 'question',
      title: o.titulo,
      text: o.texto,
      showCancelButton: true,
      confirmButtonText: o.confirmar ?? 'Sí, continuar',
      cancelButtonText: o.cancelar ?? 'No, volver',
      reverseButtons: true,
      focusCancel: o.peligro === true,
      buttonsStyling: false,
      target: this.destino(),
      customClass: { ...CLASES, confirmButton: o.peligro ? 'boton peligro' : 'boton' },
    });
    return r.isConfirmed;
  }

  /** Aviso breve en una esquina; se cierra solo. */
  aviso(tipo: SweetAlertIcon, titulo: string, texto?: string): void {
    void Swal.fire({
      toast: true,
      position: 'top-end',
      icon: tipo,
      title: titulo,
      text: texto,
      showConfirmButton: false,
      timer: tipo === 'error' ? 6000 : 3500,
      timerProgressBar: true,
      // En el cuerpo: si el aviso quedara dentro de un diálogo que se cierra, dejaría la ventana a medias.
      target: document.body,
    });
  }

  exito(titulo: string, texto?: string): void {
    this.aviso('success', titulo, texto);
  }

  /** Aviso que la persona debe leer y cerrar. */
  async problema(titulo: string, texto?: string): Promise<void> {
    await Swal.fire({
      icon: 'error',
      title: titulo,
      text: texto,
      confirmButtonText: 'Entendido',
      buttonsStyling: false,
      target: this.destino(),
      customClass: CLASES,
    });
  }

  /** Una petición que modifica datos empezó: si tarda, se muestra la barra de carga. */
  iniciarCarga(): void {
    this.pendientes++;
    if (this.pendientes === 1) {
      this.temporizador = setTimeout(() => this.mostrarCarga(), ESPERA_CARGA_MS);
    }
  }

  terminarCarga(): void {
    this.pendientes = Math.max(0, this.pendientes - 1);
    if (this.pendientes > 0) return;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.quitarCarga();
  }

  /**
   * La barra de carga es un elemento propio (no una ventana de SweetAlert): así no puede dejar la página bloqueada si
   * una ventana se cierra a medias, y siempre se retira cuando termina la última petición.
   */
  private mostrarCarga(): void {
    this.temporizador = null;
    this.quitarCarga();
    const velo = document.createElement('div');
    velo.className = 'carga-global';
    velo.setAttribute('role', 'status');
    velo.setAttribute('aria-live', 'polite');
    velo.innerHTML =
      '<div class="carga-global__caja"><div class="carga-global__barra"><span></span></div>' +
      '<p>Procesando… espere un momento, por favor.</p></div>';
    this.destino().appendChild(velo);
    this.velo = velo;
    // Seguro: si por alguna razón nunca termina, no deja la pantalla tapada.
    this.seguro = setTimeout(() => this.quitarCarga(), 90_000);
  }

  private quitarCarga(): void {
    if (this.seguro) clearTimeout(this.seguro);
    this.seguro = null;
    this.velo?.remove();
    this.velo = null;
  }
}
