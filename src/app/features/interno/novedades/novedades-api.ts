import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../../../core/api/api';
import { EstadoBeneficio } from '../asignacion/modelos-asignacion';
import {
  AlertaCruce,
  DatosNovedad,
  EstadoAlertaCruce,
  EstadoRevocatoria,
  ExpedienteNovedades,
  ResumenBeneficio,
  Revocatoria,
  RevocatoriaResumen,
} from './modelos-novedades';

const NOVEDADES = `${API_BASE}/admin/novedades`;

/** Novedades (RF-NOV-01), revocatoria con debido proceso (RF-NOV-02) y alertas de cruce (RF-NOV-03). */
@Injectable({ providedIn: 'root' })
export class NovedadesApi {
  private readonly http = inject(HttpClient);

  private multipart<T>(url: string, datos: object, archivo: File | null): Observable<T> {
    const form = new FormData();
    form.append('datos', JSON.stringify(datos));
    if (archivo) form.append('archivo', archivo, archivo.name);
    return this.http.post<T>(url, form);
  }

  resumen(
    estado: EstadoBeneficio | undefined,
    q: string | undefined,
    pagina: number,
    tamano: number,
  ): Observable<{ items: ResumenBeneficio[]; total: number }> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (estado) params = params.set('estado', estado);
    if (q) params = params.set('q', q);
    return this.http.get<{ items: ResumenBeneficio[]; total: number }>(`${NOVEDADES}/resumen`, {
      params,
    });
  }

  expediente(beneficioId: number): Observable<ExpedienteNovedades> {
    return this.http.get<ExpedienteNovedades>(`${NOVEDADES}/beneficios/${beneficioId}`);
  }

  registrarNovedad(
    beneficioId: number,
    d: DatosNovedad,
    evidencia: File,
  ): Observable<ExpedienteNovedades> {
    return this.multipart(`${NOVEDADES}/beneficios/${beneficioId}/novedades`, d, evidencia);
  }

  evidenciaNovedad(id: number): Observable<Blob> {
    return this.http.get(`${NOVEDADES}/novedades/${id}/evidencia`, { responseType: 'blob' });
  }

  // ---- revocatorias

  iniciarRevocatoria(
    beneficioId: number,
    d: { causalId: number; descripcion: string },
    evidencia: File,
  ): Observable<Revocatoria> {
    return this.multipart(`${NOVEDADES}/beneficios/${beneficioId}/revocatorias`, d, evidencia);
  }

  revocatorias(
    estado: EstadoRevocatoria | undefined,
    pagina: number,
    tamano: number,
  ): Observable<{ items: RevocatoriaResumen[]; total: number }> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (estado) params = params.set('estado', estado);
    return this.http.get<{ items: RevocatoriaResumen[]; total: number }>(
      `${NOVEDADES}/revocatorias`,
      { params },
    );
  }

  revocatoria(id: number): Observable<Revocatoria> {
    return this.http.get<Revocatoria>(`${NOVEDADES}/revocatorias/${id}`);
  }

  traslado(id: number, texto: string, archivo: File | null): Observable<Revocatoria> {
    return this.multipart(`${NOVEDADES}/revocatorias/${id}/traslado`, { texto }, archivo);
  }

  descargos(
    id: number,
    d: { texto: string; sinDescargos: boolean },
    archivo: File | null,
  ): Observable<Revocatoria> {
    return this.multipart(`${NOVEDADES}/revocatorias/${id}/descargos`, d, archivo);
  }

  decidir(
    id: number,
    d: { resultado: 'REVOCAR' | 'ARCHIVAR'; motivacion: string; numeroActo: string },
    acto: File,
  ): Observable<Revocatoria> {
    return this.multipart(`${NOVEDADES}/revocatorias/${id}/decision`, d, acto);
  }

  archivoEvento(id: number): Observable<Blob> {
    return this.http.get(`${NOVEDADES}/revocatorias/eventos/${id}/evidencia`, {
      responseType: 'blob',
    });
  }

  // ---- alertas de cruce

  alertasCruce(
    estado: EstadoAlertaCruce | undefined,
    pagina: number,
    tamano: number,
  ): Observable<{ items: AlertaCruce[]; total: number }> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (estado) params = params.set('estado', estado);
    return this.http.get<{ items: AlertaCruce[]; total: number }>(`${NOVEDADES}/alertas-cruce`, {
      params,
    });
  }

  analizarAlerta(
    id: number,
    d: { accion: 'DESCARTAR' | 'INICIAR_REVOCATORIA'; observacion: string },
    evidencia: File | null,
  ): Observable<AlertaCruce> {
    return this.multipart(`${NOVEDADES}/alertas-cruce/${id}/analizar`, d, evidencia);
  }
}
