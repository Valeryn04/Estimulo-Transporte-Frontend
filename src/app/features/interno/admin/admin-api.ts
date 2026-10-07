import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../../core/api/api';
import {
  DatosRol,
  DatosUsuarioEdicion,
  DatosUsuarioNuevo,
  EstadoUsuario,
  Pagina,
  Permiso,
  Rol,
  Usuario,
} from './modelos';

const ADMIN = `${API_BASE}/admin`;

export interface FiltroUsuarios {
  q?: string;
  estado?: EstadoUsuario;
  rolId?: number;
  pagina: number;
  tamano: number;
}

/** Administración de usuarios, roles y permisos (RF-ADM-01). */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  usuarios(f: FiltroUsuarios): Observable<Pagina<Usuario>> {
    let params = new HttpParams().set('pagina', f.pagina).set('tamano', f.tamano);
    if (f.q) params = params.set('q', f.q);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.rolId !== undefined) params = params.set('rolId', f.rolId);
    return this.http.get<Pagina<Usuario>>(`${ADMIN}/usuarios`, { params });
  }

  usuario(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${ADMIN}/usuarios/${id}`);
  }

  roles(): Observable<Rol[]> {
    return this.http.get<{ items: Rol[] }>(`${ADMIN}/roles`).pipe(map((r) => r.items));
  }

  permisos(): Observable<Permiso[]> {
    return this.http.get<{ items: Permiso[] }>(`${ADMIN}/permisos`).pipe(map((r) => r.items));
  }

  crearRol(d: DatosRol): Observable<Rol> {
    return this.http.post<Rol>(`${ADMIN}/roles`, d);
  }

  actualizarRol(id: number, d: DatosRol): Observable<Rol> {
    return this.http.put<Rol>(`${ADMIN}/roles/${id}`, d);
  }

  eliminarRol(id: number): Observable<void> {
    return this.http.delete<void>(`${ADMIN}/roles/${id}`);
  }

  crearUsuario(d: DatosUsuarioNuevo): Observable<Usuario> {
    return this.http.post<Usuario>(`${ADMIN}/usuarios`, d);
  }

  actualizarUsuario(id: number, d: DatosUsuarioEdicion): Observable<Usuario> {
    return this.http.put<Usuario>(`${ADMIN}/usuarios/${id}`, d);
  }

  bloquearUsuario(id: number, motivo: string): Observable<Usuario> {
    return this.http.post<Usuario>(`${ADMIN}/usuarios/${id}/bloquear`, { motivo });
  }

  desbloquearUsuario(id: number): Observable<Usuario> {
    return this.http.post<Usuario>(`${ADMIN}/usuarios/${id}/desbloquear`, {});
  }

  darDeBajaUsuario(id: number, motivo: string): Observable<Usuario> {
    return this.http.post<Usuario>(`${ADMIN}/usuarios/${id}/baja`, { motivo });
  }

  restablecerPassword(id: number, password: string): Observable<void> {
    return this.http.post<void>(`${ADMIN}/usuarios/${id}/restablecer-password`, { password });
  }
}
