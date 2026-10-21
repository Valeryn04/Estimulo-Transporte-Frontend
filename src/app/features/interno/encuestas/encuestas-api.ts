import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../../core/api/api';
import {
  DatosEncuesta,
  Encuesta,
  EncuestaConPreguntas,
  ResultadosEncuesta,
} from './modelos-encuestas';

const ENCUESTAS = `${API_BASE}/admin/encuestas`;

/** Encuestas de satisfacción (RF-NOV-04). */
@Injectable({ providedIn: 'root' })
export class EncuestasApi {
  private readonly http = inject(HttpClient);

  listar(): Observable<Encuesta[]> {
    return this.http.get<{ items: Encuesta[] }>(ENCUESTAS).pipe(map((r) => r.items));
  }

  obtener(id: number): Observable<EncuestaConPreguntas> {
    return this.http.get<EncuestaConPreguntas>(`${ENCUESTAS}/${id}`);
  }

  crear(d: DatosEncuesta): Observable<EncuestaConPreguntas> {
    return this.http.post<EncuestaConPreguntas>(ENCUESTAS, d);
  }

  actualizar(id: number, d: DatosEncuesta): Observable<EncuestaConPreguntas> {
    return this.http.put<EncuestaConPreguntas>(`${ENCUESTAS}/${id}`, d);
  }

  publicar(id: number): Observable<Encuesta & { invitadosAhora: number }> {
    return this.http.post<Encuesta & { invitadosAhora: number }>(`${ENCUESTAS}/${id}/publicar`, {});
  }

  cerrar(id: number): Observable<Encuesta> {
    return this.http.post<Encuesta>(`${ENCUESTAS}/${id}/cerrar`, {});
  }

  resultados(id: number): Observable<ResultadosEncuesta> {
    return this.http.get<ResultadosEncuesta>(`${ENCUESTAS}/${id}/resultados`);
  }
}
