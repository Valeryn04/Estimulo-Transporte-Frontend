import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { firstValueFrom, isObservable, Observable } from 'rxjs';
import { API_BASE } from '../api/api';
import { permisoGuard, sesionGuard } from './guards';
import { PerfilUsuario } from './modelos';
import { Sesion } from './sesion';

function token(): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=/g, '');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
}

const perfil = (cambios: Partial<PerfilUsuario> = {}): PerfilUsuario => ({
  id: 1,
  usuario: 'ana',
  nombres: 'Ana',
  correo: 'a@a.co',
  roles: [],
  permisos: ['usuarios.administrar'],
  debeCambiarPassword: false,
  ...cambios,
});

async function ejecutar(guard: CanActivateFn, url = '/interno'): Promise<boolean | UrlTree> {
  const r = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
  return isObservable(r)
    ? firstValueFrom(r as Observable<boolean | UrlTree>)
    : (r as boolean | UrlTree);
}

describe('guards del portal interno', () => {
  let sesion: Sesion;
  let router: Router;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    sesion = TestBed.inject(Sesion);
    router = TestBed.inject(Router);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  const destino = (r: boolean | UrlTree) => (r instanceof UrlTree ? router.serializeUrl(r) : r);

  const respuestaRefresh = (p = perfil()) => ({
    token: token(),
    perfil: p,
    inactividadMinutos: 30,
  });

  it('sin sesión ni cookie válida lleva al ingreso', async () => {
    const promesa = ejecutar(sesionGuard);
    ctrl
      .expectOne(`${API_BASE}/auth/refresh`)
      .flush(
        { error: { codigo: 'SESION_INVALIDA', mensaje: 'x' } },
        { status: 401, statusText: 'x' },
      );
    expect(destino(await promesa)).toBe('/interno/login');
    expect(sesion.autenticada()).toBe(false);
  });

  it('al recargar la página recupera la sesión con la cookie HttpOnly, sin token guardado', async () => {
    expect(sessionStorage.length + localStorage.length).toBe(0);
    const promesa = ejecutar(sesionGuard);
    const r = ctrl.expectOne(`${API_BASE}/auth/refresh`);
    expect(r.request.withCredentials).toBe(true);
    r.flush(respuestaRefresh(perfil({ nombres: 'Ana Recuperada' })));
    expect(await promesa).toBe(true);
    expect(sesion.autenticada()).toBe(true);
    expect(sesion.perfil()?.nombres).toBe('Ana Recuperada');
    expect(sessionStorage.length + localStorage.length).toBe(0);
  });

  it('al restaurar la sesión con contraseña temporal lleva al cambio de contraseña', async () => {
    const promesa = ejecutar(sesionGuard, '/interno/solicitudes');
    ctrl
      .expectOne(`${API_BASE}/auth/refresh`)
      .flush(respuestaRefresh(perfil({ debeCambiarPassword: true })));
    expect(destino(await promesa)).toBe('/interno/cambiar-password');
  });

  it('con sesión y perfil cargado deja pasar', async () => {
    sesion.iniciar(token(), perfil());
    expect(await ejecutar(sesionGuard)).toBe(true);
  });

  it('con token en memoria pero sin perfil lo recupera de la API', async () => {
    sesion.iniciar(token(), perfil());
    sesion.perfil.set(null);
    const promesa = ejecutar(sesionGuard);
    ctrl.expectOne(`${API_BASE}/auth/me`).flush(perfil({ nombres: 'Ana Recuperada' }));
    expect(await promesa).toBe(true);
    expect(sesion.perfil()?.nombres).toBe('Ana Recuperada');
  });

  it('si el token en memoria ya no sirve cierra la sesión y lleva al ingreso', async () => {
    sesion.iniciar(token(), perfil());
    sesion.perfil.set(null);
    const promesa = ejecutar(sesionGuard);
    ctrl
      .expectOne(`${API_BASE}/auth/me`)
      .flush(
        { error: { codigo: 'SESION_INVALIDA', mensaje: 'x' } },
        { status: 401, statusText: 'x' },
      );
    expect(destino(await promesa)).toBe('/interno/login');
    expect(sesion.autenticada()).toBe(false);
  });

  it('con contraseña temporal solo permite la pantalla de cambio de contraseña', async () => {
    sesion.iniciar(token(), perfil({ debeCambiarPassword: true }));
    expect(destino(await ejecutar(sesionGuard, '/interno/admin/usuarios'))).toBe(
      '/interno/cambiar-password',
    );
    expect(await ejecutar(sesionGuard, '/interno/cambiar-password')).toBe(true);
  });

  it('el guard de permisos deja pasar con al menos uno y bloquea sin ninguno', async () => {
    sesion.iniciar(token(), perfil({ permisos: ['usuarios.administrar'] }));
    expect(await ejecutar(permisoGuard('usuarios.administrar'))).toBe(true);
    expect(await ejecutar(permisoGuard('roles.administrar', 'usuarios.administrar'))).toBe(true);
    expect(destino(await ejecutar(permisoGuard('roles.administrar')))).toBe(
      '/interno/no-autorizado',
    );
  });
});
