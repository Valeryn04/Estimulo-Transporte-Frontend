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
