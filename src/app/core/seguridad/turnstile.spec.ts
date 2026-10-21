import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { API_BASE } from '../api/api';
import { Turnstile, turnstileInterceptor } from './turnstile';

describe('Turnstile', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let servicio: Turnstile;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([turnstileInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(Turnstile);
  });
  afterEach(() => {
    ctrl.verify();
    delete window.turnstile;
  });

  it('agrega el token a las acciones protegidas y lo renueva al terminar', () => {
    const reset = vi.fn();
    window.turnstile = { render: vi.fn(), reset, remove: vi.fn() };
    (servicio as unknown as { widgetId: string }).widgetId = 'w1';
    servicio.token = 'tok-123';
    http.post(`${API_BASE}/publico/preinscripciones`, {}).subscribe();
    const r = ctrl.expectOne(`${API_BASE}/publico/preinscripciones`);
    expect(r.request.headers.get('X-Turnstile-Token')).toBe('tok-123');
    r.flush({});
    expect(servicio.token).toBeNull();
    expect(reset).toHaveBeenCalledWith('w1');
  });

  it('no toca el resto de las peticiones', () => {
    servicio.token = 'tok-123';
    http.post(`${API_BASE}/publico/consulta/verificar-codigo`, {}).subscribe();
    const r = ctrl.expectOne(`${API_BASE}/publico/consulta/verificar-codigo`);
    expect(r.request.headers.has('X-Turnstile-Token')).toBe(false);
    r.flush({});
    expect(servicio.token).toBe('tok-123');
  });

  it('protege el inicio de sesión y el código de consulta', () => {
    for (const ruta of ['/auth/login', '/publico/consulta/solicitar-codigo']) {
      servicio.token = 'tok';
      http.post(`${API_BASE}${ruta}`, {}).subscribe();
      const r = ctrl.expectOne(`${API_BASE}${ruta}`);
      expect(r.request.headers.get('X-Turnstile-Token')).toBe('tok');
      r.flush({});
    }
  });

  it('sin llave del sitio la verificación queda desactivada', async () => {
    const promesa = servicio.cargarConfig();
    ctrl.expectOne(`${API_BASE}/publico/config`).flush({ turnstileSiteKey: null });
    expect(await promesa).toBeNull();
    expect(servicio.siteKey()).toBeNull();
  });

  it('si la configuración no responde también queda desactivada', async () => {
    const promesa = servicio.cargarConfig();
    ctrl.expectOne(`${API_BASE}/publico/config`).flush('x', { status: 500, statusText: 'Error' });
    expect(await promesa).toBeNull();
  });

  it('con llave del sitio dibuja el widget y guarda el token que entrega', async () => {
    let devolver: (t: string) => void = () => undefined;
    window.turnstile = {
      render: vi.fn((_el, o) => {
        devolver = o.callback;
        return 'w1';
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    const promesa = servicio.mostrar(document.createElement('div'));
    ctrl.expectOne(`${API_BASE}/publico/config`).flush({ turnstileSiteKey: 'sitio' });
    await promesa;
    expect(window.turnstile.render).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: 'sitio', language: 'es' }),
    );
    devolver('abc');
    expect(servicio.token).toBe('abc');
    servicio.quitar();
    expect(window.turnstile.remove).toHaveBeenCalledWith('w1');
  });
});
