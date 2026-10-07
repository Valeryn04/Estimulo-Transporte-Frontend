import { Component, computed, input } from '@angular/core';

/**
 * Identificador de una dependencia según el Manual de Identidad Visual de la Alcaldía de Barranquilla
 * (numeral 1.6): el logo de la Alcaldía, una línea de color y debajo el nombre de la dependencia en
 * mayúsculas espaciadas. No se altera el logo, no se le agregan textos y se respeta su área de resguardo.
 *
 * Sobre fondo oscuro: logo negativo (blanco) con línea amarilla. Sobre fondo claro: logo positivo (azul
 * oscuro) con línea verde.
 */
@Component({
  selector: 'app-lockup-dependencia',
  templateUrl: './lockup-dependencia.html',
  styleUrl: './lockup-dependencia.scss',
  host: { '[class]': 'clases()' },
})
export class LockupDependencia {
  readonly dependencia = input('Gerencia de Desarrollo Social');
  readonly fondo = input<'oscuro' | 'claro'>('oscuro');
  readonly tamano = input<'normal' | 'grande'>('normal');

  protected readonly clases = computed(() => `fondo-${this.fondo()} tamano-${this.tamano()}`);
  protected readonly logo = computed(() =>
    this.fondo() === 'oscuro'
      ? 'identidad/alcaldia-negativo.svg'
      : 'identidad/alcaldia-positivo.svg',
  );
}
