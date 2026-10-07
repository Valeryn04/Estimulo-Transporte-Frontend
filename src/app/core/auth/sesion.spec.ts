import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PerfilUsuario } from './modelos';
import { Sesion } from './sesion';

const perfil: PerfilUsuario = {
  id: 1,
  usuario: 'ana',
  nombres: 'Ana Ruiz',
  correo: 'ana@alcaldia.test',
  roles: [{ id: 1, codigo: 'ROL', nombre: 'Verificador' }],
  permisos: ['solicitudes.consultar', 'solicitudes.orientar'],
  debeCambiarPassword: false,
};

describe('Sesion', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => vi.useRealTimers());

  it('el token vive solo en memoria: no se escribe en sessionStorage, localStorage ni cookies', () => {
    const sesion = TestBed.inject(Sesion);
    expect(sesion.autenticada()).toBe(false);
    sesion.iniciar('token-de-acceso-secreto', perfil);
    expect(sesion.autenticada()).toBe(true);

    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    expect(document.cookie).not.toContain('token-de-acceso-secreto');
    for (const almacen of [sessionStorage, localStorage]) {
      for (let i = 0; i < almacen.length; i++) {
        expect(almacen.getItem(almacen.key(i)!)).not.toContain('token-de-acceso-secreto');
      }
    }
  });

  it('una instancia nueva (como tras recargar la página) empieza sin sesión', () => {
    TestBed.inject(Sesion).iniciar('token', perfil);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    expect(TestBed.inject(Sesion).autenticada()).toBe(false);
  });

  it('olvida el token y el perfil al cerrar la sesión', () => {
    const sesion = TestBed.inject(Sesion);
    sesion.iniciar('token', perfil);
    sesion.cerrar('Cerró su sesión');
    expect(sesion.autenticada()).toBe(false);
    expect(sesion.token()).toBeNull();
    expect(sesion.perfil()).toBeNull();
    expect(sesion.motivoCierre()).toBe('Cerró su sesión');
  });

  it('consulta permisos del perfil', () => {
    const sesion = TestBed.inject(Sesion);
    sesion.iniciar('token', perfil);
    expect(sesion.tiene('solicitudes.orientar')).toBe(true);
    expect(sesion.tiene('usuarios.administrar')).toBe(false);
    expect(sesion.tieneAlguno('usuarios.administrar', 'solicitudes.consultar')).toBe(true);
    expect(sesion.tieneAlguno('usuarios.administrar', 'roles.administrar')).toBe(false);
  });

  it('renovar reemplaza el token de acceso solo si hay sesión', () => {
    const sesion = TestBed.inject(Sesion);
    sesion.renovar('nuevo');
    expect(sesion.autenticada()).toBe(false);
    sesion.iniciar('viejo', perfil);
    sesion.renovar('nuevo');
    expect(sesion.token()).toBe('nuevo');
  });

  it('cierra la sesión sola al pasar el tiempo de inactividad y lleva al ingreso', () => {
    vi.useFakeTimers();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const sesion = TestBed.inject(Sesion);
    sesion.iniciar('token', perfil, 30);

    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(sesion.autenticada()).toBe(true);
    vi.advanceTimersByTime(2 * 60 * 1000);

    expect(sesion.autenticada()).toBe(false);
    expect(sesion.motivoCierre()).toContain('expiró por inactividad');
    expect(navegar).toHaveBeenCalledWith(['/interno/login']);
  });

  it('la actividad contra la API reinicia la cuenta regresiva de inactividad', () => {
    vi.useFakeTimers();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const sesion = TestBed.inject(Sesion);
    sesion.iniciar('token', perfil, 1);
    vi.advanceTimersByTime(50 * 1000);
    sesion.marcarActividad(); // una respuesta correcta de la API
    vi.advanceTimersByTime(50 * 1000);
    expect(sesion.autenticada()).toBe(true);
    vi.advanceTimersByTime(20 * 1000);
    expect(sesion.autenticada()).toBe(false);
  });
});
