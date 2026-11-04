import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, filter, map, tap } from 'rxjs';
import { API_BASE } from '../api/api';

/**
 * Sesión del ciudadano para ver y completar su solicitud. La da el enlace seguro del correo o el código de un
 * solo uso. Vive solo en la memoria de esta pestaña: al cerrarla hay que volver a validar el acceso.
 */
@Injectable({ providedIn: 'root' })
export class SesionCiudadano {
  readonly token = signal<string | null>(null);

  establecer(token: string): void {
    this.token.set(token);
  }

  limpiar(): void {
    this.token.set(null);
  }
}

export type Embarazo = 'NO' | 'SI' | 'NO_APLICA';

/** Datos de la caracterización de la persona con discapacidad y del cuidador (RF-CAR-01, RF-CAR-02). */
export interface DatosCaracterizacion {
  generoId: number | null;
  telefonoFijo: string | null;
  celular: string | null;
  fechaNacimiento: string | null;
  estadoCivilId: number | null;
  tieneHijos: boolean | null;
  hijosCantidad: number | null;
  hijosEdades: (number | null)[] | null;
  etniaId: number | null;
  escolaridadId: number | null;
  ocupacionId: number | null;
  epsId: number | null;
  embarazo: Embarazo | null;
  semanasGestacion: number | null;
  recibeSubsidios: boolean | null;
  subsidioCual: string | null;
  tipoTransporteId: number | null;
  justificacionTransporte: string | null;
  requiereCuidador: boolean | null;
  cuidadorGeneroId: number | null;
  cuidadorTelefonoFijo: string | null;
  cuidadorCelular: string | null;
  cuidadorCorreo: string | null;
}

export type CampoDato = keyof DatosCaracterizacion;

export interface ItemLista {
  id: number;
  codigo: string;
  nombre: string;
}

export interface IdentificacionPersona {
  nombre: string;
  tipoIdentificacion: { codigo: string; nombre: string };
  numero: string;
}

export type CodigoSeccion =
  'datos-personales' | 'situacion' | 'salud-apoyos' | 'transporte' | 'cuidador';

export interface SeccionAvance {
  codigo: CodigoSeccion;
  nombre: string;
  requeridos: number;
  completados: number;
  completa: boolean;
  faltantes: { campo: string; mensaje: string }[];
}

export interface Avance {
  secciones: SeccionAvance[];
  requeridos: number;
  completados: number;
  porcentaje: number;
  completa: boolean;
}

/** Lo que se le pidió corregir a la persona (RF-CAR-06). */
export interface SubsanacionCiudadano {
  estado: 'ABIERTA' | 'VENCIDA' | 'RESPONDIDA';
  venceAt: string;
  respondidaAt: string | null;
  /** Puede modificar lo señalado y enviar su respuesta. */
  puedeResponder: boolean;
  items: { nombre: string; observacion: string; documentoId: number | null; campos: string[] }[];
  documentosEditables: number[];
  camposEditables: string[];
}

export interface RespuestaSubsanacion {
  estado: { codigo: string; nombre: string };
  explicacion: string;
  siguientePaso: string;
}

export interface Caracterizacion {
  solicitud: {
    vigencia: number;
    estado: { codigo: string; nombre: string };
    editable: boolean;
    explicacion: string;
    siguientePaso: string;
    radicado: string | null;
    radicadaAt: string | null;
  };
  pcd: IdentificacionPersona & { correo: string };
  /** Nulo cuando la persona se preinscribió sin cuidador. */
  cuidador: (IdentificacionPersona & { nombreEditable: boolean }) | null;
  datos: DatosCaracterizacion;
  subsanacion: SubsanacionCiudadano | null;
  avance: Avance;
  version: number;
  guardadoAt: string | null;
  catalogos: {
    generos: ItemLista[];
    estadosCiviles: ItemLista[];
    etnias: ItemLista[];
    escolaridades: ItemLista[];
    ocupaciones: ItemLista[];
    eps: ItemLista[];
    tiposTransporte: ItemLista[];
  };
}

export type CambiosCaracterizacion = Partial<DatosCaracterizacion> & {
  version: number;
  pcdNombre?: string;
  cuidadorNombre?: string;
};

export interface CaracterizacionGuardada {
  version: number;
  guardadoAt: string | null;
  pcdNombre: string;
  cuidadorNombre: string | null;
  datos: DatosCaracterizacion;
  avance: Avance;
}

export type EstadoDocumento = 'PENDIENTE' | 'CARGADO' | 'RECHAZADO';
export type FormatoArchivo = 'pdf' | 'jpg' | 'png';

export interface ArchivoDocumento {
  nombre: string;
  formato: FormatoArchivo;
  tamanoBytes: number;
  sha256: string;
  cargadoAt: string;
}

export interface DocumentoSolicitud {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  aplicaA: 'PCD' | 'CUIDADOR' | 'COMUN';
  obligatorio: boolean;
  estado: EstadoDocumento;
  reemplazos: number;
  archivo: ArchivoDocumento | null;
  tieneModelo: boolean;
  /** La carta la genera el sistema con los datos escritos: no se carga. */
  generado: boolean;
  /** Hojas que debe traer el PDF (el certificado de discapacidad trae dos). */
  hojasMinimas: number;
}

export interface DocumentosSolicitud {
  editable: boolean;
  /** Con una subsanación vigente, los únicos documentos que se pueden cargar (null = todos). */
  documentosEditables: number[] | null;
  reglas: { formatos: FormatoArchivo[]; maxMb: number };
  documentos: DocumentoSolicitud[];
  resumen: { obligatorios: number; cargados: number; completo: boolean };
}

export interface PendienteRadicacion {
  campo: string;
  seccion: string;
  mensaje: string;
}

export interface RevisionSolicitud {
  completo: boolean;
  datos: PendienteRadicacion[];
  documentos: PendienteRadicacion[];
}

export interface Radicacion {
  radicado: string;
  radicadaAt: string;
  estado: { codigo: string; nombre: string };
  explicacion: string;
  siguientePaso: string;
  aviso: string;
}

/** Llamadas de la caracterización con la sesión del ciudadano (RF-CAR-01, RF-CAR-02, RF-CAR-04). */
@Injectable({ providedIn: 'root' })
export class CaracterizacionApi {
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SesionCiudadano);
  private readonly base = `${API_BASE}/publico/caracterizacion`;

  private cabeceras() {
    return { headers: { Authorization: `Bearer ${this.sesion.token() ?? ''}` } };
  }

  obtener(): Observable<Caracterizacion> {
    return this.http.get<Caracterizacion>(this.base, this.cabeceras());
  }

  documentos(): Observable<DocumentosSolicitud> {
    return this.http.get<DocumentosSolicitud>(`${this.base}/documentos`, this.cabeceras());
  }

  /** Carga o reemplaza un documento; `progreso` informa el avance del envío (0 a 100). */
  subirDocumento(
    documentoId: number,
    archivo: File,
    progreso?: (porcentaje: number) => void,
  ): Observable<DocumentoSolicitud> {
    const datos = new FormData();
    datos.append('archivo', archivo, archivo.name);
    return this.http
      .post<DocumentoSolicitud>(`${this.base}/documentos/${documentoId}`, datos, {
        ...this.cabeceras(),
        reportProgress: !!progreso,
        observe: 'events',
      })
      .pipe(
        tap((e) => {
          if (e.type === HttpEventType.UploadProgress && e.total && progreso) {
            progreso(Math.round((e.loaded / e.total) * 100));
          }
        }),
        filter((e): e is HttpResponse<DocumentoSolicitud> => e.type === HttpEventType.Response),
        map((e) => e.body as DocumentoSolicitud),
      );
  }

  /** Descarga el archivo que cargó la persona. */
  descargarDocumento(documentoId: number): Observable<Blob> {
    return this.http.get(`${this.base}/documentos/${documentoId}/archivo`, {
      ...this.cabeceras(),
      responseType: 'blob',
    });
  }

  /** La carta que genera el sistema, tal como queda con los datos escritos hasta ahora. */
  cartaGenerada(documentoId: number): Observable<Blob> {
    return this.http.get(`${this.base}/documentos/${documentoId}/carta`, {
      ...this.cabeceras(),
      responseType: 'blob',
    });
  }

  revision(): Observable<RevisionSolicitud> {
    return this.http.get<RevisionSolicitud>(`${this.base}/revision`, this.cabeceras());
  }

  /** Envía las correcciones pedidas por el validador (RF-CAR-06). */
  responderSubsanacion(): Observable<RespuestaSubsanacion> {
    return this.http.post<RespuestaSubsanacion>(
      `${this.base}/subsanacion/responder`,
      {},
      this.cabeceras(),
    );
  }

  radicar(): Observable<Radicacion> {
    return this.http.post<Radicacion>(`${this.base}/radicar`, {}, this.cabeceras());
  }

  /** Dirección del modelo descargable de un documento (carta de solicitud, carta de cuidador). */
  urlModelo(documentoId: number): string {
    return `${API_BASE}/publico/documentos/${documentoId}/modelo`;
  }

  guardar(cambios: CambiosCaracterizacion): Observable<CaracterizacionGuardada> {
    return this.http.patch<CaracterizacionGuardada>(this.base, cambios, this.cabeceras());
  }
}
