export type EstadoCaso = 'RADICADA' | 'SUBSANADA' | 'EN_REVISION' | 'EN_SUBSANACION' | 'TODOS';

export type ResultadoRequisito = 'CUMPLE' | 'NO_CUMPLE' | 'PENDIENTE' | 'NO_APLICA';
export type DecisionValidacion = 'APROBAR' | 'SUBSANAR' | 'RECHAZAR';

export const NOMBRE_RESULTADO: Record<ResultadoRequisito, string> = {
  CUMPLE: 'Cumple',
  NO_CUMPLE: 'No cumple',
  PENDIENTE: 'Pendiente',
  NO_APLICA: 'No aplica',
};

export const RESULTADOS: ResultadoRequisito[] = ['CUMPLE', 'NO_CUMPLE', 'PENDIENTE', 'NO_APLICA'];

export interface PersonaCaso {
  id: number;
  nombre: string;
  tipo: string;
  numero: string;
}

export interface FilaBandeja {
  solicitudId: number;
  radicado: string;
  radicadaAt: string;
  estado: { codigo: string; nombre: string };
  pcdNombre: string;
  dias: number;
  superaTiempo: boolean;
  asignadoA: { id: number; nombre: string } | null;
  enRevisionPor: { id: number; nombre: string } | null;
  subsanado: boolean;
  ronda: number;
  subsanacionVenceAt: string | null;
  subsanacionVencida: boolean;
}

export interface Bandeja {
  items: FilaBandeja[];
  total: number;
  pagina: number;
  tamano: number;
  tiempoMaxDias: number;
}

export interface FiltroBandeja {
  estado?: EstadoCaso;
  /** 'mios', 'sin' o el id de un validador. */
  asignado?: string;
  q?: string;
  vencidas?: boolean;
  orden: 'radicado' | 'fecha' | 'nombre' | 'estado' | 'dias';
  direccion: 'asc' | 'desc';
  pagina: number;
  tamano: number;
}

export interface Validador {
  id: number;
  usuario: string;
  nombres: string;
}

export interface ItemCaso {
  id: number;
  requisitoId: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  aplicaA: string;
  fuenteSugerida: string;
  documentoId: number | null;
  campos: string[];
  cruceCodigo: string | null;
  resultado: ResultadoRequisito;
  fuente: string;
  observacion: string;
  evidencia: string;
  registradoPor: string | null;
  registradoAt: string | null;
  version: number;
  subsanable: boolean;
}

export interface DocumentoCaso {
  id: number;
  nombre: string;
  aplicaA: string;
  obligatorio: boolean;
  estado: string;
  reemplazos: number;
  archivo: {
    nombre: string;
    formato: string;
    tamanoBytes: number;
    sha256: string;
    cargadoAt: string;
  } | null;
  puedeVer: boolean;
}

export interface DecisionCaso {
  id: number;
  ronda: number;
  decision: DecisionValidacion;
  motivacion: string;
  decididoPor: string;
  decididoAt: string;
}

export interface SubsanacionCaso {
  estado: 'ABIERTA' | 'VENCIDA' | 'RESPONDIDA';
  venceAt: string;
  vencida: boolean;
  respondidaAt: string | null;
  items: { nombre: string; observacion: string }[];
}

/** Coincidencias de la persona o su cuidador en un archivo de cruce (RF-VAL-03). */
export interface AlertaCruce {
  cruceCodigo: string;
  nombre: string | null;
  /** Fecha de la carga consultada; null si todavía no hay archivo cargado. */
  cargadoAt: string | null;
  coincidencias: { persona: 'PCD' | 'CUIDADOR'; detalle: string }[];
}

/** Datos que el validador registra para la priorización (RF-PRI-01) y el puntaje que resulta al validar. */
export interface PriorizacionCaso {
  matrizVersion: number | null;
  variables: {
    codigo: string;
    nombre: string;
    descripcion: string;
    opciones: { codigo: string; etiqueta: string }[];
    valor: string | null;
  }[];
  puntaje: {
    total: number;
    matrizVersion: number;
    calculadoAt: string;
    detalle: { variable: string; nombre: string; etiqueta: string; aporte: number }[];
  } | null;
}

export interface Caso {
  solicitud: {
    id: number;
    radicado: string;
    radicadaAt: string | null;
    vigencia: number;
    estado: { codigo: string; nombre: string };
    dias: number;
    superaTiempo: boolean;
    correo: string;
    direccion: string | null;
    localidad: string | null;
    barrio: string | null;
  };
  pcd: PersonaCaso;
  cuidador: PersonaCaso | null;
  validacion: {
    asignadoA: string | null;
    enRevisionPor: string | null;
    tomadaAt: string | null;
    ronda: number;
    subsanado: boolean;
    puedeEditar: boolean;
    subsanacionesPrevias: number;
    maxRondas: number;
  };
  datos: Record<string, unknown>;
  catalogos: Record<string, string>;
  sensiblesOcultos: boolean;
  version: number;
  documentos: DocumentoCaso[];
  items: ItemCaso[];
  alertas: AlertaCruce[];
  priorizacion: PriorizacionCaso;
  decisiones: DecisionCaso[];
  subsanacion: SubsanacionCaso | null;
}

export interface DatosItem {
  resultado: ResultadoRequisito;
  fuente: string;
  observacion: string;
  evidencia: string;
}

export interface ResultadoDecision {
  estado: { codigo: string; nombre: string };
  venceAt: string | null;
  aviso: string;
}

// ---- lista de chequeo parametrizable (administración)

export type AplicaARequisito = 'PCD' | 'CUIDADOR' | 'COMUN';

export const NOMBRE_APLICA_REQUISITO: Record<AplicaARequisito, string> = {
  PCD: 'Persona con discapacidad',
  CUIDADOR: 'Cuidador',
  COMUN: 'Ambos (común)',
};

export interface Requisito {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  aplicaA: AplicaARequisito;
  fuenteSugerida: string;
  documentoId: number | null;
  documentoNombre: string | null;
  campos: string[];
  cruceCodigo: string | null;
  activo: boolean;
  version: number;
}

export interface DatosRequisito {
  nombre: string;
  descripcion: string;
  aplicaA: AplicaARequisito;
  fuenteSugerida: string;
  documentoId: number | null;
  campos: string[];
  cruceCodigo: string | null;
}
