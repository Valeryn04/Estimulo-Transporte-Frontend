import { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { map, startWith } from 'rxjs';

/** Valor de un control como signal: la plantilla se actualiza sola, también sin zone.js. */
export function valorDe<T>(control: AbstractControl<T>): Signal<T> {
  return toSignal(
    control.valueChanges.pipe(
      startWith(control.value),
      map(() => control.value),
    ),
    {
      initialValue: control.value,
    },
  ) as Signal<T>;
}

const FORMATO_BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Fecha 'AAAA-MM-DD' en hora de Colombia (America/Bogota, UTC-5 todo el año), sin importar la zona horaria
 * del dispositivo: así «hoy» coincide con el del servidor aunque la persona esté en otro país.
 */
export function hoyIso(ahora: Date = new Date()): string {
  const p = Object.fromEntries(FORMATO_BOGOTA.formatToParts(ahora).map((x) => [x.type, x.value]));
  return `${p['year']}-${p['month']}-${p['day']}`;
}

/** Suma (o resta) días a una fecha 'AAAA-MM-DD' sin depender de la zona horaria del dispositivo. */
export function sumarDiasIso(iso: string, dias: number): string {
  const f = new Date(`${iso}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/** Edad cumplida a la fecha dada (hora de Colombia), a partir de 'AAAA-MM-DD'. */
export function calcularEdad(fechaNacimiento: string, ahora: Date = new Date()): number {
  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number) as [number, number, number];
  const [aHoy, mHoy, dHoy] = hoyIso(ahora).split('-').map(Number) as [number, number, number];
  let edad = aHoy - anio;
  if (mHoy < mes || (mHoy === mes && dHoy < dia)) edad -= 1;
  return edad;
}

export const validarMayorDeEdad: ValidatorFn = (c): ValidationErrors | null => {
  const v = c.value as string | null;
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  if (v > hoyIso()) return { fechaFutura: true };
  if (v < '1900-01-01') return { fechaInvalida: true };
  return calcularEdad(v) < 18 ? { mayorEdad: true } : null;
};

export const validarMesNoFuturo: ValidatorFn = (c): ValidationErrors | null => {
  const v = c.value as string | null;
  if (!v) return null;
  return v > hoyIso().slice(0, 7) ? { fechaFutura: true } : null;
};

/** Marca el control con un error que viene del servidor; se limpia al volver a escribir. */
export function marcarErrorServidor(control: AbstractControl, mensaje: string): void {
  control.setErrors({ ...(control.errors ?? {}), servidor: mensaje });
  control.markAsTouched();
  const limpiar = control.valueChanges.subscribe(() => {
    if (control.errors?.['servidor']) {
      const { servidor: _servidor, ...resto } = control.errors;
      void _servidor;
      control.setErrors(Object.keys(resto).length ? resto : null);
    }
    limpiar.unsubscribe();
  });
}

/** El valor del control debe ser igual al de otro control hermano (por ejemplo, confirmar contraseña). */
export function igualA(otro: string, mensaje = 'iguales'): ValidatorFn {
  return (c): ValidationErrors | null => {
    const referencia = c.parent?.get(otro)?.value as string | null | undefined;
    return c.value && referencia !== undefined && c.value !== referencia
      ? { [mensaje]: true }
      : null;
  };
}

/** Lleva los errores de validación de la API a los controles cuyo nombre coincide con el campo. */
export function aplicarErroresApi(
  grupo: { get(nombre: string): AbstractControl | null },
  errores: { campo: string; mensaje: string }[],
): string[] {
  const sinControl: string[] = [];
  for (const e of errores) {
    const control = grupo.get(e.campo.split('.').at(-1) as string);
    if (control) marcarErrorServidor(control, e.mensaje);
    else sinControl.push(e.mensaje);
  }
  return sinControl;
}
