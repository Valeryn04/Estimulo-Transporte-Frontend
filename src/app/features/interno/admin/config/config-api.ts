import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../../../core/api/api';
import { Pagina } from '../modelos';
import {
  Catalogo,
  DatosDocumento,
  DatosItem,
  DatosVigencia,
  DocumentoRequerido,
  EstadoAutorizacion,
  ItemCatalogo,
  Parametro,
  Plantilla,
  PlantillaResumen,
  ResumenCatalogo,
  Vigencia,
  VersionParametro,
  VersionRegistro,
  VistaPrevia,
} from './modelos-config';

const ADMIN = `${API_BASE}/admin`;

export interface FiltroItems {
  q?: string;
  activo?: boolean;
  padreId?: number;
  /** Solo el elemento que ocupa esa posición. */
  orden?: number;
  pagina: number;
  tamano: number;
}

/** Configuración del programa: catálogos, documentos, parámetros, vigencias, autorización y plantillas. */
@Injectable({ providedIn: 'root' })
export class ConfigApi {
  private readonly http = inject(HttpClient);

  // ---- catálogos
  resumenCatalogos(): Observable<ResumenCatalogo[]> {
    return this.http
      .get<{ items: ResumenCatalogo[] }>(`${ADMIN}/catalogos`)
      .pipe(map((r) => r.items));
  }

  items(catalogo: Catalogo, f: FiltroItems): Observable<Pagina<ItemCatalogo>> {
    let params = new HttpParams().set('pagina', f.pagina).set('tamano', f.tamano);
    if (f.q) params = params.set('q', f.q);
    if (f.activo !== undefined) params = params.set('activo', f.activo);
    if (f.padreId !== undefined) params = params.set('padreId', f.padreId);
    if (f.orden !== undefined) params = params.set('orden', f.orden);
    return this.http.get<Pagina<ItemCatalogo>>(`${ADMIN}/catalogos/${catalogo}/items`, { params });
  }

  crearItem(catalogo: Catalogo, d: DatosItem): Observable<ItemCatalogo> {
    return this.http.post<ItemCatalogo>(`${ADMIN}/catalogos/${catalogo}/items`, d);
  }

  actualizarItem(id: number, d: DatosItem): Observable<ItemCatalogo> {
    return this.http.put<ItemCatalogo>(`${ADMIN}/catalogos/items/${id}`, d);
  }

  /** Lleva el elemento a esa posición de la lista (los demás se corren). */
  moverItem(id: number, orden: number): Observable<ItemCatalogo> {
    return this.http.post<ItemCatalogo>(`${ADMIN}/catalogos/items/${id}/mover`, { orden });
  }

  cambiarActivoItem(id: number, activo: boolean): Observable<ItemCatalogo> {
    return this.http.post<ItemCatalogo>(
      `${ADMIN}/catalogos/items/${id}/${activo ? 'activar' : 'desactivar'}`,
      {},
    );
  }

  versionesItem(id: number): Observable<VersionRegistro[]> {
    return this.http
      .get<{ items: VersionRegistro[] }>(`${ADMIN}/catalogos/items/${id}/versiones`)
      .pipe(map((r) => r.items));
  }

  // ---- documentos exigidos
  documentos(): Observable<DocumentoRequerido[]> {
    return this.http
      .get<{ items: DocumentoRequerido[] }>(`${ADMIN}/documentos-requeridos`)
      .pipe(map((r) => r.items));
  }

  crearDocumento(d: DatosDocumento): Observable<DocumentoRequerido> {
    return this.http.post<DocumentoRequerido>(`${ADMIN}/documentos-requeridos`, d);
  }

  actualizarDocumento(id: number, d: DatosDocumento): Observable<DocumentoRequerido> {
    return this.http.put<DocumentoRequerido>(`${ADMIN}/documentos-requeridos/${id}`, d);
  }

  /** Publica o reemplaza el modelo descargable de un documento. */
  subirModelo(id: number, archivo: File): Observable<{ documentoId: number; nombre: string }> {
    const datos = new FormData();
    datos.append('archivo', archivo, archivo.name);
    return this.http.put<{ documentoId: number; nombre: string }>(
      `${ADMIN}/documentos-requeridos/${id}/modelo`,
      datos,
    );
  }

  moverDocumento(id: number, orden: number): Observable<DocumentoRequerido> {
    return this.http.post<DocumentoRequerido>(`${ADMIN}/documentos-requeridos/${id}/mover`, {
      orden,
    });
  }

  cambiarActivoDocumento(id: number, activo: boolean): Observable<DocumentoRequerido> {
    return this.http.post<DocumentoRequerido>(
      `${ADMIN}/documentos-requeridos/${id}/${activo ? 'activar' : 'desactivar'}`,
      {},
    );
  }

  versionesDocumento(id: number): Observable<VersionRegistro[]> {
    return this.http
      .get<{ items: VersionRegistro[] }>(`${ADMIN}/documentos-requeridos/${id}/versiones`)
      .pipe(map((r) => r.items));
  }

  // ---- parámetros
  parametros(): Observable<Parametro[]> {
    return this.http.get<{ items: Parametro[] }>(`${ADMIN}/parametros`).pipe(map((r) => r.items));
  }

  historialParametro(clave: string): Observable<VersionParametro[]> {
    return this.http
      .get<{ items: VersionParametro[] }>(`${ADMIN}/parametros/${clave}/historial`)
      .pipe(map((r) => r.items));
  }

  nuevaVersionParametro(
    clave: string,
    d: { valor: string; vigenteDesde: string | null; justificacion: string },
  ): Observable<Parametro> {
    return this.http.post<Parametro>(`${ADMIN}/parametros/${clave}/versiones`, d);
  }

  // ---- vigencias y cupos
  vigencias(): Observable<Vigencia[]> {
    return this.http.get<{ items: Vigencia[] }>(`${ADMIN}/vigencias`).pipe(map((r) => r.items));
  }

  crearVigencia(d: DatosVigencia & { anio: number }): Observable<Vigencia> {
    return this.http.post<Vigencia>(`${ADMIN}/vigencias`, d);
  }

  actualizarVigencia(id: number, d: DatosVigencia): Observable<Vigencia> {
    return this.http.put<Vigencia>(`${ADMIN}/vigencias/${id}`, d);
  }

  activarVigencia(id: number): Observable<Vigencia> {
    return this.http.post<Vigencia>(`${ADMIN}/vigencias/${id}/activar`, {});
  }

  versionesVigencia(id: number): Observable<VersionRegistro[]> {
    return this.http
      .get<{ items: VersionRegistro[] }>(`${ADMIN}/vigencias/${id}/versiones`)
      .pipe(map((r) => r.items));
  }

  // ---- texto de autorización
  autorizacion(): Observable<EstadoAutorizacion> {
    return this.http.get<EstadoAutorizacion>(`${ADMIN}/autorizacion`);
  }

  publicarAutorizacion(contenido: string): Observable<{ version: number }> {
    return this.http.post<{ version: number }>(`${ADMIN}/autorizacion`, { contenido });
  }

  // ---- plantillas de correo
  plantillas(): Observable<PlantillaResumen[]> {
    return this.http
      .get<{ items: PlantillaResumen[] }>(`${ADMIN}/plantillas`)
      .pipe(map((r) => r.items));
  }

  plantilla(codigo: string): Observable<Plantilla> {
    return this.http.get<Plantilla>(`${ADMIN}/plantillas/${codigo}`);
  }

  vistaPrevia(codigo: string, d: { asunto: string; cuerpo: string }): Observable<VistaPrevia> {
    return this.http.post<VistaPrevia>(`${ADMIN}/plantillas/${codigo}/vista-previa`, d);
  }

  guardarPlantilla(
    codigo: string,
    d: { asunto: string; cuerpo: string; justificacion: string | null },
  ): Observable<{ version: number }> {
    return this.http.post<{ version: number }>(`${ADMIN}/plantillas/${codigo}/versiones`, d);
  }
}
