/** Cómo se muestran al funcionario los datos de la caracterización (los mismos que diligenció la persona). */

export interface CampoVista {
  campo: string;
  etiqueta: string;
}

export interface SeccionVista {
  titulo: string;
  campos: CampoVista[];
}

export const SECCIONES_DATOS: SeccionVista[] = [
  {
    titulo: 'Datos personales',
    campos: [
      { campo: 'generoId', etiqueta: 'Género' },
      { campo: 'fechaNacimiento', etiqueta: 'Fecha de nacimiento' },
      { campo: 'celular', etiqueta: 'Celular' },
      { campo: 'telefonoFijo', etiqueta: 'Teléfono fijo' },
      { campo: 'estadoCivilId', etiqueta: 'Estado civil' },
    ],
  },
  {
    titulo: 'Su situación',
    campos: [
      { campo: 'tieneHijos', etiqueta: '¿Tiene hijos?' },
      { campo: 'hijosCantidad', etiqueta: 'Cuántos' },
      { campo: 'hijosEdades', etiqueta: 'Edades de los hijos' },
      { campo: 'etniaId', etiqueta: 'Etnia' },
      { campo: 'escolaridadId', etiqueta: 'Nivel de escolaridad' },
      { campo: 'ocupacionId', etiqueta: 'Ocupación' },
    ],
  },
  {
    titulo: 'Salud y apoyos',
    campos: [
      { campo: 'epsId', etiqueta: 'EPS' },
      { campo: 'embarazo', etiqueta: 'Estado de embarazo' },
      { campo: 'semanasGestacion', etiqueta: 'Semanas de gestación' },
      { campo: 'recibeSubsidios', etiqueta: '¿Recibe subsidios u otros beneficios?' },
      { campo: 'subsidioCual', etiqueta: 'Cuáles' },
    ],
  },
  {
    titulo: 'Transporte',
    campos: [
      { campo: 'tipoTransporteId', etiqueta: 'Tipo de transporte' },
      { campo: 'justificacionTransporte', etiqueta: 'Justificación' },
      { campo: 'requiereCuidador', etiqueta: '¿Requiere el servicio para el cuidador?' },
    ],
  },
  {
    titulo: 'Cuidador',
    campos: [
      { campo: 'cuidadorGeneroId', etiqueta: 'Género' },
      { campo: 'cuidadorCelular', etiqueta: 'Celular' },
      { campo: 'cuidadorTelefonoFijo', etiqueta: 'Teléfono fijo' },
      { campo: 'cuidadorCorreo', etiqueta: 'Correo' },
    ],
  },
];

/** Datos sensibles: se guardan cifrados y solo los ven los roles con permiso (Ley 1581 de 2012). */
export const CAMPOS_SENSIBLES = [
  'etniaId',
  'epsId',
  'embarazo',
  'semanasGestacion',
  'recibeSubsidios',
  'subsidioCual',
];

const EMBARAZO: Record<string, string> = { NO: 'No', SI: 'Sí', NO_APLICA: 'No aplica' };

/** El valor de un campo, legible: nombres en lugar de números de lista, Sí/No, fechas con formato. */
export function valorLegible(
  campo: string,
  datos: Record<string, unknown>,
  catalogos: Record<string, string>,
  sensiblesOcultos: boolean,
): string {
  if (sensiblesOcultos && CAMPOS_SENSIBLES.includes(campo))
    return 'Dato sensible (oculto para su rol)';
  const v = datos[campo];
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number' && campo.endsWith('Id')) return catalogos[String(v)] ?? `#${v}`;
  if (campo === 'embarazo') return EMBARAZO[String(v)] ?? String(v);
  if (campo === 'fechaNacimiento') {
    const [a, m, d] = String(v).split('-');
    return a && m && d ? `${d}/${m}/${a}` : String(v);
  }
  if (Array.isArray(v)) return v.map((x) => (x === null ? '?' : String(x))).join(', ');
  return String(v);
}
