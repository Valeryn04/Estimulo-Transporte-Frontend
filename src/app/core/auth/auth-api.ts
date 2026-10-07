import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE, CABECERAS_PORTAL } from '../api/api';
import { PerfilUsuario, RespuestaLogin } from './modelos';

const BASE = `${API_BASE}/auth`;

const CON_COOKIE = { withCredentials: true } as const;

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(usuario: string, password: string): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(`${BASE}/login`, { usuario, password }, CON_COOKIE);
  }

  refrescar(): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(
      `${BASE}/refresh`,
      {},
      { ...CON_COOKIE, headers: CABECERAS_PORTAL },
    );
  }

  cerrarSesion(): Observable<void> {
    return this.http.post<void>(`${BASE}/logout`, {}, { ...CON_COOKIE, headers: CABECERAS_PORTAL });
  }

  yo(): Observable<PerfilUsuario> {
    return this.http.get<PerfilUsuario>(`${BASE}/me`);
  }

  cambiarPassword(passwordActual: string, passwordNueva: string): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(
      `${BASE}/cambiar-password`,
      { passwordActual, passwordNueva },
      CON_COOKIE,
    );
  }
}
