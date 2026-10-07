import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

let siguiente = 0;

/**
 * Ventana de diálogo modal basada en el elemento nativo <dialog>: atrapa el foco, se cierra con Escape y
 * la entienden los lectores de pantalla. El contenido (formulario y botones) lo pone quien la usa.
 */
@Component({
  selector: 'app-dialogo',
  templateUrl: './dialogo.html',
  styleUrl: './dialogo.scss',
})
export class Dialogo {
  /** Cada diálogo necesita un id propio para su título: puede haber varios en la misma página. */
  protected readonly idTitulo = `titulo-dialogo-${++siguiente}`;
  readonly titulo = input.required<string>();
  readonly abierto = input.required<boolean>();
  readonly cierra = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('d');

  constructor() {
    effect(() => {
      const el = this.dialogo().nativeElement;
      if (this.abierto() && !el.open) this.abrir(el);
      else if (!this.abierto() && el.open) this.cerrar(el);
    });
  }

  // showModal/close no existen en navegadores muy antiguos ni en el entorno de pruebas: se degrada a abrir/cerrar.
  private abrir(el: HTMLDialogElement): void {
    if (typeof el.showModal === 'function') el.showModal();
    else el.setAttribute('open', '');
  }

  private cerrar(el: HTMLDialogElement): void {
    if (typeof el.close === 'function') el.close();
    else el.removeAttribute('open');
  }

  /** Escape o clic en cancelar: el <dialog> ya se cerró, se avisa para sincronizar el estado. */
  protected alCerrar(): void {
    if (this.abierto()) this.cierra.emit();
  }
}
