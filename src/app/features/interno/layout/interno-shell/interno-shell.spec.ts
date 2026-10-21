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

  it('el menú agrupa las pantallas relacionadas en una sola entrada por sección', () => {
    const { el } = montar([
      'novedades.ver',
      'encuestas.resultados',
      'priorizacion.ver',
      'matriz.administrar',
      'usuarios.administrar',
      'catalogos.administrar',
      'requisitos.administrar',
    ]);
    const entradas = [...el.querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    expect(entradas).toEqual([
      'Inicio',
      'Priorización',
      'Novedades y revocatoria',
      'Formulario y requisitos',
      'Usuarios y roles',
    ]);
    // Nada de pantallas sueltas que ya están como pestañas dentro de la sección.
    expect(entradas).not.toContain('Revocatorias');
    expect(entradas).not.toContain('Roles y permisos');
  });

  it('cada entrada lleva a la primera pantalla de la sección que el rol puede ver', () => {
    const { el } = montar(['matriz.administrar']);
    const enlace = [...el.querySelectorAll('nav a')].find((a) =>
      a.textContent?.includes('Priorización'),
    );
    expect(enlace?.getAttribute('href')).toBe('/interno/admin/matriz');
  });

  it('el tablero ya no está en el menú: es el inicio', () => {
    const { el } = montar(['tablero.ver']);
    expect(el.querySelector('nav')?.textContent).not.toContain('Tablero');
  });

  it('la campana de alertas está junto al nombre de la persona', () => {
    const { el } = montar([]);
    const acciones = el.querySelector('.acciones-barra')!;
    expect(acciones.querySelector('app-campana')).not.toBeNull();
    expect(acciones.querySelector('app-menu-usuario')).not.toBeNull();
  });

  it('los filtros se aplican solos al elegir una opción, salvo los que piden confirmar', () => {
    const { fixture } = montar([]);
    const doc = fixture.nativeElement as HTMLElement;
    doc.insertAdjacentHTML(
      'beforeend',
      '<form class="filtros" id="f1"><select><option>a</option><option>b</option></select></form>' +
        '<form class="filtros" data-manual id="f2"><select><option>a</option></select></form>',
    );
    const enviados: string[] = [];
    doc.querySelectorAll('form').forEach((f) =>
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        enviados.push(f.id);
      }),
    );
    doc.querySelector('#f1 select')!.dispatchEvent(new Event('change', { bubbles: true }));
    doc.querySelector('#f2 select')!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(enviados).toEqual(['f1']);
  });

  it('tiene enlace para saltar al contenido', () => {
    expect(montar([]).el.querySelector('a.saltar')?.getAttribute('href')).toBe('#contenido');
  });
});
