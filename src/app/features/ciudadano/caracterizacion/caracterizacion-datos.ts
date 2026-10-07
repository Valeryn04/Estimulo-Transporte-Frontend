import { ValidationErrors, ValidatorFn } from '@angular/forms';
import { hoyIso } from '../../../shared/forms';
import { CampoDato, DatosCaracterizacion } from '../../../core/publico/caracterizacion-api';

/** Todos los datos de la caracterización, en el orden en que se piden. */
export const CAMPOS: readonly CampoDato[] = [
  'generoId',
  'telefonoFijo',
  'celular',
  'fechaNacimiento',
  'estadoCivilId',
  'tieneHijos',
  'hijosCantidad',
  'hijosEdades',
  'etniaId',
  'escolaridadId',
  'ocupacionId',
  'epsId',
  'embarazo',
  'semanasGestacion',
  'recibeSubsidios',
  'subsidioCual',
  'tipoTransporteId',
  'justificacionTransporte',
  'requiereCuidador',
  'cuidadorGeneroId',
  'cuidadorTelefonoFijo',
  'cuidadorCelular',
  'cuidadorCorreo',
];

export const MAX_HIJOS = 20;

/** Deja solo los dígitos y quita el indicativo del país: «+57 300 123 4567» → «3001234567». */
export function normalizarTelefono(texto: string): string {
  const d = texto.replace(/\D/g, '');
  return d.length === 12 && d.startsWith('57') ? d.slice(2) : d;
}

/** Texto sin espacios sobrantes; vacío equivale a «sin dato». */
export function textoONulo(v: string | null | undefined): string | null {
  const t = (v ?? '').trim().replace(/\s+/g, ' ');
  return t === '' ? null : t;
}

/**
 * Hace coherentes los datos que dependen de otros, igual que el servidor: lo que ya no aplica se borra.
 * Así lo que la persona ve es lo mismo que queda guardado.
 */
export function aplicarDependencias(d: DatosCaracterizacion): DatosCaracterizacion {
  const r = { ...d };
  if (r.tieneHijos !== true) {
    r.hijosCantidad = null;
    r.hijosEdades = null;
  } else if (r.hijosCantidad !== null) {
    const edades = r.hijosEdades ?? [];
    r.hijosEdades = Array.from({ length: r.hijosCantidad }, (_, i) => edades[i] ?? null);
  } else {
    r.hijosEdades = null;
  }
  if (r.embarazo !== 'SI') r.semanasGestacion = null;
  if (r.recibeSubsidios !== true) r.subsidioCual = null;
  if (r.requiereCuidador !== true) {
    r.cuidadorGeneroId = null;
    r.cuidadorTelefonoFijo = null;
    r.cuidadorCelular = null;
    r.cuidadorCorreo = null;
  }
  return r;
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Campos cuyo valor es distinto del que tiene guardado el servidor, limitados a los que se pueden enviar. */
export function camposCambiados(
  actual: DatosCaracterizacion,
  guardado: DatosCaracterizacion,
  enviables: ReadonlySet<string>,
): CampoDato[] {
  return CAMPOS.filter((c) => enviables.has(c) && !igual(actual[c], guardado[c]));
}

// ---------------------------------------------------------------------------------------------------------
// Validadores: los mismos criterios del servidor, para avisar mientras la persona escribe.
// ---------------------------------------------------------------------------------------------------------

const vacio = (v: unknown): boolean => v === null || v === undefined || v === '';

export const celularValido: ValidatorFn = (c): ValidationErrors | null => {
  if (vacio(c.value)) return null;
  return /^3\d{9}$/.test(normalizarTelefono(String(c.value))) ? null : { celular: true };
};

export const fijoValido: ValidatorFn = (c): ValidationErrors | null => {
  if (vacio(c.value)) return null;
  return /^(\d{7}|60\d{8})$/.test(normalizarTelefono(String(c.value))) ? null : { fijo: true };
};

export const correoValido: ValidatorFn = (c): ValidationErrors | null => {
  if (vacio(c.value)) return null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c.value).trim()) ? null : { correo: true };
};

export const nombreValido: ValidatorFn = (c): ValidationErrors | null => {
  if (vacio(c.value)) return null;
  return /^[\p{L}\p{M}'.\- ]+$/u.test(String(c.value)) ? null : { nombre: true };
};

export const fechaNacimientoValida: ValidatorFn = (c): ValidationErrors | null => {
  const v = c.value as string | null;
  if (vacio(v)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v as string)) return { fechaInvalida: true };
  if ((v as string) > hoyIso()) return { fechaFutura: true };
  if ((v as string) < '1900-01-01') return { fechaInvalida: true };
  return null;
};

/** Mensajes propios de este formulario para los errores de los validadores. */
export const MENSAJES = {
  celular: 'escriba 10 dígitos y que empiece por 3, por ejemplo 300 123 4567',
  fijo: 'escriba 7 dígitos, o 10 si incluye el indicativo 60',
  correo: 'escriba un correo válido, por ejemplo nombre@correo.com',
  nombre: 'use solo letras, espacios, punto, apóstrofo o guion',
  fechaFutura: 'la fecha no puede ser una fecha futura',
  fechaInvalida: 'escriba una fecha válida, con día, mes y año',
  required: 'complete este dato',
  respuesta: 'responda Sí o No',
  min: 'el valor está por debajo del mínimo',
  max: 'el valor supera el máximo',
} as const;
