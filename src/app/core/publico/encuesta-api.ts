import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api';

export type TipoPregunta = 'SELECCION' | 'ESCALA' | 'TEXTO';

export interface PreguntaPublica {
  id: number;
  tipo: TipoPregunta;
  texto: string;
  obligatoria: boolean;
  opciones: string[] | null;
  escalaMax: number | null;
}

export interface EncuestaPublica {
  titulo: string;
  descripcion: string;
  vigenteHasta: string;
  preguntas: PreguntaPublica[];
}

/** Encuesta de satisfacción (RF-NOV-04): se responde con el enlace personal que llega por correo. */
@Injectable({ providedIn: 'root' })
export class EncuestaApi {
  private readonly http = inject(HttpClient);

  obtener(token: string): Observable<EncuestaPublica> {
    return this.http.get<EncuestaPublica>(`${API_BASE}/publico/encuesta`, {
      params: new HttpParams().set('token', token),
    });
  }

  responder(
    token: string,
    respuestas: Record<string, string | number>,
  ): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${API_BASE}/publico/encuesta/responder`, {
      token,
      respuestas,
    });
  }
}
