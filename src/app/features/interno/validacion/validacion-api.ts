import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../../core/api/api';
import { VersionRegistro } from '../admin/config/modelos-config';
import {
  Bandeja,
  Caso,
  DatosItem,
  DatosRequisito,
  DecisionValidacion,
  FiltroBandeja,
  ItemCaso,
  Requisito,
  ResultadoDecision,
  Validador,
} from './modelos-validacion';

const ADMIN = `${API_BASE}/admin`;
const VALIDACION = `${ADMIN}/validacion`;

/** Validación de requisitos (RF-VAL-01, RF-VAL-02) y lista de chequeo parametrizable (RN-05). */
@Injectable({ providedIn: 'root' })
export class ValidacionApi {
  private readonly http = inject(HttpClient);

  bandeja(f: FiltroBandeja): Observable<Bandeja> {
    let params = new HttpParams()
      .set('orden', f.orden)
      .set('direccion', f.direccion)
      .set('pagina', f.pagina)
      .set('tamano', f.tamano);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.asignado) params = params.set('asignado', f.asignado);
    if (f.q) params = params.set('q', f.q);
    if (f.vencidas) params = params.set('vencidas', true);
    return this.http.get<Bandeja>(`${VALIDACION}/bandeja`, { params });
  }

  validadores(): Observable<Validador[]> {
    return this.http
      .get<{ items: Validador[] }>(`${VALIDACION}/validadores`)
      .pipe(map((r) => r.items));
  }

  asignar(solicitudIds: number[], validadorId: number | null): Observable<{ asignados: number }> {
    return this.http.post<{ asignados: number }>(`${VALIDACION}/asignar`, {
      solicitudIds,
      validadorId,
    });
  }

  caso(id: number): Observable<Caso> {
    return this.http.get<Caso>(`${VALIDACION}/casos/${id}`);
  }

  /** Abre el caso para revisarlo: queda «en revisión» por quien lo abre. */
  tomar(id: number): Observable<Caso> {
    return this.http.post<Caso>(`${VALIDACION}/casos/${id}/tomar`, {});
  }

  liberar(id: number): Observable<void> {
    return this.http.post<void>(`${VALIDACION}/casos/${id}/liberar`, {});
  }

  registrarItem(id: number, itemId: number, d: DatosItem): Observable<ItemCaso> {
    return this.http.put<ItemCaso>(`${VALIDACION}/casos/${id}/items/${itemId}`, d);
  }

  decidir(
    id: number,
    decision: DecisionValidacion,
    motivacion: string,
  ): Observable<ResultadoDecision> {
    return this.http.post<ResultadoDecision>(`${VALIDACION}/casos/${id}/decision`, {
      decision,
      motivacion,
    });
  }

  /** El archivo de un documento del caso, para abrirlo en el navegador. */
  archivo(id: number, documentoId: number): Observable<Blob> {
    return this.http.get(`${VALIDACION}/casos/${id}/documentos/${documentoId}/archivo`, {
      responseType: 'blob',
    });
  }

  // ---- lista de chequeo (administración)

  requisitos(): Observable<Requisito[]> {
    return this.http.get<{ items: Requisito[] }>(`${ADMIN}/requisitos`).pipe(map((r) => r.items));
  }

  crearRequisito(d: DatosRequisito): Observable<Requisito> {
    return this.http.post<Requisito>(`${ADMIN}/requisitos`, d);
  }

  actualizarRequisito(id: number, d: DatosRequisito): Observable<Requisito> {
    return this.http.put<Requisito>(`${ADMIN}/requisitos/${id}`, d);
  }

  cambiarActivoRequisito(id: number, activo: boolean): Observable<Requisito> {
    return this.http.post<Requisito>(
      `${ADMIN}/requisitos/${id}/${activo ? 'activar' : 'desactivar'}`,
      {},
    );
  }

  versionesRequisito(id: number): Observable<VersionRegistro[]> {
    return this.http
      .get<{ items: VersionRegistro[] }>(`${ADMIN}/requisitos/${id}/versiones`)
      .pipe(map((r) => r.items));
  }
}
