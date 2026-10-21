export type AplicaACruce = 'PCD' | 'CUIDADOR' | 'AMBOS';

export const NOMBRE_APLICA_CRUCE: Record<AplicaACruce, string> = {
  PCD: 'Persona con discapacidad',
  CUIDADOR: 'Cuidador',
  AMBOS: 'Ambos',
};

export type AlertaNovedad = 'NINGUNA' | 'PRESENCIA' | 'AUSENCIA';

export const NOMBRE_ALERTA_NOVEDAD: Record<AlertaNovedad, string> = {
  NINGUNA: 'No genera alertas de novedades',
  PRESENCIA: 'Alerta a los beneficiarios que aparecen en el archivo',
  AUSENCIA: 'Alerta a los beneficiarios activos que no aparecen en el archivo',
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
  alertaNovedad: AlertaNovedad;
  causalCodigo: string | null;
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
  alertaNovedad: AlertaNovedad;
  causalCodigo: string | null;
}
