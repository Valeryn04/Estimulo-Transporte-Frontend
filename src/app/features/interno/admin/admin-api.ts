import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../../core/api/api';
import {
  DatosRol,
  DatosUsuarioEdicion,
  DatosUsuarioNuevo,
  DisponibilidadUsuario,
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

  /** ¿El usuario o el correo ya los usa otra cuenta? Se consulta mientras se llena el formulario. */
  disponibilidad(q: {
    usuario?: string;
    correo?: string;
    excluirId?: number;
  }): Observable<DisponibilidadUsuario> {
    let params = new HttpParams();
    if (q.usuario) params = params.set('usuario', q.usuario);
    if (q.correo) params = params.set('correo', q.correo);
    if (q.excluirId) params = params.set('excluirId', q.excluirId);
    return this.http.get<DisponibilidadUsuario>(`${ADMIN}/usuarios/disponibilidad`, { params });
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

  /** El sistema genera una contraseña temporal y se la envía por correo a la persona. */
  restablecerPassword(id: number): Observable<void> {
    return this.http.post<void>(`${ADMIN}/usuarios/${id}/restablecer-password`, {});
  }
}
