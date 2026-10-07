import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { API_BASE } from '../api/api';
import { erroresInterceptor } from '../api/errores.interceptor';
import { authInterceptor } from './auth.interceptor';
import { esperarTareas } from '../../testing/asentar';
import { PerfilUsuario } from './modelos';
import { Sesion } from './sesion';

const TOKEN = 'token-de-acceso-1';
const TOKEN_NUEVO = 'token-de-acceso-2';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let sesion: Sesion;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, erroresInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(Sesion);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    sesion.iniciar(TOKEN, {
      id: 1,
      usuario: 'ana',
      nombres: 'Ana',
      correo: 'a@a.co',
      roles: [],
      permisos: [],
      debeCambiarPassword: false,
    });
  });

  afterEach(() => ctrl.verify());

  it('envía el token en las rutas internas, de administración y de autenticación', () => {
    for (const ruta of ['/interno/solicitudes', '/admin/usuarios', '/auth/me']) {
      http.get(`${API_BASE}${ruta}`).subscribe();
      expect(ctrl.expectOne(`${API_BASE}${ruta}`).request.headers.get('Authorization')).toBe(
        `Bearer ${TOKEN}`,
      );
    }
  });

  it('no envía el token al portal ciudadano ni a las rutas públicas de acceso', () => {
    for (const ruta of ['/publico/catalogos', '/auth/login', '/auth/refresh', '/auth/logout']) {
      http.post(`${API_BASE}${ruta}`, {}).subscribe();
      expect(ctrl.expectOne(`${API_BASE}${ruta}`).request.headers.has('Authorization')).toBe(false);
    }
  });

  it('no envía el token a otros servidores', () => {
    http.get('https://otro-sitio.test/interno/x').subscribe();
    expect(
      ctrl.expectOne('https://otro-sitio.test/interno/x').request.headers.has('Authorization'),
    ).toBe(false);
  });

  const PERFIL = {
    id: 1,
    usuario: 'ana',
    nombres: 'Ana',
    correo: 'a@a.co',
    roles: [],
    permisos: [],
    debeCambiarPassword: false,
  } satisfies PerfilUsuario;

  const expirada = {
    error: { codigo: 'SESION_EXPIRADA', mensaje: 'La sesión expiró' },
  };

  it('cuando el token de acceso venció lo renueva con la cookie y repite la petición', async () => {
    let resultado: unknown;
    http.get(`${API_BASE}/interno/solicitudes`).subscribe((r) => (resultado = r));
    ctrl
      .expectOne(`${API_BASE}/interno/solicitudes`)
      .flush(expirada, { status: 401, statusText: 'No autorizado' });
    await esperarTareas();

    const refresco = ctrl.expectOne(`${API_BASE}/auth/refresh`);
    expect(refresco.request.withCredentials).toBe(true);
    expect(refresco.request.headers.get('X-Requested-With')).toBe('estimulo-portal');
    expect(refresco.request.headers.has('Authorization')).toBe(false);
    refresco.flush({ token: TOKEN_NUEVO, perfil: PERFIL, inactividadMinutos: 30 });
    await esperarTareas();

    const repetida = ctrl.expectOne(`${API_BASE}/interno/solicitudes`);
    expect(repetida.request.headers.get('Authorization')).toBe(`Bearer ${TOKEN_NUEVO}`);
    repetida.flush({ ok: true });
    await esperarTareas();
    expect(resultado).toEqual({ ok: true });
    expect(sesion.token()).toBe(TOKEN_NUEVO);
    expect(sesion.autenticada()).toBe(true);
  });

  it('varias peticiones vencidas a la vez comparten UNA sola renovación', async () => {
    http.get(`${API_BASE}/interno/solicitudes`).subscribe();
    http.get(`${API_BASE}/interno/alertas`).subscribe();
    ctrl
      .expectOne(`${API_BASE}/interno/solicitudes`)
      .flush(expirada, { status: 401, statusText: 'x' });
    ctrl.expectOne(`${API_BASE}/interno/alertas`).flush(expirada, { status: 401, statusText: 'x' });
    await esperarTareas();

    ctrl
      .expectOne(`${API_BASE}/auth/refresh`)
      .flush({ token: TOKEN_NUEVO, perfil: PERFIL, inactividadMinutos: 30 });
    await esperarTareas();
    ctrl.expectOne(`${API_BASE}/interno/solicitudes`).flush({});
    ctrl.expectOne(`${API_BASE}/interno/alertas`).flush({});
  });

  it('si no se puede renovar (cookie vencida o revocada) cierra la sesión y lleva al ingreso', async () => {
    http.get(`${API_BASE}/interno/solicitudes`).subscribe({ error: () => undefined });
    ctrl
      .expectOne(`${API_BASE}/interno/solicitudes`)
      .flush(expirada, { status: 401, statusText: 'x' });
    await esperarTareas();
    ctrl.expectOne(`${API_BASE}/auth/refresh`).flush(expirada, { status: 401, statusText: 'x' });
    await esperarTareas();

    expect(sesion.autenticada()).toBe(false);
    expect(sesion.motivoCierre()).toContain('expiró por inactividad');
    expect(navegar).toHaveBeenCalledWith(['/interno/login']);
  });

  it('una petición ya reintentada que vuelve a fallar no entra en bucle', async () => {
    http.get(`${API_BASE}/interno/solicitudes`).subscribe({ error: () => undefined });
    ctrl
      .expectOne(`${API_BASE}/interno/solicitudes`)
      .flush(expirada, { status: 401, statusText: 'x' });
    await esperarTareas();
    ctrl
      .expectOne(`${API_BASE}/auth/refresh`)
      .flush({ token: TOKEN_NUEVO, perfil: PERFIL, inactividadMinutos: 30 });
    await esperarTareas();
    ctrl
      .expectOne(`${API_BASE}/interno/solicitudes`)
      .flush(expirada, { status: 401, statusText: 'x' });
    await esperarTareas();
    ctrl.expectNone(`${API_BASE}/auth/refresh`);
    expect(sesion.autenticada()).toBe(false);
  });

  it('una sesión inválida (revocada) cierra la sesión sin intentar renovarla', async () => {
    http.get(`${API_BASE}/interno/solicitudes`).subscribe({ error: () => undefined });
    ctrl
      .expectOne(`${API_BASE}/interno/solicitudes`)
      .flush(
        { error: { codigo: 'SESION_INVALIDA', mensaje: 'x' } },
        { status: 401, statusText: 'x' },
      );
    await esperarTareas();
    ctrl.expectNone(`${API_BASE}/auth/refresh`);
    expect(sesion.autenticada()).toBe(false);
    expect(sesion.motivoCierre()).toContain('ya no es válida');
  });

  it('cada respuesta correcta cuenta como actividad de la persona', () => {
    const actividad = vi.spyOn(sesion, 'marcarActividad');
    http.get(`${API_BASE}/interno/solicitudes`).subscribe();
    ctrl.expectOne(`${API_BASE}/interno/solicitudes`).flush({});
    expect(actividad).toHaveBeenCalled();
  });

  it('cuando la contraseña venció lleva al cambio de contraseña sin cerrar la sesión', async () => {
    http.get(`${API_BASE}/interno/solicitudes`).subscribe({ error: () => undefined });
    ctrl
      .expectOne(`${API_BASE}/interno/solicitudes`)
      .flush(
        { error: { codigo: 'PASSWORD_VENCIDA', mensaje: 'Debe cambiar su contraseña' } },
        { status: 403, statusText: 'Prohibido' },
      );
    await esperarTareas();
    expect(sesion.autenticada()).toBe(true);
    expect(navegar).toHaveBeenCalledWith(['/interno/cambiar-password']);
  });

  it('si la API niega el permiso al cargar una pantalla muestra «Acceso no autorizado»', async () => {
    http.get(`${API_BASE}/admin/usuarios`).subscribe({ error: () => undefined });
    ctrl
      .expectOne(`${API_BASE}/admin/usuarios`)
      .flush(
        { error: { codigo: 'SIN_PERMISO', mensaje: 'No tiene permiso' } },
        { status: 403, statusText: 'Prohibido' },
      );
    await esperarTareas();
    expect(sesion.autenticada()).toBe(true);
    expect(navegar).toHaveBeenCalledWith(['/interno/no-autorizado']);
  });

  it('si una acción dentro de la pantalla es negada, no cambia de pantalla', async () => {
    http.post(`${API_BASE}/admin/usuarios/5/desactivar`, {}).subscribe({ error: () => undefined });
    ctrl
      .expectOne(`${API_BASE}/admin/usuarios/5/desactivar`)
      .flush(
        { error: { codigo: 'SIN_PERMISO', mensaje: 'No tiene permiso' } },
        { status: 403, statusText: 'Prohibido' },
      );
    await esperarTareas();
    expect(navegar).not.toHaveBeenCalled();
  });

  it('un error de permisos no cierra la sesión', async () => {
    http.post(`${API_BASE}/admin/usuarios`, {}).subscribe({ error: () => undefined });
    ctrl
      .expectOne(`${API_BASE}/admin/usuarios`)
      .flush(
        { error: { codigo: 'SIN_PERMISO', mensaje: 'No tiene permiso' } },
        { status: 403, statusText: 'Prohibido' },
      );
    await esperarTareas();
    expect(sesion.autenticada()).toBe(true);
    expect(navegar).not.toHaveBeenCalled();
  });
});
