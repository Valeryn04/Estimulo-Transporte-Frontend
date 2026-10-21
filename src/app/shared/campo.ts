import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, input, signal } from '@angular/core';
import { AbstractControl, Validators } from '@angular/forms';
import { Ayuda } from './ayuda/ayuda';

const MENSAJES: Record<string, (valor: unknown) => string> = {
  required: () => 'complete este dato',
  email: () => 'escriba un correo válido, por ejemplo nombre@correo.com',
  minlength: (v) =>
    `escriba al menos ${(v as { requiredLength: number }).requiredLength} caracteres`,
  maxlength: (v) =>
    `no puede superar ${(v as { requiredLength: number }).requiredLength} caracteres`,
  min: (v) => `el valor mínimo es ${(v as { min: number }).min}`,
  max: (v) => `el valor máximo es ${(v as { max: number }).max}`,
  pattern: () => 'el formato no es válido',
  mayorEdad: () => 'solo pueden solicitar su inclusión las personas mayores de 18 años',
  fechaFutura: () => 'la fecha no puede ser una fecha futura',
  fechaInvalida: () => 'revise la fecha, no parece válida',
  horaFin: () => 'debe ser posterior a la hora de inicio',
  iguales: () => 'debe ser igual al valor escrito arriba',
  seleccion: () => 'seleccione al menos una opción',
  respuesta: () => 'responda Sí o No',
  numeroIdentificacion: (motivo) => String(motivo),
  direccion: (motivo) => String(motivo),
  correoDiferente: () => 'los dos correos no coinciden, revíselos',
  ocupado: (motivo) => String(motivo),
};

/** Mensaje que explica qué corregir en un control (el mismo que muestra el campo y el resumen de errores). */
export function textoError(
  control: AbstractControl,
  etiqueta: string,
  mensajes: Record<string, string> = {},
): string {
  const errores = control.errors;
  if (!errores) return '';
  const clave = Object.keys(errores)[0] as string;
  const valor: unknown = errores[clave];
  // Los mensajes del servidor ya traen el nombre del campo.
  if (clave === 'servidor') return String(valor);
  const base = mensajes[clave] ?? MENSAJES[clave]?.(valor) ?? 'revise este dato';
  return `${etiqueta}: ${base}`;
}

/**
 * Campo de formulario accesible: etiqueta, ayuda (tooltip con el icono «?»), control proyectado y mensaje de error que dice
 * exactamente qué corregir (RNF-04). Con `tipo="grupo"` se dibuja como fieldset (radios y casillas).
 */
@Component({
  selector: 'app-campo',
  imports: [NgTemplateOutlet, Ayuda],
  templateUrl: './campo.html',
  styleUrl: './campo.scss',
})
export class Campo {
  readonly idCampo = input.required<string>();
  readonly etiqueta = input.required<string>();
  readonly ayuda = input<string>('');
  readonly control = input.required<AbstractControl>();
  readonly tipo = input<'campo' | 'grupo'>('campo');
  /** Sobrescribe el mensaje de un error concreto, por ejemplo { pattern: 'debe tener 10 dígitos' }. */
  readonly mensajes = input<Record<string, string>>({});

  /** Cambia con cada evento del control (valor, estado, tocado) para recalcular lo derivado. */
  private readonly version = signal(0);

  constructor() {
    effect((alLimpiar) => {
      const suscripcion = this.control().events.subscribe(() => this.version.update((n) => n + 1));
      alLimpiar(() => suscripcion.unsubscribe());
    });
  }

  // Depende de `version`: los validadores pueden agregarse o quitarse después de crear el campo.
  readonly obligatorio = computed(() => {
    this.version();
    return this.control().hasValidator(Validators.required);
  });

  readonly mostrarError = computed(() => {
    this.version();
    const c = this.control();
    return c.invalid && (c.touched || c.dirty);
  });

  readonly mensajeError = computed(() => {
    this.version();
    return textoError(this.control(), this.etiqueta(), this.mensajes());
  });

  readonly descripcion = computed(
    () =>
      [
        this.ayuda() ? `${this.idCampo()}-ayuda` : '',
        this.mostrarError() ? `${this.idCampo()}-error` : '',
      ]
        .filter(Boolean)
        .join(' ') || null,
  );
}
