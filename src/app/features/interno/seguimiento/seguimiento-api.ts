import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../../core/api/api';
import {
  CoincidenciaExpediente,
  Exportacion,
  Expediente,
  FiltroBitacora,
  FiltroReporte,
  FiltroTablero,
  ListasFiltro,
  PaginaBitacora,
  Reporte,
  Tablero,
  VistaReporte,
} from './modelos-seguimiento';

const ADMIN = `${API_BASE}/admin`;

/** Solo envía los filtros que tienen valor. */
function parametros(filtros: object): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  }
  return p;
}

/** Seguimiento y control del programa (RF-SEG-01 a RF-SEG-07). */
@Injectable({ providedIn: 'root' })
export class SeguimientoApi {
  private readonly http = inject(HttpClient);

  listas(): Observable<ListasFiltro> {
    return this.http.get<ListasFiltro>(`${ADMIN}/seguimiento/filtros`);
  }

  bitacora(f: FiltroBitacora): Observable<PaginaBitacora> {
    return this.http.get<PaginaBitacora>(`${ADMIN}/bitacora`, { params: parametros(f) });
  }

  modulosBitacora(): Observable<string[]> {
    return this.http
      .get<{ items: string[] }>(`${ADMIN}/bitacora/modulos`)
      .pipe(map((r) => r.items));
  }

  accionesBitacora(): Observable<string[]> {
    return this.http
      .get<{ items: string[] }>(`${ADMIN}/bitacora/acciones`)
      .pipe(map((r) => r.items));
  }

  exportarBitacora(
    formato: 'XLSX' | 'PDF',
    f: Omit<FiltroBitacora, 'pagina' | 'tamano'>,
  ): Observable<Blob> {
    return this.http.get(`${ADMIN}/bitacora/exportar`, {
      params: parametros({ ...f, formato }),
      responseType: 'blob',
    });
  }

  corregirCorreo(
    solicitudId: number,
    d: { correo: string; justificacion: string },
    soporte: File,
  ): Observable<{ reenviados: number }> {
    const form = new FormData();
    form.append('datos', JSON.stringify(d));
    form.append('archivo', soporte, soporte.name);
    return this.http.post<{ reenviados: number }>(
      `${ADMIN}/expedientes/${solicitudId}/correo`,
      form,
    );
  }

  reenviarComunicacion(solicitudId: number, correoId: number): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${ADMIN}/expedientes/${solicitudId}/comunicaciones/${correoId}/reenviar`,
      {},
    );
  }

  buscarExpedientes(q: string): Observable<CoincidenciaExpediente[]> {
    return this.http
      .get<{ items: CoincidenciaExpediente[] }>(`${ADMIN}/expedientes`, { params: { q } })
      .pipe(map((r) => r.items));
  }

  expediente(solicitudId: number): Observable<Expediente> {
    return this.http.get<Expediente>(`${ADMIN}/expedientes/${solicitudId}`);
  }

  tablero(f: FiltroTablero): Observable<Tablero> {
    return this.http.get<Tablero>(`${ADMIN}/tablero`, { params: parametros(f) });
  }

  reportes(): Observable<Reporte[]> {
    return this.http.get<{ items: Reporte[] }>(`${ADMIN}/reportes`).pipe(map((r) => r.items));
  }

  vistaPrevia(codigo: string, f: FiltroReporte): Observable<VistaReporte> {
    return this.http.get<VistaReporte>(`${ADMIN}/reportes/${codigo}`, { params: parametros(f) });
  }

  exportar(codigo: string, formato: 'XLSX' | 'PDF', f: FiltroReporte): Observable<Blob> {
    return this.http.get(`${ADMIN}/reportes/${codigo}/exportar`, {
      params: parametros({ ...f, formato }),
      responseType: 'blob',
    });
  }

  exportaciones(): Observable<Exportacion[]> {
    return this.http
      .get<{ items: Exportacion[] }>(`${ADMIN}/reportes/exportaciones`)
      .pipe(map((r) => r.items));
  }

  eventosBiCsv(desde?: string, hasta?: string): Observable<Blob> {
    return this.http.get(`${ADMIN}/bi/eventos`, {
      params: parametros({ desde, hasta, formato: 'csv', limite: 5000 }),
      responseType: 'blob',
    });
  }
}

/** Entrega al navegador un archivo recibido de la API. */
export function descargar(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
