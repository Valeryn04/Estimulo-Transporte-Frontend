import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE } from '../../../../core/api/api';
import { erroresInterceptor } from '../../../../core/api/errores.interceptor';
import { Sesion } from '../../../../core/auth/sesion';
import { asentar } from '../../../../testing/asentar';
import { LoginPage } from './login-page';

const PERFIL = {
  id: 1,
  usuario: 'ana',
  nombres: 'Ana Pérez',
  correo: 'ana@alcaldia.test',
  roles: [{ id: 1, codigo: 'ADMINISTRADOR', nombre: 'Administrador' }],
  permisos: ['usuarios.administrar'],
  debeCambiarPassword: false,
};

describe('LoginPage', () => {
  function montar() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const escribir = (id: string, valor: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    };
    const enviar = () =>
      el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    return { fixture, el, escribir, enviar, ctrl: TestBed.inject(HttpTestingController) };
  }

  it('no llama a la API si faltan datos y marca los campos con su error', async () => {
    const { fixture, el, enviar, ctrl } = montar();
    enviar();
    await asentar(fixture);
    ctrl.expectNone(`${API_BASE}/auth/login`);
    expect(el.querySelectorAll('[role="alert"]').length).toBe(2);
    expect(el.querySelector('#usuario')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('inicia sesión con usuario y contraseña, guarda el token solo en memoria y entra al portal', async () => {
    const { fixture, escribir, enviar, ctrl } = montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    escribir('usuario', ' ana ');
    escribir('password', 'Clave#Segura2026');
    enviar();
    const req = ctrl.expectOne(`${API_BASE}/auth/login`);
    expect(req.request.body).toEqual({ usuario: 'ana', password: 'Clave#Segura2026' });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ token: 't', perfil: PERFIL, inactividadMinutos: 30 });
    await asentar(fixture);
    expect(TestBed.inject(Sesion).autenticada()).toBe(true);
    expect(navegar).toHaveBeenCalledWith(['/interno']);
    expect(localStorage.length).toBe(0);
  });

  it('con contraseña temporal lleva a cambiarla antes de continuar', async () => {
    const { fixture, escribir, enviar, ctrl } = montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    escribir('usuario', 'ana');
    escribir('password', 'Temporal#2026');
    enviar();
    ctrl.expectOne(`${API_BASE}/auth/login`).flush({
      token: 't',
      perfil: { ...PERFIL, debeCambiarPassword: true },
      inactividadMinutos: 30,
    });
    await asentar(fixture);
    expect(navegar).toHaveBeenCalledWith(['/interno/cambiar-password']);
  });

  it('muestra el mensaje de la API cuando las credenciales son incorrectas y limpia la contraseña', async () => {
    const { fixture, el, escribir, enviar, ctrl } = montar();
    escribir('usuario', 'ana');
    escribir('password', 'mala');
    enviar();
    ctrl.expectOne(`${API_BASE}/auth/login`).flush(
      {
        error: { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Usuario o contraseña incorrectos' },
      },
      { status: 401, statusText: 'No autorizado' },
    );
    await asentar(fixture);
    expect(el.querySelector('.aviso.error')?.textContent).toContain(
      'Usuario o contraseña incorrectos',
    );
    expect(el.querySelector<HTMLInputElement>('#password')!.value).toBe('');
    expect(TestBed.inject(Sesion).autenticada()).toBe(false);
  });
});
