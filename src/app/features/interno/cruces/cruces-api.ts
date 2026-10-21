import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../../core/api/api';
import { VersionRegistro } from '../admin/config/modelos-config';
import { CargaCruce, DatosEstructuraCruce, EstructuraCruce } from './modelos-cruces';

const CRUCES = `${API_BASE}/admin/cruces`;

/** Archivos de cruce (RF-ADM-05). */
@Injectable({ providedIn: 'root' })
export class CrucesApi {
  private readonly http = inject(HttpClient);

  listar(): Observable<EstructuraCruce[]> {
    return this.http.get<{ items: EstructuraCruce[] }>(CRUCES).pipe(map((r) => r.items));
  }

  /** Causales de revocatoria que una estructura puede sugerir. */
  causales(): Observable<{ codigo: string; nombre: string }[]> {
    return this.http
      .get<{ items: { codigo: string; nombre: string }[] }>(`${CRUCES}/causales`)
      .pipe(map((r) => r.items));
  }

  crear(d: DatosEstructuraCruce): Observable<EstructuraCruce> {
    return this.http.post<EstructuraCruce>(CRUCES, d);
  }

  actualizar(id: number, d: DatosEstructuraCruce): Observable<EstructuraCruce> {
    return this.http.put<EstructuraCruce>(`${CRUCES}/${id}`, d);
  }

  cambiarActivo(id: number, activo: boolean): Observable<EstructuraCruce> {
    return this.http.post<EstructuraCruce>(
      `${CRUCES}/${id}/${activo ? 'activar' : 'desactivar'}`,
      {},
    );
  }

  versiones(id: number): Observable<VersionRegistro[]> {
    return this.http
      .get<{ items: VersionRegistro[] }>(`${CRUCES}/${id}/versiones`)
      .pipe(map((r) => r.items));
  }

  cargas(id: number): Observable<CargaCruce[]> {
    return this.http
      .get<{ items: CargaCruce[] }>(`${CRUCES}/${id}/cargas`)
      .pipe(map((r) => r.items));
  }

  cargar(id: number, archivo: File): Observable<CargaCruce> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    return this.http.post<CargaCruce>(`${CRUCES}/${id}/cargas`, form);
  }

  /** Reporte de errores de una carga (CSV). */
  errores(cargaId: number): Observable<Blob> {
    return this.http.get(`${CRUCES}/cargas/${cargaId}/errores`, { responseType: 'blob' });
  }
}
