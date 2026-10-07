import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api';

export interface EstadoServicio {
  estado: 'ok' | 'degradado';
  baseDeDatos: 'ok' | 'sin_conexion';
}

@Injectable({ providedIn: 'root' })
export class SaludService {
  private readonly http = inject(HttpClient);

  consultar(): Observable<EstadoServicio> {
    return this.http.get<EstadoServicio>(`${API_BASE}/health`);
  }
}
