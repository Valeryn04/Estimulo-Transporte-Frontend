import { Routes } from '@angular/router';
import { noIncrustableGuard } from './core/no-incrustable';

// Cada pantalla se carga bajo demanda (lazy loading) para mantener liviano el bundle inicial.
export const routes: Routes = [
  {
    // Aviso que ve quien abre el portal dentro de otra página (iframe).
    path: 'no-incrustable',
    title: 'Abra el portal en su propia pestaña · Estímulo Social de Transporte',
    loadComponent: () =>
      import('./pages/no-incrustable/no-incrustable-page').then((m) => m.NoIncrustablePage),
  },
  {
    // Portal interno de funcionarios (RF-ADM-01). Va primero para que el comodín del portal ciudadano
    // no lo capture.
    path: 'interno',
    // Ningún portal se abre dentro de otra página.
    canActivate: [noIncrustableGuard],
    loadChildren: () => import('./features/interno/interno.routes').then((m) => m.internoRoutes),
  },
  {
    // Portal ciudadano (RNF-01): la página de la Alcaldía enlaza a estas URL con un botón o enlace (se abre aparte).
    path: '',
    canActivate: [noIncrustableGuard],
    loadComponent: () =>
      import('./features/ciudadano/layout/ciudadano-shell').then((m) => m.CiudadanoShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Estímulo Social de Transporte · Barranquilla',
        loadComponent: () =>
          import('./features/ciudadano/inicio/inicio-page').then((m) => m.InicioPage),
      },
      {
        path: 'preinscripcion',
        title: 'Preinscripción · Estímulo Social de Transporte',
        loadComponent: () =>
          import('./features/ciudadano/preinscripcion/preinscripcion-page').then(
            (m) => m.PreinscripcionPage,
          ),
      },
      {
        path: 'preinscripcion/enviada',
        title: 'Preinscripción recibida · Estímulo Social de Transporte',
        loadComponent: () =>
          import('./features/ciudadano/preinscripcion/enviada/enviada-page').then(
            (m) => m.EnviadaPage,
          ),
      },
      {
        path: 'verificar-correo',
        title: 'Verificación del correo · Estímulo Social de Transporte',
        loadComponent: () =>
          import('./features/ciudadano/verificar-correo/verificar-correo-page').then(
            (m) => m.VerificarCorreoPage,
          ),
      },
      {
        path: 'reenviar-verificacion',
        title: 'Reenviar enlace de verificación · Estímulo Social de Transporte',
        loadComponent: () =>
          import('./features/ciudadano/reenviar-verificacion/reenviar-verificacion-page').then(
            (m) => m.ReenviarVerificacionPage,
          ),
      },
      {
        path: 'consulta',
        title: 'Consultar el estado · Estímulo Social de Transporte',
        loadComponent: () =>
          import('./features/ciudadano/consulta/consulta-page').then((m) => m.ConsultaPage),
      },
      {
        path: 'caracterizacion',
        title: 'Caracterización · Estímulo Social de Transporte',
        loadComponent: () =>
          import('./features/ciudadano/caracterizacion/caracterizacion-page').then(
            (m) => m.CaracterizacionPage,
          ),
      },
      {
        path: 'ayuda',
        title: 'Guía paso a paso · Estímulo Social de Transporte',
        loadComponent: () =>
          import('./features/ciudadano/ayuda/ayuda-page').then((m) => m.AyudaPage),
      },
      {
        path: 'estado-del-servicio',
        title: 'Estado del servicio · Estímulo Social de Transporte',
        loadComponent: () => import('./features/estado/estado-page').then((m) => m.EstadoPage),
      },
      {
        path: '**',
        title: 'Página no encontrada · Estímulo Social de Transporte',
        loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
