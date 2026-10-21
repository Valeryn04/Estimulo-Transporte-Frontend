export interface ListasFiltro {
  vigencias: { id: number; anio: number; activa: boolean }[];
  localidades: { id: number; nombre: string }[];
  estados: { codigo: string; nombre: string }[];
}

// ---- bitácora (RF-SEG-01)

export interface EventoBitacora {
  id: number;
  fecha: string;
  usuario: string | null;
  modulo: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  radicado: string | null;
  justificacion: string | null;
  ip: string | null;
  anterior: unknown;
  nuevo: unknown;
  detalle: unknown;
}

export interface PaginaBitacora {
  pagina: number;
  tamano: number;
  total: number;
  sensiblesOcultos: boolean;
  items: EventoBitacora[];
}

export interface FiltroBitacora {
  radicado?: string;
  usuario?: string;
  modulo?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  pagina: number;
  tamano: number;
}

// ---- expediente (RF-SEG-03)

export interface CoincidenciaExpediente {
  solicitudId: number;
  radicado: string | null;
  estado: string;
  anio: number;
  pcdNombre: string;
}

export interface PersonaExpediente {
  nombre: string;
  tipoIdentificacion: string;
  numeroIdentificacion: string;
}

export interface EventoCronologia {
  fecha: string;
  origen: 'bitacora' | 'correo';
  modulo: string;
  accion: string;
  usuario: string | null;
  justificacion: string | null;
  anterior: unknown;
  nuevo: unknown;
}

export interface Expediente {
  solicitudId: number;
  radicado: string | null;
  estado: string;
  vigencia: number;
  localidad: string | null;
  barrio: string | null;
  correo: string | null;
  creadaAt: string;
  correoVerificadoAt: string | null;
  radicadaAt: string | null;
  pcd: PersonaExpediente;
  cuidador: PersonaExpediente | null;
  puntaje: { total: number; matrizVersion: number } | null;
  beneficio: { id: number; estado: string; asignadoAt: string } | null;
  documentos: {
    documento: string;
    estado: string;
    version: number;
    archivo: string;
    origen: string;
    cargadoAt: string;
  }[];
  otrasVigencias: { solicitudId: number; radicado: string | null; estado: string; anio: number }[];
  cronologia: EventoCronologia[];
  sensiblesOcultos: boolean;
}

// ---- tablero (RF-SEG-04)

export interface Tablero {
  vigenciaId: number;
  vigencia: number | null;
  embudo: {
    preinscritos: number;
    caracterizados: number;
    validados: number;
    rechazados: number;
    priorizados: number;
    asignados: number;
    listaEspera: number;
    activos: number;
    entregas: number;
  };
  novedades: { bloqueos: number; levantamientos: number; revocatorias: number };
  avance: { meta: number; asignadosVigentes: number; porcentaje: number };
  presupuesto: {
    total: number;
    comprometido: number;
    disponible: number;
    porcentaje: number;
    cupos: number;
  } | null;
  tiemposPromedioDias: {
    validacion: number | null;
    priorizacion: number | null;
    asignacion: number | null;
    entrega: number | null;
  };
  satisfaccion: number | null;
  porLocalidad: { localidad: string; solicitudes: number; asignados: number }[];
}

export interface FiltroTablero {
  vigenciaId?: number;
  localidadId?: number;
  poblacion?: 'CON_CUIDADOR' | 'SIN_CUIDADOR';
  etapa?: string;
}

// ---- reportes (RF-SEG-05, RF-SEG-06)

export interface Reporte {
  codigo: string;
  nombre: string;
}

export interface FiltroReporte {
  vigenciaId?: number;
  desde?: string;
  hasta?: string;
  localidadId?: number;
  estado?: string;
  poblacion?: 'CON_CUIDADOR' | 'SIN_CUIDADOR';
}

export interface VistaReporte {
  reporte: string;
  nombre: string;
  filtros: string[];
  total: number;
  columnas: { clave: string; titulo: string }[];
  filas: Record<string, string | number | null>[];
}

export interface Exportacion {
  id: number;
  usuario: string;
  reporte: string;
  nombre: string;
  formato: 'XLSX' | 'PDF' | 'CSV';
  filas: number;
  archivo: string;
  sha256: string;
  fecha: string;
}
