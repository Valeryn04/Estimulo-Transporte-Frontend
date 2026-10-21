import { EstadoBeneficio } from '../asignacion/modelos-asignacion';

export type TipoNovedad = 'BLOQUEO' | 'SUSPENSION' | 'LEVANTAMIENTO';

export interface ResumenBeneficio {
  beneficioId: number;
  radicado: string;
  pcdNombre: string;
  estado: EstadoBeneficio;
  novedades: number;
  /** Estado de la revocatoria en curso, si la hay. */
  revocatoria: string | null;
}

export interface Novedad {
  id: number;
  tipo: TipoNovedad;
  tipoNombre: string;
  causal: string | null;
  fechaEfectiva: string;
  observacion: string;
  evidencia: { nombre: string; tamanoBytes: number };
  responsable: string;
  levantamientoProgramado: string | null;
  estadoPrevio: string;
  creadaAt: string;
  abierta: boolean;
}

export type EstadoRevocatoria = 'INICIADA' | 'EN_TRASLADO' | 'CON_DESCARGOS' | 'DECIDIDA';

export const NOMBRE_ESTADO_REVOCATORIA: Record<EstadoRevocatoria, string> = {
  INICIADA: 'Iniciada: falta el traslado',
  EN_TRASLADO: 'En traslado: plazo de descargos',
  CON_DESCARGOS: 'Con descargos: lista para decidir',
  DECIDIDA: 'Decidida',
};

export interface RevocatoriaResumen {
  id: number;
  beneficioId: number;
  radicado: string;
  pcdNombre: string;
  causal: string;
  descripcion: string;
  estado: EstadoRevocatoria;
  resultado: 'REVOCADA' | 'ARCHIVADA' | null;
  trasladoAt: string | null;
  venceDescargosAt: string | null;
  descargosAt: string | null;
  sinDescargos: boolean;
  decididaAt: string | null;
  iniciadaPor: string;
  creadaAt: string;
}

export type EtapaRevocatoria = 'INICIO' | 'TRASLADO' | 'DESCARGOS' | 'SIN_DESCARGOS' | 'ACTO';

export const NOMBRE_ETAPA: Record<EtapaRevocatoria, string> = {
  INICIO: 'Inicio: causal y evidencia',
  TRASLADO: 'Traslado de las razones a la persona',
  DESCARGOS: 'Descargos de la persona',
  SIN_DESCARGOS: 'Venció el plazo sin descargos',
  ACTO: 'Acto administrativo',
};

export interface EventoRevocatoria {
  id: number;
  etapa: EtapaRevocatoria;
  texto: string;
  fecha: string;
  referencia: string | null;
  evidencia: { nombre: string; tamanoBytes: number } | null;
  usuario: string;
  creadoAt: string;
}

export interface Revocatoria extends RevocatoriaResumen {
  puedeDecidir: boolean;
  puedeSinDescargos: boolean;
  plazoDecisionDias: number;
  eventos: EventoRevocatoria[];
}

export interface Causales {
  bloqueo: { id: number; nombre: string }[];
  revocatoria: { id: number; nombre: string }[];
}

export interface ExpedienteNovedades {
  beneficio: {
    id: number;
    radicado: string;
    estado: EstadoBeneficio;
    pcdNombre: string;
    hoy: string;
    asignadoDia: string;
  };
  novedades: Novedad[];
  revocatorias: RevocatoriaResumen[];
  causales: Causales;
}

export type EstadoAlertaCruce = 'PENDIENTE' | 'DESCARTADA' | 'EN_TRAMITE';

export interface AlertaCruce {
  id: number;
  cargaId: number;
  estructura: string;
  beneficioId: number;
  radicado: string;
  pcdNombre: string;
  causalCodigo: string | null;
  detalle: string;
  estado: EstadoAlertaCruce;
  analizadaPor: string | null;
  analizadaAt: string | null;
  observacion: string | null;
  revocatoriaId: number | null;
  creadaAt: string;
}

export interface DatosNovedad {
  tipo: TipoNovedad;
  causalId?: number;
  fechaEfectiva: string;
  observacion: string;
  levantamientoProgramado?: string;
}
