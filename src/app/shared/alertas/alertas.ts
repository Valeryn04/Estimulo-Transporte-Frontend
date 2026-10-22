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
  private visible = false;

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
      target: this.destino(),
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
    if (this.visible) {
      this.visible = false;
      // Solo se cierra la carga: un aviso o una pregunta que se haya abierto mientras tanto se respeta.
      if (Swal.isVisible() && Swal.isLoading()) Swal.close();
    }
  }

  private mostrarCarga(): void {
    this.temporizador = null;
    this.visible = true;
    void Swal.fire({
      title: 'Procesando…',
      text: 'Espere un momento, por favor.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      target: this.destino(),
      didOpen: () => Swal.showLoading(),
    });
  }
}
