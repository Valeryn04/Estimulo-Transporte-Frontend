/**
 * Lo que se entiende de lo que dice una persona: sí o no, un correo dictado, un nombre, una opción de una lista. Son
 * funciones puras: el reconocimiento de voz entrega texto y aquí se convierte en datos del formulario.
 */

export const sinAcentos = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const AFIRMATIVAS = new Set([
  'si',
  'claro',
  'correcto',
  'exacto',
  'afirmativo',
  'ok',
  'okay',
  'listo',
  'dale',
  'acepto',
  'autorizo',
  'adelante',
  'perfecto',
  'cierto',
  'asi',
]);
const NEGATIVAS = new Set([
  'no',
  'negativo',
  'incorrecto',
  'nunca',
  'tampoco',
  'falso',
  'equivocado',
  'error',
]);

/** Entiende «sí», «claro», «es correcto»… y «no», «incorrecto»…; la primera palabra que decide manda («no, sí es correcto» = no). */
export function interpretarSiNo(texto: string): 'si' | 'no' | null {
  for (const palabra of sinAcentos(texto).split(' ')) {
    if (NEGATIVAS.has(palabra)) return 'no';
    if (AFIRMATIVAS.has(palabra)) return 'si';
  }
  return null;
}

const DIGITOS_EN_PALABRAS: Record<string, string> = {
  cero: '0',
  uno: '1',
  dos: '2',
  tres: '3',
  cuatro: '4',
  cinco: '5',
  seis: '6',
  siete: '7',
  ocho: '8',
  nueve: '9',
};

/** «maria arroba gmail punto com» → «maria@gmail.com». Devuelve null si no parece un correo. */
export function interpretarCorreo(texto: string): string | null {
  // Aquí no se usa sinAcentos: un correo escrito ya trae sus puntos y no deben perderse.
  const palabras = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!,;:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let correo = '';
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i] as string;
    if (p === 'arroba' || p === 'arrova') correo += '@';
    else if (p === 'punto') correo += '.';
    else if (p === 'guion' && palabras[i + 1] === 'bajo') {
      correo += '_';
      i++;
    } else if (p === 'guion' && palabras[i + 1] === 'medio') {
      correo += '-';
      i++;
    } else if (p === 'guion') correo += '-';
    else correo += DIGITOS_EN_PALABRAS[p] ?? p;
  }
  correo = correo.replace(/\.\.+/g, '.');
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(correo) ? correo : null;
}

/** El correo dicho letra por letra, para que la persona lo confirme: «m, a, r, i, a, arroba, g…». */
export function deletrear(texto: string): string {
  const nombres: Record<string, string> = {
    '@': 'arroba',
    '.': 'punto',
    _: 'guion bajo',
    '-': 'guion',
  };
  return Array.from(texto)
    .map((c) => nombres[c] ?? c)
    .join(', ');
}

/** «1045678901» → «1, 0, 4, 5…» para repetir un número dígito por dígito. */
export const leerDigitos = (numero: string): string =>
  Array.from(numero.replace(/\D/g, '')).join(', ');

/** Nombre propio: sin números ni símbolos, con mayúscula inicial en cada palabra. */
export function nombrePropio(texto: string): string {
  return texto
    .replace(/[^\p{L}\s'.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, letra: string) => sep + letra.toUpperCase());
}

export interface OpcionDicha {
  id: number;
  nombre: string;
  /** Otras formas de decirlo («cédula», «tarjeta»). */
  alias?: string[];
}

/** La opción de la lista que mejor coincide con lo dicho: por frase exacta, por alias o por palabras en común. */
export function coincidirOpcion(texto: string, opciones: OpcionDicha[]): OpcionDicha | null {
  const dicho = sinAcentos(texto);
  if (!dicho) return null;
  for (const o of opciones) {
    if ([o.nombre, ...(o.alias ?? [])].some((x) => sinAcentos(x) === dicho)) return o;
  }
  const palabras = (t: string) =>
    sinAcentos(t)
      .split(' ')
      .filter((p) => p.length > 2);
  const dichas = new Set(palabras(dicho));
  let mejor: OpcionDicha | null = null;
  let puntaje = 0;
  let empate = false;
  for (const o of opciones) {
    const comunes = palabras(o.nombre).filter((p) => dichas.has(p)).length;
    if (comunes > puntaje) {
      mejor = o;
      puntaje = comunes;
      empate = false;
    } else if (comunes === puntaje && comunes > 0) {
      empate = true;
    }
  }
  return puntaje > 0 && !empate ? mejor : null;
}
