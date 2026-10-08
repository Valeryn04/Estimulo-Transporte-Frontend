export type Catalogo =
  | 'TIPO_IDENTIFICACION'
  | 'LOCALIDAD'
  | 'BARRIO'
  | 'EPS'
  | 'TIPO_TRANSPORTE'
  | 'GENERO'
  | 'ESTADO_CIVIL'
  | 'ETNIA'
  | 'ESCOLARIDAD'
  | 'OCUPACION'
  | 'CAUSAL_BLOQUEO'
  | 'CAUSAL_REVOCATORIA';

/** Nombres con los que se muestran las listas en el portal interno. */
export const NOMBRE_CATALOGO: Record<Catalogo, string> = {
  TIPO_IDENTIFICACION: 'Tipos de identificación',
  LOCALIDAD: 'Localidades',
  BARRIO: 'Barrios',
  EPS: 'EPS',
  TIPO_TRANSPORTE: 'Tipos de transporte',
  GENERO: 'Géneros',
  ESTADO_CIVIL: 'Estados civiles',
  ETNIA: 'Etnias',
  ESCOLARIDAD: 'Niveles de escolaridad',
  OCUPACION: 'Ocupaciones',
  CAUSAL_BLOQUEO: 'Causales de bloqueo',
  CAUSAL_REVOCATORIA: 'Causales de revocatoria',
};

export interface ResumenCatalogo {
  catalogo: Catalogo;
  total: number;
  activos: number;
}

export interface ItemCatalogo {
  id: number;
  catalogo: Catalogo;
  codigo: string;
  nombre: string;
  padreId: number | null;
  padreNombre: string | null;
  orden: number;
  activo: boolean;
  version: number;
  updatedAt: string;
}

export interface DatosItem {
  nombre: string;
  codigo?: string;
  padreId?: number | null;
  /** Posición en la lista (única). Sin indicarla queda al final o conserva la suya. */
  orden?: number;
}

export interface VersionRegistro {
  version: number;
  snapshot: Record<string, unknown>;
  usuario: string | null;
  creadoAt: string;
}

export type AplicaA = 'PCD' | 'CUIDADOR' | 'COMUN';

export const NOMBRE_APLICA_A: Record<AplicaA, string> = {
  PCD: 'Persona con discapacidad',
  CUIDADOR: 'Cuidador',
  COMUN: 'Ambos (documento común)',
};

export interface DocumentoRequerido {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  aplicaA: AplicaA;
  obligatorio: boolean;
  orden: number;
  activo: boolean;
  version: number;
  /** Modelo descargable que publicó la Gerencia (carta de solicitud, carta de cuidador...). */
  modelo?: {
    nombre: string;
    formato: 'pdf' | 'docx' | 'odt';
    tamanoBytes: number;
    cargadoAt: string;
  } | null;
}

export interface DatosDocumento {
  nombre: string;
  descripcion: string;
  aplicaA: AplicaA;
  obligatorio: boolean;
  /** Posición en la lista (única). Sin indicarla queda al final o conserva la suya. */
  orden?: number;
}

export interface VersionParametro {
  id: number;
  valor: string;
  vigenteDesde: string;
  aprobadoPor: string | null;
  justificacion: string | null;
  creadoAt: string;
}

export interface Parametro {
  clave: string;
  grupo: string;
  descripcion: string;
  tipo: 'ENTERO' | 'TEXTO' | 'BOOLEANO';
  minimo: number | null;
  maximo: number | null;
  patron: string | null;
  pendienteDefinicion: boolean;
  vigente: VersionParametro;
  programada: VersionParametro | null;
}

export interface Vigencia {
  id: number;
  anio: number;
  fechaInicio: string;
  fechaFin: string;
  cuposTotales: number;
  activa: boolean;
  version: number;
}

export interface DatosVigencia {
  fechaInicio: string;
  fechaFin: string;
  cuposTotales: number;
}

export interface TextoAutorizacion {
  version: number;
  contenido: string;
  vigenteDesde: string;
  creadoPor: string | null;
}

export interface EstadoAutorizacion {
  vigente: TextoAutorizacion | null;
  versiones: TextoAutorizacion[];
}

export interface PlantillaResumen {
  codigo: string;
  nombre: string;
  descripcion: string;
  version: number;
  actualizadaAt: string;
}

export interface VersionPlantilla {
  version: number;
  asunto: string;
  cuerpo: string;
  justificacion: string | null;
  creadoPor: string | null;
  creadoAt: string;
}

export interface Plantilla {
  codigo: string;
  nombre: string;
  descripcion: string;
  variables: { nombre: string; descripcion: string; obligatoria: boolean }[];
  vigente: VersionPlantilla;
  versiones: VersionPlantilla[];
}

export interface VistaPrevia {
  asunto: string;
  cuerpo: string;
  variablesUsadas: string[];
  problemas: string[];
}
