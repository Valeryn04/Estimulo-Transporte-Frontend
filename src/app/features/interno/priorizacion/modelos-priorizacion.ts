export type EstadoMatriz = 'BORRADOR' | 'EN_APROBACION' | 'VIGENTE' | 'ARCHIVADA' | 'RECHAZADA';

export const NOMBRE_ESTADO_MATRIZ: Record<EstadoMatriz, string> = {
  BORRADOR: 'Borrador',
  EN_APROBACION: 'Pendiente de aprobación',
  VIGENTE: 'Vigente',
  ARCHIVADA: 'Archivada',
  RECHAZADA: 'Rechazada',
};

export type OrigenVariable = 'VALIDADOR' | 'SUBSIDIOS';

export const NOMBRE_ORIGEN: Record<OrigenVariable, string> = {
  VALIDADOR: 'Lo registra el validador',
  SUBSIDIOS: 'Sale de la caracterización (subsidios)',
};

/** Opciones fijas de la variable que sale de la caracterización: solo se les pone el puntaje. */
export const OPCIONES_SUBSIDIOS = [
  { codigo: 'SIN_SUBSIDIOS', etiqueta: 'No recibe otros subsidios' },
  { codigo: 'CON_SUBSIDIOS', etiqueta: 'Recibe otros subsidios' },
] as const;

export interface OpcionMatriz {
  codigo: string;
  etiqueta: string;
  puntos: number;
}

export interface VariableMatriz {
  codigo: string;
  nombre: string;
  descripcion: string;
  origen: OrigenVariable;
  peso: number;
  opciones: OpcionMatriz[];
}

export interface ResumenMatriz {
  id: number;
  version: number;
  estado: EstadoMatriz;
  notas: string;
  creadaPor: string | null;
  creadaAt: string;
  solicitadaPor: string | null;
  decididaPor: string | null;
  decididaAt: string | null;
  motivoDecision: string | null;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
}

export interface Matriz extends ResumenMatriz {
  desempate: string[];
  desempateTexto: (string | null)[];
  puntajeMaximo: number;
  variables: VariableMatriz[];
  solicitadaAt: string | null;
}

export interface DefinicionMatriz {
  notas: string;
  desempate: string[];
  variables: VariableMatriz[];
}

export interface FilaSimulacion {
  solicitudId: number;
  radicado: string;
  pcdNombre: string;
  puntajeActual: number | null;
  puntajeSimulado: number;
  posicionActual: number | null;
  posicionSimulada: number;
  /** Positivo: sube de posición; negativo: baja. */
  cambio: number | null;
  faltantes: string[];
}

export interface Simulacion {
  matriz: { id: number; version: number; puntajeMaximo: number };
  vigenteVersion: number | null;
  resumen: {
    casos: number;
    conPuntajeActual: number;
    cambianPosicion: number;
    suben: number;
    bajan: number;
    sinDatos: number;
  };
  items: FilaSimulacion[];
  truncado: boolean;
}

export interface AporteVariable {
  variable: string;
  nombre: string;
  valor: string;
  etiqueta: string;
  puntos: number;
  peso: number;
  aporte: number;
}

export interface FilaListado {
  posicion: number;
  solicitudId: number;
  radicado: string;
  radicadaAt: string;
  estado: string;
  pcdNombre: string;
  localidad: string | null;
  transporte: string | null;
  conCuidador: boolean | null;
  puntaje: number;
  ajuste: number;
  puntajeFinal: number;
  matrizVersion: number;
  calculadoAt: string;
  criterioDesempate: string | null;
  excepcionPendiente: boolean;
}

export interface Listado {
  items: FilaListado[];
  total: number;
  matrizVersion: number | null;
  desempate: (string | null)[];
  vigenciaId: number | null;
}

export interface FiltroListado {
  localidadId?: number;
  transporteId?: number;
  poblacion?: 'CON_CUIDADOR' | 'SIN_CUIDADOR';
  q?: string;
  pagina: number;
  tamano: number;
}

export interface CalculoCaso {
  id: number;
  matrizVersion: number;
  puntaje: number;
  detalle: AporteVariable[];
  vigente: boolean;
  calculadoPor: string | null;
  calculadoAt: string;
}

export type EstadoExcepcion = 'PROPUESTA' | 'APROBADA' | 'RECHAZADA';

export const NOMBRE_ESTADO_EXCEPCION: Record<EstadoExcepcion, string> = {
  PROPUESTA: 'Pendiente de decisión',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

export interface Excepcion {
  id: number;
  solicitudId: number;
  radicado: string;
  pcdNombre: string;
  puntajeOriginal: number;
  ajuste: number;
  puntajeConAjuste: number;
  justificacion: string;
  evidencia: { nombre: string; mime: string; tamanoBytes: number; sha256: string };
  estado: EstadoExcepcion;
  propuestaPor: string;
  propuestaAt: string;
  decididaPor: string | null;
  decididaAt: string | null;
  motivoDecision: string | null;
  /** Sigue aplicándose al puntaje vigente del caso. */
  aplicable: boolean;
}

export interface CasoPuntaje {
  solicitud: { id: number; radicado: string; estado: string; pcdNombre: string };
  puntaje: number | null;
  ajuste: number;
  puntajeFinal: number | null;
  calculos: CalculoCaso[];
  excepciones: Excepcion[];
}

export interface ResultadoMasivo {
  matrizVersion: number;
  calculados: number;
  sinCambio: number;
  omitidos: { radicado: string; motivo: string }[];
}

export type DecisionPriorizacion = 'APROBAR' | 'RECHAZAR';
