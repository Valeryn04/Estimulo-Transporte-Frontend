import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../../core/api/api';
import {
  CalculoCaso,
  CasoPuntaje,
  DecisionPriorizacion,
  DefinicionMatriz,
  EstadoExcepcion,
  Excepcion,
  FiltroListado,
  Listado,
  Matriz,
  ResultadoMasivo,
  ResumenMatriz,
  Simulacion,
} from './modelos-priorizacion';

const MATRIZ = `${API_BASE}/admin/matriz`;
const PRIORIZACION = `${API_BASE}/admin/priorizacion`;

/** Matriz de ponderación (RF-PRI-02), puntaje (RF-PRI-01), excepciones (RF-PRI-03) y listado priorizado (RF-PRI-04). */
@Injectable({ providedIn: 'root' })
export class PriorizacionApi {
  private readonly http = inject(HttpClient);

  // ---- matriz

  versiones(): Observable<ResumenMatriz[]> {
    return this.http.get<{ items: ResumenMatriz[] }>(MATRIZ).pipe(map((r) => r.items));
  }

  version(id: number): Observable<Matriz> {
    return this.http.get<Matriz>(`${MATRIZ}/${id}`);
  }

  crearBorrador(desdeId?: number): Observable<Matriz> {
    return this.http.post<Matriz>(MATRIZ, desdeId ? { desdeId } : {});
  }

  guardarBorrador(id: number, d: DefinicionMatriz): Observable<Matriz> {
    return this.http.put<Matriz>(`${MATRIZ}/${id}`, d);
  }

  simular(id: number): Observable<Simulacion> {
    return this.http.get<Simulacion>(`${MATRIZ}/${id}/simulacion`);
  }

  solicitarAprobacion(id: number): Observable<Matriz> {
    return this.http.post<Matriz>(`${MATRIZ}/${id}/solicitar-aprobacion`, {});
  }

  decidirVersion(id: number, decision: DecisionPriorizacion, motivo: string): Observable<Matriz> {
    return this.http.post<Matriz>(`${MATRIZ}/${id}/decision`, { decision, motivo });
  }

  // ---- puntaje y listado

  filtros(): Observable<{
    localidades: { id: number; nombre: string }[];
    tiposTransporte: { id: number; nombre: string }[];
  }> {
    return this.http.get<{
      localidades: { id: number; nombre: string }[];
      tiposTransporte: { id: number; nombre: string }[];
    }>(`${PRIORIZACION}/filtros`);
  }

  listado(f: FiltroListado): Observable<Listado> {
    let params = new HttpParams().set('pagina', f.pagina).set('tamano', f.tamano);
    if (f.localidadId) params = params.set('localidadId', f.localidadId);
    if (f.transporteId) params = params.set('transporteId', f.transporteId);
    if (f.poblacion) params = params.set('poblacion', f.poblacion);
    if (f.q) params = params.set('q', f.q);
    return this.http.get<Listado>(`${PRIORIZACION}/listado`, { params });
  }

  calcularMasivo(recalcular: boolean): Observable<ResultadoMasivo> {
    return this.http.post<ResultadoMasivo>(`${PRIORIZACION}/calcular`, { recalcular });
  }

  caso(id: number): Observable<CasoPuntaje> {
    return this.http.get<CasoPuntaje>(`${PRIORIZACION}/casos/${id}`);
  }

  calcularCaso(id: number): Observable<CalculoCaso> {
    return this.http.post<CalculoCaso>(`${PRIORIZACION}/casos/${id}/calcular`, {});
  }

  // ---- excepciones

  excepciones(
    estado: EstadoExcepcion | undefined,
    pagina: number,
    tamano: number,
  ): Observable<{ items: Excepcion[]; total: number }> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (estado) params = params.set('estado', estado);
    return this.http.get<{ items: Excepcion[]; total: number }>(`${PRIORIZACION}/excepciones`, {
      params,
    });
  }

  proponerExcepcion(
    solicitudId: number,
    d: { ajuste: number; justificacion: string },
    archivo: File,
  ): Observable<Excepcion> {
    const form = new FormData();
    form.append('ajuste', String(d.ajuste));
    form.append('justificacion', d.justificacion);
    form.append('archivo', archivo, archivo.name);
    return this.http.post<Excepcion>(`${PRIORIZACION}/casos/${solicitudId}/excepciones`, form);
  }

  decidirExcepcion(
    id: number,
    decision: DecisionPriorizacion,
    motivo: string,
  ): Observable<Excepcion> {
    return this.http.post<Excepcion>(`${PRIORIZACION}/excepciones/${id}/decision`, {
      decision,
      motivo,
    });
  }

  evidencia(id: number): Observable<Blob> {
    return this.http.get(`${PRIORIZACION}/excepciones/${id}/evidencia`, { responseType: 'blob' });
  }
}
