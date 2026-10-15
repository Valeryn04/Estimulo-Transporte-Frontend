/**
 * Dirección de residencia estandarizada (nomenclatura urbana de Colombia): se arma por partes y siempre queda con el
 * mismo formato, por ejemplo «Carrera 54 B Bis Sur # 72 A - 30 Este, Apto 301». El servidor valida el mismo formato.
 */

export const TIPOS_VIA = [
  'Calle',
  'Carrera',
  'Avenida',
  'Avenida Calle',
  'Avenida Carrera',
  'Diagonal',
  'Transversal',
  'Circular',
  'Circunvalar',
  'Vía',
  'Autopista',
] as const;

export const ORIENTACIONES = ['Norte', 'Sur', 'Este', 'Oeste'] as const;

export const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Máximo de caracteres del complemento (apartamento, torre, conjunto...). */
export const MAX_COMPLEMENTO = 60;

export interface PartesDireccion {
  tipo: string;
  numero: string;
  letra: string;
  bis: string;
  orientacion: string;
  cruce: string;
  cruceLetra: string;
  placa: string;
  placaOrientacion: string;
  complemento: string;
}

export const PARTES_VACIAS: PartesDireccion = {
  tipo: '',
  numero: '',
  letra: '',
  bis: '',
  orientacion: '',
  cruce: '',
  cruceLetra: '',
  placa: '',
  placaOrientacion: '',
  complemento: '',
};

const NOMBRE_PARTE: Record<keyof PartesDireccion, string> = {
  tipo: 'el tipo de vía',
  numero: 'el número de la vía',
  letra: 'la letra',
  bis: 'Bis',
  orientacion: 'la orientación',
  cruce: 'el número del cruce',
  cruceLetra: 'la letra del cruce',
  placa: 'el número de la placa',
  placaOrientacion: 'la orientación de la placa',
  complemento: 'el complemento',
};

export interface EstadoDireccion {
  /** La persona ya empezó a escribir algo. */
  iniciada: boolean;
  /** Tiene todo lo obligatorio (tipo de vía, número, cruce y placa). */
  completa: boolean;
  /** Qué falta, para decírselo con claridad. */
  faltantes: string[];
  /** La dirección armada (vacía mientras esté incompleta). */
  texto: string;
}

/** Número de hasta 3 dígitos, sin ceros a la izquierda: el 0 no es un número de vía, cruce ni placa. */
const soloDigitos = (v: string) => {
  const n = v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 3);
  return n;
};
const MAYUSCULA = (v: string) =>
  v.length === 1 && LETRAS.includes(v.toUpperCase()) ? v.toUpperCase() : '';

/** Deja el complemento con solo letras, números, espacios, punto, guion y «#», sin espacios repetidos. */
export function limpiarComplemento(v: string): string {
  return v
    .replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .\-#]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.\-#]+/, '')
    .trim()
    .slice(0, MAX_COMPLEMENTO)
    .trim();
}

export function normalizarPartes(p: PartesDireccion): PartesDireccion {
  return {
    tipo: (TIPOS_VIA as readonly string[]).includes(p.tipo) ? p.tipo : '',
    numero: soloDigitos(p.numero),
    letra: MAYUSCULA(p.letra),
    bis: p.bis === 'Bis' ? 'Bis' : '',
    orientacion: (ORIENTACIONES as readonly string[]).includes(p.orientacion) ? p.orientacion : '',
    cruce: soloDigitos(p.cruce),
    cruceLetra: MAYUSCULA(p.cruceLetra),
    placa: soloDigitos(p.placa),
    placaOrientacion: (ORIENTACIONES as readonly string[]).includes(p.placaOrientacion)
      ? p.placaOrientacion
      : '',
    complemento: limpiarComplemento(p.complemento),
  };
}

/** Arma la dirección y dice si está completa y qué falta. */
export function evaluarDireccion(partes: PartesDireccion): EstadoDireccion {
  const p = normalizarPartes(partes);
  const iniciada = (Object.keys(p) as (keyof PartesDireccion)[]).some((k) => p[k] !== '');
  const faltantes = (['tipo', 'numero', 'cruce', 'placa'] as const)
    .filter((k) => p[k] === '')
    .map((k) => NOMBRE_PARTE[k]);
  const completa = iniciada && faltantes.length === 0;
  if (!completa) return { iniciada, completa: false, faltantes, texto: '' };
  const via = [p.tipo, p.numero, p.letra, p.bis, p.orientacion].filter(Boolean).join(' ');
  const cruce = [p.cruce, p.cruceLetra].filter(Boolean).join(' ');
  const placa = [p.placa, p.placaOrientacion].filter(Boolean).join(' ');
  const texto = `${via} # ${cruce} - ${placa}${p.complemento ? `, ${p.complemento}` : ''}`;
  return { iniciada, completa: true, faltantes: [], texto };
}

/** Texto que explica qué falta: «falta el tipo de vía y el número de la placa». */
export function textoFaltantes(faltantes: string[]): string {
  if (faltantes.length === 0) return '';
  const lista =
    faltantes.length === 1
      ? faltantes[0]
      : `${faltantes.slice(0, -1).join(', ')} y ${faltantes[faltantes.length - 1]}`;
  return `falta ${lista}`;
}

const PATRON =
  /^(?<tipo>[^\d]+?) (?<numero>\d{1,3})(?: (?<letra>[A-Z]))?(?: (?<bis>Bis))?(?: (?<orientacion>Norte|Sur|Este|Oeste))? # (?<cruce>\d{1,3})(?: (?<cruceLetra>[A-Z]))? - (?<placa>\d{1,3})(?: (?<placaOrientacion>Norte|Sur|Este|Oeste))?(?:, (?<complemento>.+))?$/;

/** Separa una dirección ya estandarizada en sus partes (null si no tiene el formato). */
export function partesDeDireccion(texto: string): PartesDireccion | null {
  const m = PATRON.exec(texto.trim());
  if (!m?.groups) return null;
  const g = m.groups;
  const partes: PartesDireccion = {
    tipo: g['tipo'] ?? '',
    numero: g['numero'] ?? '',
    letra: g['letra'] ?? '',
    bis: g['bis'] ?? '',
    orientacion: g['orientacion'] ?? '',
    cruce: g['cruce'] ?? '',
    cruceLetra: g['cruceLetra'] ?? '',
    placa: g['placa'] ?? '',
    placaOrientacion: g['placaOrientacion'] ?? '',
    complemento: g['complemento'] ?? '',
  };
  return (TIPOS_VIA as readonly string[]).includes(partes.tipo) ? partes : null;
}
