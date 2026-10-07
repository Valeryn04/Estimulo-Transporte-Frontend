import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Quita espacios, puntos y guiones y pasa a mayúsculas (igual que la API). */
export function normalizarNumero(numero: string): string {
  return numero.replace(/[\s.-]/g, '').toUpperCase();
}

const REGLAS: Record<string, { patron: RegExp; ayuda: string }> = {
  CC: { patron: /^\d{5,10}$/, ayuda: 'la cédula de ciudadanía tiene entre 5 y 10 dígitos' },
  TI: { patron: /^\d{6,11}$/, ayuda: 'la tarjeta de identidad tiene entre 6 y 11 dígitos' },
  RC: { patron: /^\d{6,11}$/, ayuda: 'el registro civil tiene entre 6 y 11 dígitos' },
};
const REGLA_GENERAL = {
  patron: /^[A-Z0-9]{4,20}$/,
  ayuda: 'use entre 4 y 20 letras o números, sin espacios ni símbolos',
};

/** Motivo por el que el número no es válido para el tipo de documento, o null si es válido. */
export function errorNumero(tipoCodigo: string | undefined, numero: string): string | null {
  const regla = (tipoCodigo ? REGLAS[tipoCodigo] : undefined) ?? REGLA_GENERAL;
  return regla.patron.test(normalizarNumero(numero)) ? null : regla.ayuda;
}

/** Los tipos de documento que solo admiten dígitos (para mostrar el teclado numérico en el celular). */
export function soloDigitos(tipoCodigo: string | undefined): boolean {
  return !!tipoCodigo && tipoCodigo in REGLAS;
}

/** Valida el número del control según el tipo de documento que devuelve `tipo()`. */
export function numeroSegunTipo(tipo: () => string | undefined): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const valor = String(c.value ?? '');
    if (!valor) return null;
    const motivo = errorNumero(tipo(), valor);
    return motivo ? { numeroIdentificacion: motivo } : null;
  };
}

/** Nombres y apellidos: letras (con tildes), espacios, punto, apóstrofo y guion. */
export const PATRON_NOMBRE = /^[\p{L}\p{M}'.\- ]+$/u;
