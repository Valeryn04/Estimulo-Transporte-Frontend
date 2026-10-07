import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PerfilUsuario } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { MenuUsuario } from './menu-usuario';

const perfil: PerfilUsuario = {
  id: 1,
  usuario: 'elena',
  nombres: 'Elena Cantillo',
  correo: 'elena@alcaldia.test',
  roles: [{ id: 1, codigo: 'ROL', nombre: 'Funcionario enlace' }],
  permisos: [],
  debeCambiarPassword: false,
};

describe('MenuUsuario', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function abrir(p: PerfilUsuario | null = perfil) {
    const sesion = TestBed.inject(Sesion);
    if (p) sesion.iniciar('token', p);
    const fixture = TestBed.createComponent(MenuUsuario);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, disparador: () => el.querySelector<HTMLButtonElement>('.disparador')! };
  }

  it('muestra las iniciales, el nombre y el rol de la persona', () => {
    const { el } = abrir();
    expect(el.querySelector('.avatar')?.textContent).toContain('EC');
    expect(el.querySelector('.nombre')?.textContent).toContain('elena');
    expect(el.querySelector('.rol')?.textContent).toContain('Funcionario enlace');
  });

  it('no muestra nada sin sesión', () => {
    expect(abrir(null).el.querySelector('.disparador')).toBeNull();
  });

  it('el panel está cerrado al inicio y el botón lo anuncia con aria-expanded', () => {
    const { el, disparador } = abrir();
    expect(el.querySelector('.panel')).toBeNull();
    expect(disparador().getAttribute('aria-expanded')).toBe('false');
  });

  it('al pulsar el botón despliega los datos, cambiar contraseña y cerrar sesión', () => {
    const { fixture, el, disparador } = abrir();
    disparador().click();
    fixture.detectChanges();
    expect(disparador().getAttribute('aria-expanded')).toBe('true');
    const panel = el.querySelector('.panel')!;
    expect(panel.textContent).toContain('Elena Cantillo');
    expect(panel.textContent).toContain('Usuario: elena');
    expect(panel.textContent).toContain('elena@alcaldia.test');
    expect(panel.textContent).toContain('Cambiar contraseña');
    expect(panel.textContent).toContain('Cerrar sesión');
    expect(panel.querySelector('a')!.getAttribute('href')).toBe('/interno/cambiar-password');
  });

  it('Escape lo cierra y devuelve el foco al botón', () => {
    const { fixture, el, disparador } = abrir();
    document.body.appendChild(el);
    disparador().click();
    fixture.detectChanges();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.panel')).toBeNull();
    expect(document.activeElement).toBe(disparador());
    el.remove();
  });

  it('un clic fuera del menú lo cierra, pero uno dentro no', () => {
    const { fixture, el, disparador } = abrir();
    document.body.appendChild(el);
    disparador().click();
    fixture.detectChanges();
    el.querySelector('.panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.panel')).not.toBeNull();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.panel')).toBeNull();
    el.remove();
  });

  it('«Cerrar sesión» cierra el panel y avisa al marco', () => {
    const { fixture, el, disparador } = abrir();
    let avisos = 0;
    fixture.componentInstance.cerrarSesion.subscribe(() => avisos++);
    disparador().click();
    fixture.detectChanges();
    (el.querySelector('.opcion.salir') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(avisos).toBe(1);
    expect(el.querySelector('.panel')).toBeNull();
  });
});
