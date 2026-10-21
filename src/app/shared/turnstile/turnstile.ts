import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { Turnstile } from '../../core/seguridad/turnstile';

/** Casilla de verificación anti-automatización. No ocupa espacio si la verificación está desactivada. */
@Component({
  selector: 'app-turnstile',
  template: `<div #contenedor class="turnstile"></div>`,
  styles: `
    .turnstile:not(:empty) {
      margin: 0 0 16px;
    }
  `,
})
export class TurnstileCasilla implements OnDestroy {
  private readonly turnstile = inject(Turnstile);
  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');

  constructor() {
    afterNextRender(() => void this.turnstile.mostrar(this.contenedor().nativeElement));
  }

  ngOnDestroy(): void {
    this.turnstile.quitar();
  }
}
