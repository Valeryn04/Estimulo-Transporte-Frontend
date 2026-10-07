import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PerfilUsuario } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { InternoShell } from './interno-shell';

const perfil = (permisos: string[]): PerfilUsuario => ({
  id: 1,
  usuario: 'ana',
  nombres: 'Ana Pérez',
  correo: 'ana@alcaldia.test',
  roles: [{ id: 1, codigo: 'ADMINISTRADOR', nombre: 'Administrador' }],
  permisos,
  debeCambiarPassword: false,
});

describe('InternoShell', () => {
  function montar(permisos: string[]) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    TestBed.inject(Sesion).iniciar('token', perfil(permisos));
    const fixture = TestBed.createComponent(InternoShell);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('muestra el logo de la Alcaldía con la dependencia y el nombre del sistema', () => {
    const { el } = montar([]);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('identidad/alcaldia-negativo.svg');
    expect(el.querySelector('.dependencia')?.textContent).toContain(
      'Gerencia de Desarrollo Social',
    );
    expect(el.querySelector('.sistema')?.textContent).toContain('Estímulo Social de Transporte');
  });

  it('el menú ofrece Administración con el permiso de usuarios', () => {
    expect(montar(['usuarios.administrar']).el.querySelector('nav')?.textContent).toContain(
      'Usuarios',
    );
  });

  it('el menú no ofrece Administración sin el permiso de usuarios', () => {
    expect(montar([]).el.querySelector('nav')?.textContent).not.toContain('Usuarios');
  });

  it('el menú lateral se puede ocultar con el botón y se recuerda la preferencia', () => {
    const { fixture, el } = montar([]);
    const boton = el.querySelector<HTMLButtonElement>('.hamburguesa')!;
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    boton.click();
    fixture.detectChanges();
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem('estimulo.menu-lateral')).toBe('cerrado');
  });

  it('tiene enlace para saltar al contenido', () => {
    expect(montar([]).el.querySelector('a.saltar')?.getAttribute('href')).toBe('#contenido');
  });
});
