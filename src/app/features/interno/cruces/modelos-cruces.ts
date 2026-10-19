export type AplicaACruce = 'PCD' | 'CUIDADOR' | 'AMBOS';

export const NOMBRE_APLICA_CRUCE: Record<AplicaACruce, string> = {
  PCD: 'Persona con discapacidad',
  CUIDADOR: 'Cuidador',
  AMBOS: 'Ambos',
};

export interface CargaCruce {
  id: number;
  archivoNombre: string;
  filasTotal: number;
  filasValidas: number;
  filasError: number;
  vigente: boolean;
  cargadoPor: string;
  cargadoAt: string;
}

export interface EstructuraCruce {
  id: number;
  codigo: string;
  nombre: string;
  entidad: string;
  descripcion: string;
  columnaIdentificacion: string;
  columnaDetalle: string | null;
  aplicaA: AplicaACruce;
  activo: boolean;
  version: number;
  vigente: CargaCruce | null;
}

export interface DatosEstructuraCruce {
  nombre: string;
  entidad: string;
  descripcion: string;
  columnaIdentificacion: string;
  columnaDetalle: string | null;
  aplicaA: AplicaACruce;
}
