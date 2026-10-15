export interface Pagina<T> {
  total: number;
  pagina: number;
  tamano: number;
  items: T[];
}

export type EstadoUsuario = 'ACTIVO' | 'BLOQUEADO' | 'BAJA';

/** El rol del usuario: cada usuario tiene uno solo. */
export interface RolAsignado {
  id: number;
  codigo: string;
  nombre: string;
}

export interface Usuario {
  id: number;
  usuario: string;
  nombres: string;
  correo: string;
  estado: EstadoUsuario;
  bloqueoTemporalHasta: string | null;
  debeCambiarPassword: boolean;
  /** Administrador principal: no se puede bloquear ni dar de baja, ni quitarle el rol de administrador. */
  protegido: boolean;
  ultimoLoginAt: string | null;
  creadoAt: string;
  rol: RolAsignado | null;
}

export interface Rol {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  /** Rol del documento (numeral 3.2): no se elimina ni se renombra. */
  sistema: boolean;
  /** Usuarios que tienen este rol. */
  usuarios: number;
  permisos: string[];
}

export interface Permiso {
  codigo: string;
  modulo: string;
  descripcion: string;
  /** Solo lo tiene el administrador: no se asigna a otros roles. */
  soloAdministrador?: boolean;
}

export interface DatosRol {
  nombre: string;
  descripcion: string;
  permisos: string[];
}

export interface DatosUsuarioNuevo {
  usuario: string;
  nombres: string;
  correo: string;
  rolId: number;
}

export interface DatosUsuarioEdicion {
  nombres: string;
  correo: string;
  rolId: number;
}

export interface DisponibilidadUsuario {
  usuario: { disponible: boolean; usadoPor: string | null } | null;
  correo: { disponible: boolean; usadoPor: string | null; estado: string | null } | null;
}
