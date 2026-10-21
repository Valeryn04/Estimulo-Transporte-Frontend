export interface ItemDistribucion {
  tipo: 'LOCALIDAD' | 'TRANSPORTE';
  itemId: number;
  nombre: string;
  cupos: number;
  ocupados: number;
}

export interface ResumenCupos {
  vigencia: { id: number; anio: number; activa: boolean };
  cupos: { totales: number; ocupados: number; liberados: number; disponibles: number };
  valorEstimulo: number;
  presupuesto: { total: number; comprometido: number; disponible: number };
  distribucion: { localidades: ItemDistribucion[]; transportes: ItemDistribucion[] };
}

export interface CuposConCatalogos extends ResumenCupos {
  catalogos: {
    localidades: { id: number; nombre: string }[];
    tiposTransporte: { id: number; nombre: string }[];
  };
}

export type TipoAjuste =
  'CUPOS' | 'VALOR_ESTIMULO' | 'PRESUPUESTO' | 'DISTRIBUCION_LOCALIDAD' | 'DISTRIBUCION_TRANSPORTE';

export const NOMBRE_AJUSTE: Record<TipoAjuste, string> = {
  CUPOS: 'Cupos totales',
  VALOR_ESTIMULO: 'Valor del estímulo',
  PRESUPUESTO: 'Presupuesto total',
  DISTRIBUCION_LOCALIDAD: 'Distribución por localidad',
  DISTRIBUCION_TRANSPORTE: 'Distribución por transporte',
};

export interface AjusteCupos {
  id: number;
  tipo: TipoAjuste;
  valorAnterior: unknown;
  valorNuevo: unknown;
  motivo: string;
  soporte: { nombre: string; tamanoBytes: number } | null;
  creadoPor: string;
  creadoAt: string;
}

export interface CambioCupos {
  cuposTotales?: number;
  valorEstimulo?: number;
  presupuestoTotal?: number;
  distribucionLocalidad?: { itemId: number; cupos: number }[];
  distribucionTransporte?: { itemId: number; cupos: number }[];
  motivo: string;
}

export type MotivoNoAlcanza =
  | 'SIN_CUPO'
  | 'SIN_PRESUPUESTO'
  | 'SIN_CUPO_LOCALIDAD'
  | 'SIN_CUPO_TRANSPORTE'
  | 'PERSONA_CON_BENEFICIO';

export interface FilaPropuesta {
  posicion: number;
  solicitudId: number;
  radicado: string;
  radicadaAt: string;
  pcdNombre: string;
  estado: 'PRIORIZADA' | 'EN_LISTA_ESPERA';
  localidad: string | null;
  transporte: string | null;
  conCuidador: boolean;
  puntaje: number;
  ajuste: number;
  puntajeFinal: number;
  criterioDesempate: string | null;
  alcanza: boolean;
  motivo: MotivoNoAlcanza | null;
  motivoTexto: string | null;
}

export interface Propuesta {
  resumen: ResumenCupos;
  total: number;
  alcanzan: number;
  sinCupo: number;
  items: FilaPropuesta[];
}

export type EstadoBeneficio =
  | 'PENDIENTE_ENTREGA'
  | 'PENDIENTE_ACTIVACION'
  | 'ACTIVO'
  | 'BLOQUEADO'
  | 'SUSPENDIDO'
  | 'FINALIZADO';

export const NOMBRE_ESTADO_BENEFICIO: Record<EstadoBeneficio, string> = {
  PENDIENTE_ENTREGA: 'Pendiente de entrega',
  PENDIENTE_ACTIVACION: 'Pendiente de activación',
  ACTIVO: 'Activo',
  BLOQUEADO: 'Bloqueado',
  SUSPENDIDO: 'Suspendido',
  FINALIZADO: 'Finalizado',
};

export interface Beneficiario {
  id: number;
  solicitudId: number;
  radicado: string;
  pcdNombre: string;
  estado: EstadoBeneficio;
  personas: number;
  valorComprometido: number;
  localidad: string | null;
  transporte: string | null;
  puntajeFinal: number;
  posicion: number;
  asignadoPor: string;
  asignadoAt: string;
  reemplazaRadicado: string | null;
  finalizadoAt: string | null;
  motivoFin: string | null;
  entregas: number;
}

export interface Alerta {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  solicitudId: number | null;
  creadaAt: string;
}

export type RolBeneficiario = 'PCD' | 'CUIDADOR';
export type TipoReceptor = 'PCD' | 'CUIDADOR' | 'TERCERO';

export const NOMBRE_ROL: Record<RolBeneficiario, string> = {
  PCD: 'Persona con discapacidad',
  CUIDADOR: 'Cuidador',
};

export const NOMBRE_RECEPTOR: Record<TipoReceptor, string> = {
  PCD: 'La persona con discapacidad',
  CUIDADOR: 'El cuidador',
  TERCERO: 'Un tercero autorizado',
};

export interface EntregaRegistrada {
  id: number;
  rol: RolBeneficiario;
  /** Identificador con solo los últimos caracteres visibles. */
  tarjeta: string;
  tipoTransporte: string;
  fechaEntrega: string;
  receptorTipo: TipoReceptor;
  receptorNombre: string;
  receptorTipoIdentificacion: string | null;
  receptorNumero: string | null;
  funcionarioEntrega: string;
  soporte: { nombre: string; tamanoBytes: number };
  vigente: boolean;
  registradoPor: string;
  registradoAt: string;
}

export interface DetalleBeneficio {
  beneficio: {
    id: number;
    solicitudId: number;
    radicado: string;
    estado: EstadoBeneficio;
    personas: number;
    pcdNombre: string;
    asignadoAt: string;
    activadoAt: string | null;
    hoy: string;
    asignadoDia: string;
  };
  personas: { rol: RolBeneficiario; nombre: string; tipoIdentificacion: string; numero: string }[];
  pendientes: RolBeneficiario[];
  entregas: EntregaRegistrada[];
  opciones: {
    tiposTransporte: { id: number; nombre: string }[];
    tiposIdentificacion: { id: number; nombre: string }[];
  };
}

export interface DatosEntrega {
  rol: RolBeneficiario;
  tarjetaId: string;
  tipoTransporteId: number;
  fechaEntrega: string;
  receptorTipo: TipoReceptor;
  receptorNombre?: string;
  receptorTipoIdentificacionId?: number;
  receptorNumero?: string;
  funcionarioEntrega: string;
}
