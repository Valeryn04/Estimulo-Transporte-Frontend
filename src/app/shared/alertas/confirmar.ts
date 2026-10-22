import { DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';
import { Alertas } from './alertas';

/**
 * Pide confirmación antes de ejecutar la acción de un botón. Si la persona dice que no, no pasa nada; si dice que sí,
 * el botón actúa como si se hubiera pulsado normalmente. Un botón de envío de un formulario con errores no pregunta:
 * deja que el formulario muestre qué falta.
 */
@Directive({ selector: 'button[appConfirmar]' })
export class Confirmar {
  readonly appConfirmar = input.required<string>();
  readonly confirmarTexto = input<string>();
  readonly confirmarBoton = input<string>();
  readonly confirmarPeligro = input(false);

  private readonly boton = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
  private readonly alertas = inject(Alertas);
  private confirmado = false;

  private readonly alPulsar = (evento: Event): void => {
    if (this.confirmado) {
      this.confirmado = false;
      return;
    }
    if (this.boton.disabled) return;
    const formulario = this.boton.form;
    if (this.boton.type === 'submit' && formulario?.classList.contains('ng-invalid')) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    void this.alertas
      .confirmar({
        titulo: this.appConfirmar(),
        texto: this.confirmarTexto(),
        confirmar: this.confirmarBoton(),
        peligro: this.confirmarPeligro(),
      })
      .then((si) => {
        if (!si) return;
        this.confirmado = true;
        this.boton.click();
      });
  };

  constructor() {
    // En la fase de captura, para actuar antes que cualquier otro manejador del botón.
    this.boton.addEventListener('click', this.alPulsar, true);
    inject(DestroyRef).onDestroy(() =>
      this.boton.removeEventListener('click', this.alPulsar, true),
    );
  }
}
