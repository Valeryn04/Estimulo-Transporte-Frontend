import { Routes } from '@angular/router';
import { PERMISO } from '../../core/auth/modelos';
import { permisoGuard, sesionGuard } from '../../core/auth/guards';

const TITULO = 'Portal interno · Estímulo Social de Transporte';

/** Portal interno de funcionarios. Cada pantalla se carga bajo demanda y se protege con sesión y permiso. */
export const internoRoutes: Routes = [
  {
    // Área de trabajo: requiere sesión.
    path: '',
    canActivate: [sesionGuard],
    loadComponent: () => import('./layout/interno-shell/interno-shell').then((m) => m.InternoShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: `Inicio · ${TITULO}`,
        loadComponent: () =>
          import('./inicio/inicio-interno-page').then((m) => m.InicioInternoPage),
      },
      {
        path: 'no-autorizado',
        title: `Acceso no autorizado · ${TITULO}`,
        loadComponent: () =>
          import('./no-autorizado/no-autorizado-page').then((m) => m.NoAutorizadoPage),
      },
      {
        path: 'validacion',
        title: `Bandeja de validación · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.validacionVer)],
        loadComponent: () => import('./validacion/bandeja/bandeja-page').then((m) => m.BandejaPage),
      },
      {
        path: 'validacion/caso/:id',
        title: `Caso en revisión · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.validacionVer)],
        loadComponent: () => import('./validacion/caso/caso-page').then((m) => m.CasoPage),
      },
      {
        path: 'priorizacion',
        title: `Listado priorizado · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.priorizacionVer)],
        loadComponent: () =>
          import('./priorizacion/listado/listado-page').then((m) => m.ListadoPriorizadoPage),
      },
      {
        path: 'priorizacion/excepciones',
        title: `Excepciones de priorización · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.priorizacionVer)],
        loadComponent: () =>
          import('./priorizacion/excepciones/excepciones-page').then((m) => m.ExcepcionesPage),
      },
      {
        path: 'asignacion',
        title: `Asignación · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.asignacionVer)],
        loadComponent: () =>
          import('./asignacion/asignacion/asignacion-page').then((m) => m.AsignacionPage),
      },
      {
        path: 'novedades',
        title: `Novedades · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.novedadesVer)],
        loadComponent: () =>
          import('./novedades/resumen/novedades-page').then((m) => m.NovedadesPage),
      },
      {
        path: 'novedades/revocatorias',
        title: `Revocatorias · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.novedadesVer)],
        loadComponent: () =>
          import('./novedades/revocatorias/revocatorias-page').then((m) => m.RevocatoriasPage),
      },
      {
        path: 'novedades/revocatorias/:id',
        title: `Revocatoria · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.novedadesVer)],
        loadComponent: () =>
          import('./novedades/revocatorias/revocatorias-page').then((m) => m.RevocatoriasPage),
      },
      {
        path: 'novedades/alertas',
        title: `Alertas de cruce · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.novedadesVer)],
        loadComponent: () =>
          import('./novedades/alertas/alertas-cruce-page').then((m) => m.AlertasCrucePage),
      },
      {
        path: 'encuestas',
        title: `Encuestas de satisfacción · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.encuestasAdministrar, PERMISO.encuestasResultados)],
        loadComponent: () => import('./encuestas/encuestas-page').then((m) => m.EncuestasPage),
      },
      {
        path: 'bitacora',
        title: `Bitácora de auditoría · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.bitacoraVer)],
        loadComponent: () =>
          import('./seguimiento/bitacora/bitacora-page').then((m) => m.BitacoraPage),
      },
      {
        path: 'expedientes',
        title: `Expediente integral · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.expedienteVer)],
        loadComponent: () =>
          import('./seguimiento/expediente/expediente-page').then((m) => m.ExpedientePage),
      },
      {
        path: 'expedientes/:solicitudId',
        title: `Expediente integral · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.expedienteVer)],
        loadComponent: () =>
          import('./seguimiento/expediente/expediente-page').then((m) => m.ExpedientePage),
      },
      { path: 'tablero', redirectTo: '', pathMatch: 'full' },
      {
        path: 'reportes',
        title: `Reportes · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.reportesVer, PERMISO.biConsultar)],
        loadComponent: () =>
          import('./seguimiento/reportes/reportes-page').then((m) => m.ReportesPage),
      },
      {
        path: 'admin/cupos',
        title: `Cupos y presupuesto · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.cupos, PERMISO.asignacionVer)],
        loadComponent: () => import('./asignacion/cupos/cupos-page').then((m) => m.CuposPage),
      },
      {
        path: 'admin/matriz',
        title: `Matriz de ponderación · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.matriz, PERMISO.priorizacionAprobar)],
        loadComponent: () => import('./priorizacion/matriz/matriz-page').then((m) => m.MatrizPage),
      },
      {
        path: 'admin/requisitos',
        title: `Lista de chequeo · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.requisitos)],
        loadComponent: () =>
          import('./validacion/requisitos/requisitos-page').then((m) => m.RequisitosPage),
      },
      {
        path: 'admin/cruces',
        title: `Archivos de cruce · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.cruces)],
        loadComponent: () => import('./cruces/cruces-page').then((m) => m.CrucesPage),
      },
      {
        path: 'admin/usuarios',
        title: `Usuarios · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.usuarios)],
        loadComponent: () => import('./admin/usuarios/usuarios-page').then((m) => m.UsuariosPage),
      },
      {
        path: 'admin/roles',
        title: `Roles y permisos · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.usuarios)],
        loadComponent: () => import('./admin/roles/roles-page').then((m) => m.RolesPage),
      },
      {
        path: 'admin/usuarios/nuevo',
        title: `Nuevo usuario · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.usuarios)],
        loadComponent: () =>
          import('./admin/usuarios/usuario-form/usuario-form-page').then((m) => m.UsuarioFormPage),
      },
      {
        path: 'admin/usuarios/:id/editar',
        title: `Modificar usuario · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.usuarios)],
        loadComponent: () =>
          import('./admin/usuarios/usuario-form/usuario-form-page').then((m) => m.UsuarioFormPage),
      },
      {
        path: 'admin/catalogos',
        title: `Listas del formulario · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.catalogos)],
        loadComponent: () =>
          import('./admin/catalogos/catalogos-page').then((m) => m.CatalogosPage),
      },
      {
        path: 'admin/documentos',
        title: `Documentos exigidos · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.catalogos)],
        loadComponent: () =>
          import('./admin/documentos/documentos-page').then((m) => m.DocumentosPage),
      },
      {
        path: 'admin/parametros',
        title: `Parámetros y plazos · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.parametros)],
        loadComponent: () =>
          import('./admin/parametros/parametros-page').then((m) => m.ParametrosPage),
      },
      {
        path: 'admin/vigencias',
        title: `Vigencias y cupos · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.parametros)],
        loadComponent: () =>
          import('./admin/vigencias/vigencias-page').then((m) => m.VigenciasPage),
      },
      {
        path: 'admin/plantillas',
        title: `Plantillas de correo · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.plantillas)],
        loadComponent: () =>
          import('./admin/plantillas/plantillas-page').then((m) => m.PlantillasPage),
      },
      {
        path: 'admin/plantillas/:codigo',
        title: `Editar plantilla de correo · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.plantillas)],
        loadComponent: () =>
          import('./admin/plantillas/plantilla-editor/plantilla-editor-page').then(
            (m) => m.PlantillaEditorPage,
          ),
      },
      {
        path: 'admin/autorizacion',
        title: `Autorización de datos personales · ${TITULO}`,
        canActivate: [permisoGuard(PERMISO.parametros)],
        loadComponent: () =>
          import('./admin/autorizacion/autorizacion-page').then((m) => m.AutorizacionPage),
      },
    ],
  },
  {
    // Pantallas de acceso: ingreso y cambio de contraseña. Va DESPUÉS del área de trabajo: ambas usan
    // ruta vacía y el área de trabajo, que exige sesión, debe evaluarse primero.
    path: '',
    loadComponent: () => import('./layout/acceso-shell/acceso-shell').then((m) => m.AccesoShell),
    children: [
      {
        path: 'login',
        title: `Ingreso · ${TITULO}`,
        loadComponent: () => import('./acceso/login/login-page').then((m) => m.LoginPage),
      },
      {
        path: 'cambiar-password',
        title: `Cambiar contraseña · ${TITULO}`,
        canActivate: [sesionGuard],
        loadComponent: () =>
          import('./acceso/cambiar-password/cambiar-password-page').then(
            (m) => m.CambiarPasswordPage,
          ),
      },
      // Cualquier otra dirección vuelve al inicio (que pide ingresar si no hay sesión).
      { path: '**', redirectTo: '/interno' },
    ],
  },
];
