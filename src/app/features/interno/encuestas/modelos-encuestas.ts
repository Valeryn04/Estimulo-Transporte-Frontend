export type EstadoEncuesta = 'BORRADOR' | 'PUBLICADA' | 'CERRADA';
export type TipoPregunta = 'SELECCION' | 'ESCALA' | 'TEXTO';

export const NOMBRE_ESTADO_ENCUESTA: Record<EstadoEncuesta, string> = {
  BORRADOR: 'Borrador',
  PUBLICADA: 'Publicada',
  CERRADA: 'Cerrada',
};

export const NOMBRE_TIPO_PREGUNTA: Record<TipoPregunta, string> = {
  SELECCION: 'Selección (una opción)',
  ESCALA: 'Escala de 1 a …',
  TEXTO: 'Texto libre',
};

export interface Encuesta {
  id: number;
  titulo: string;
  descripcion: string;
  estado: EstadoEncuesta;
  vigenteDesde: string;
  vigenteHasta: string;
  creadaPor: string;
  creadaAt: string;
  publicadaAt: string | null;
  cerradaAt: string | null;
  invitadas: number;
  respondidas: number;
}

export interface Pregunta {
  id?: number;
  tipo: TipoPregunta;
  texto: string;
  obligatoria: boolean;
  opciones: string[] | null;
  escalaMax: number | null;
}

export interface EncuestaConPreguntas extends Encuesta {
  preguntas: (Pregunta & { id: number })[];
}

export interface DatosEncuesta {
  titulo: string;
  descripcion: string;
  desde: string;
  hasta: string;
  preguntas: Pregunta[];
}

export interface ResultadoPregunta {
  id: number;
  tipo: TipoPregunta;
  texto: string;
  respondidas: number;
  conteo?: { valor: string; cantidad: number }[];
  promedio?: number | null;
  textos?: string[];
}

export interface ResultadosEncuesta {
  encuesta: Encuesta;
  invitadas: number;
  respondidas: number;
  tasaRespuesta: number | null;
  /** De 0 a 100. */
  satisfaccion: number | null;
  porLocalidad: { localidad: string; cantidad: number }[];
  preguntas: ResultadoPregunta[];
}
