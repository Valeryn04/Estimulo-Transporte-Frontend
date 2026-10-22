import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api';

export interface OpcionCatalogo {
  id: number;
  nombre: string;
}

export interface TipoIdentificacion extends OpcionCatalogo {
  codigo: string;
}

export interface BarrioOpcion extends OpcionCatalogo {
  localidadId: number | null;
}

export interface FormularioPreinscripcion {
  abierta: boolean;
  anio: number | null;
  tiposIdentificacion: TipoIdentificacion[];
  localidades: OpcionCatalogo[];
  barrios: BarrioOpcion[];
  autorizacion: { version: number; contenido: string } | null;
  formularioToken: string;
}

export interface DatosPreinscripcion {
  pcdNombre: string;
  pcdTipoIdentificacionId: number;
  pcdNumero: string;
  /** Falso cuando la persona no tiene cuidador: entonces no se envían sus datos. */
  tieneCuidador: boolean;
  /** Quién llenó el formulario. */
  diligenciadaPor: 'PCD' | 'CUIDADOR';
  cuidadorNombre?: string;
  cuidadorTipoIdentificacionId?: number;
  cuidadorNumero?: string;
  direccion: string | null;
  localidadId: number | null;
  barrioId: number | null;
  correo: string;
  correoConfirmacion: string;
  aceptaAutorizacion: true;
  autorizacionVersion: number;
  formularioToken: string;
  /** Campo trampa: debe ir vacío. */
  contactoAlterno: string;
}

export interface PreinscripcionCreada {
  correoEnmascarado: string;
  horasVigenciaEnlace: number;
}

export interface SesionConsulta {
  token: string;
  expiraEnMinutos: number;
}

export interface Comunicacion {
  id: number;
  nombre: string;
  asunto: string;
  enviadoAt: string;
  entrega: string;
}

export interface RevocatoriaPersona {
  causal: string;
  estado: 'INICIADA' | 'EN_TRASLADO' | 'CON_DESCARGOS';
  razones: string | null;
  venceDescargosAt: string | null;
  puedePresentarDescargos: boolean;
  presentoDescargos: boolean;
}

/** La solicitud se indica con la identificación de la persona con discapacidad o con el número de radicado. */
export type IdentificacionConsulta =
  { tipoIdentificacionId: number; numero: string } | { radicado: string };

export interface EstadoSolicitud {
  vigencia: number;
  personaConDiscapacidad: string;
  correo: string;
  fechaPreinscripcion: string;
  radicado: string | null;
  fechaRadicacion: string | null;
  etapa: string;
  estado: { codigo: string; nombre: string };
  explicacion: string;
  siguientePaso: string;
  aviso: string;
  comunicaciones: Comunicacion[];
}

/** Llamadas del portal ciudadano a la API pública (sin sesión). */
@Injectable({ providedIn: 'root' })
export class PublicoApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/publico`;

  formulario(): Observable<FormularioPreinscripcion> {
    return this.http.get<FormularioPreinscripcion>(`${this.base}/preinscripcion/formulario`);
  }

  preinscribir(d: DatosPreinscripcion): Observable<PreinscripcionCreada> {
    return this.http.post<PreinscripcionCreada>(`${this.base}/preinscripciones`, d);
  }

  verificarCorreo(token: string): Observable<{ estado: 'VERIFICADO' | 'YA_VERIFICADO' }> {
    return this.http.post<{ estado: 'VERIFICADO' | 'YA_VERIFICADO' }>(
      `${this.base}/preinscripciones/verificar-correo`,
      { token },
    );
  }

  reenviarVerificacion(d: {
    tipoIdentificacionId: number;
    numero: string;
  }): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${this.base}/preinscripciones/reenviar-verificacion`,
      d,
    );
  }

  solicitarCodigo(d: IdentificacionConsulta): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/consulta/solicitar-codigo`, d);
  }

  verificarCodigo(d: IdentificacionConsulta & { codigo: string }): Observable<SesionConsulta> {
    return this.http.post<SesionConsulta>(`${this.base}/consulta/verificar-codigo`, d);
  }

  accederPorEnlace(token: string): Observable<SesionConsulta> {
    return this.http.post<SesionConsulta>(`${this.base}/consulta/enlace`, { token });
  }

  /** Trámite de revocatoria en curso de la persona: razones, plazo y si puede presentar descargos. */
  revocatoria(token: string): Observable<{ revocatoria: RevocatoriaPersona | null }> {
    return this.http.get<{ revocatoria: RevocatoriaPersona | null }>(
      `${this.base}/consulta/revocatoria`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  /** La persona presenta sus descargos (texto y, si quiere, un archivo). */
  presentarDescargos(
    token: string,
    texto: string,
    archivo: File | null,
  ): Observable<{ mensaje: string }> {
    const form = new FormData();
    form.append('texto', texto);
    if (archivo) form.append('archivo', archivo, archivo.name);
    return this.http.post<{ mensaje: string }>(`${this.base}/consulta/descargos`, form, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /** Estado de la solicitud con la sesión que entregó el código o el enlace seguro. */
  consultar(token: string): Observable<EstadoSolicitud> {
    return this.http.get<EstadoSolicitud>(`${this.base}/consulta/solicitud`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
