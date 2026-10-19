export interface PerfilUsuario {
  id: number;
  usuario: string;
  nombres: string;
  correo: string;
  roles: { id: number; codigo: string; nombre: string }[];
  permisos: string[];
  debeCambiarPassword: boolean;
}

export interface RespuestaLogin {
  token: string;
  perfil: PerfilUsuario;
  inactividadMinutos: number;
}

/** Permisos que concede la API a los roles (la API los vuelve a validar en cada llamada). */
export const PERMISO = {
  usuarios: 'usuarios.administrar',
  catalogos: 'catalogos.administrar',
  parametros: 'parametros.administrar',
  plantillas: 'plantillas.administrar',
  requisitos: 'requisitos.administrar',
  cruces: 'cruces.administrar',
  validacionVer: 'validacion.ver',
  validar: 'validacion.validar',
  asignarCasos: 'validacion.asignar',
  datosSensibles: 'datos.sensibles.ver',
} as const;
