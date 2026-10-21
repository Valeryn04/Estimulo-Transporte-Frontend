import { PERMISO } from '../../core/auth/modelos';

export interface Pestana {
  texto: string;
  ruta: string;
  /** Con cualquiera de estos permisos se ve la pestaña. */
  permisos: readonly string[];
}

export interface Seccion {
  /** Nombre de la entrada del menú lateral. */
  titulo: string;
  /** Grupo del menú en el que aparece. */
  grupo: 'Proceso' | 'Control' | 'Configuración' | 'Seguridad';
  pestanas: readonly Pestana[];
}

/**
 * Pantallas relacionadas agrupadas en una sola entrada del menú: la entrada lleva a la primera pestaña que el rol
 * puede ver y desde allí se pasa de una a otra sin volver al menú.
 */
export const SECCIONES: Record<string, Seccion> = {
  priorizacion: {
    titulo: 'Priorización',
    grupo: 'Proceso',
    pestanas: [
      {
        texto: 'Listado priorizado',
        ruta: '/interno/priorizacion',
        permisos: [PERMISO.priorizacionVer],
      },
      {
        texto: 'Excepciones',
        ruta: '/interno/priorizacion/excepciones',
        permisos: [PERMISO.priorizacionVer],
      },
      {
        texto: 'Matriz de ponderación',
        ruta: '/interno/admin/matriz',
        permisos: [PERMISO.matriz, PERMISO.priorizacionAprobar],
      },
    ],
  },
  asignacion: {
    titulo: 'Asignación',
    grupo: 'Proceso',
    pestanas: [
      {
        texto: 'Asignación del beneficio',
        ruta: '/interno/asignacion',
        permisos: [PERMISO.asignacionVer],
      },
      {
        texto: 'Cupos y presupuesto',
        ruta: '/interno/admin/cupos',
        permisos: [PERMISO.cupos, PERMISO.asignacionVer],
      },
    ],
  },
  novedades: {
    titulo: 'Novedades y revocatoria',
    grupo: 'Proceso',
    pestanas: [
      { texto: 'Beneficios', ruta: '/interno/novedades', permisos: [PERMISO.novedadesVer] },
      {
        texto: 'Revocatorias',
        ruta: '/interno/novedades/revocatorias',
        permisos: [PERMISO.novedadesVer],
      },
      {
        texto: 'Alertas de cruce',
        ruta: '/interno/novedades/alertas',
        permisos: [PERMISO.novedadesVer],
      },
      {
        texto: 'Encuestas',
        ruta: '/interno/encuestas',
        permisos: [PERMISO.encuestasAdministrar, PERMISO.encuestasResultados],
      },
    ],
  },
  seguimiento: {
    titulo: 'Seguimiento y reportes',
    grupo: 'Control',
    pestanas: [
      {
        texto: 'Expediente integral',
        ruta: '/interno/expedientes',
        permisos: [PERMISO.expedienteVer],
      },
      {
        texto: 'Reportes',
        ruta: '/interno/reportes',
        permisos: [PERMISO.reportesVer, PERMISO.biConsultar],
      },
      {
        texto: 'Bitácora de auditoría',
        ruta: '/interno/bitacora',
        permisos: [PERMISO.bitacoraVer],
      },
    ],
  },
  programa: {
    titulo: 'Programa y plazos',
    grupo: 'Configuración',
    pestanas: [
      {
        texto: 'Parámetros y plazos',
        ruta: '/interno/admin/parametros',
        permisos: [PERMISO.parametros],
      },
      { texto: 'Vigencias', ruta: '/interno/admin/vigencias', permisos: [PERMISO.parametros] },
      { texto: 'Archivos de cruce', ruta: '/interno/admin/cruces', permisos: [PERMISO.cruces] },
    ],
  },
  formulario: {
    titulo: 'Formulario y requisitos',
    grupo: 'Configuración',
    pestanas: [
      {
        texto: 'Listas del formulario',
        ruta: '/interno/admin/catalogos',
        permisos: [PERMISO.catalogos],
      },
      {
        texto: 'Documentos exigidos',
        ruta: '/interno/admin/documentos',
        permisos: [PERMISO.catalogos],
      },
      {
        texto: 'Lista de chequeo',
        ruta: '/interno/admin/requisitos',
        permisos: [PERMISO.requisitos],
      },
    ],
  },
  comunicaciones: {
    titulo: 'Comunicaciones',
    grupo: 'Configuración',
    pestanas: [
      {
        texto: 'Plantillas de correo',
        ruta: '/interno/admin/plantillas',
        permisos: [PERMISO.plantillas],
      },
      {
        texto: 'Autorización de datos',
        ruta: '/interno/admin/autorizacion',
        permisos: [PERMISO.parametros],
      },
    ],
  },
  accesos: {
    titulo: 'Usuarios y roles',
    grupo: 'Seguridad',
    pestanas: [
      { texto: 'Usuarios', ruta: '/interno/admin/usuarios', permisos: [PERMISO.usuarios] },
      { texto: 'Roles y permisos', ruta: '/interno/admin/roles', permisos: [PERMISO.usuarios] },
    ],
  },
};
