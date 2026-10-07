import { Directive, inject } from '@angular/core';
import { Campo } from './campo';

/** Conecta el input proyectado con su etiqueta, ayuda y error para lectores de pantalla. */
@Directive({
  selector: '[appCampoControl]',
  host: {
    '[attr.id]': 'campo.idCampo()',
    '[attr.aria-describedby]': 'campo.descripcion()',
    '[attr.aria-invalid]': 'campo.mostrarError() ? "true" : null',
    '[attr.aria-required]': 'campo.obligatorio() ? "true" : null',
  },
})
export class CampoControl {
  protected readonly campo = inject(Campo);
}
