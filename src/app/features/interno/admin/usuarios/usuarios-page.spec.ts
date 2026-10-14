import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE } from '../../../../core/api/api';
import { erroresInterceptor } from '../../../../core/api/errores.interceptor';
import { asentar } from '../../../../testing/asentar';
import '../../../../testing/locale';
import { Usuario } from '../modelos';
import { UsuariosPage } from './usuarios-page';

const usuario = (c: Partial<Usuario>): Usuario => ({
  id: 1,
  usuario: 'maria',
  nombres: 'María Pérez',
  correo: 'maria@alcaldia.test',
  estado: 'ACTIVO',
  bloqueoTemporalHasta: null,
  debeCambiarPassword: false,
  protegido: false,
  ultimoLoginAt: null,
  creadoAt: '2026-10-01T10:00:00Z',
  rol: { id: 1, codigo: 'ANALISTA', nombre: 'Analista' },
  ...c,
});

const ROLES = [
  {
    id: 1,
    codigo: 'ANALISTA',
    nombre: 'Analista',
    descripcion: 'Consulta',
    sistema: true,
    usuarios: 1,
    permisos: [],
  },
];

describe('UsuariosPage', () => {
  async function montar(items: Usuario[]) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(UsuariosPage);
    fixture.detectChanges();
    const ctrl = TestBed.inject(HttpTestingController);
    ctrl.expectOne(`${API_BASE}/admin/roles`).flush({ items: ROLES });
    const lista = ctrl.expectOne((r) => r.url === `${API_BASE}/admin/usuarios`);
    expect(lista.request.params.get('pagina')).toBe('1');
    lista.flush({ items, total: items.length, pagina: 1, tamano: 15 });
    await asentar(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement, ctrl };
  }

  it('lista los usuarios con su rol y su estado', async () => {
    const { el } = await montar([
      usuario({}),
      usuario({ id: 2, usuario: 'luis', estado: 'BLOQUEADO' }),
    ]);
    const filas = el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('Analista');
    expect(filas[0]?.textContent).toContain('Activo');
    expect(filas[1]?.textContent).toContain('Bloqueado');
  });

  it('un usuario sin rol lo indica y no muestra vigencias', async () => {
    const { el } = await montar([usuario({ rol: null })]);
    const texto = el.querySelector('tbody')?.textContent ?? '';
    expect(texto).toContain('Sin rol');
    expect(texto).not.toMatch(/vigencia|hasta/i);
  });

  it('el administrador principal no ofrece bloquear ni dar de baja', async () => {
    const { el } = await montar([usuario({ protegido: true })]);
    const texto = el.querySelector('tbody')?.textContent ?? '';
    expect(texto).toContain('Principal');
    expect(texto).toContain('no se puede bloquear ni dar de baja');
    expect(texto).not.toContain('Dar de baja a maria');
  });

  it('un usuario dado de baja no tiene acciones', async () => {
    const { el } = await montar([usuario({ estado: 'BAJA' })]);
    expect(el.querySelector('tbody')?.textContent).toContain('la baja es definitiva');
    expect(el.querySelector('tbody .accion-icono')).toBeNull();
  });

  it('bloquear exige un motivo y lo envía a la API', async () => {
    const { fixture, el, ctrl } = await montar([usuario({})]);
    el.querySelector<HTMLButtonElement>('button[title="Bloquear a maria"]')!.click();
    await asentar(fixture);
    const form = el.querySelector<HTMLFormElement>('dialog form')!;
    form.dispatchEvent(new Event('submit'));
    await asentar(fixture);
    ctrl.expectNone(`${API_BASE}/admin/usuarios/1/bloquear`);
    expect(el.querySelector('dialog [role="alert"]')?.textContent).toContain('Motivo');

    const motivo = el.querySelector<HTMLTextAreaElement>('#motivo')!;
    motivo.value = 'Licencia prolongada';
    motivo.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    const req = ctrl.expectOne(`${API_BASE}/admin/usuarios/1/bloquear`);
    expect(req.request.body).toEqual({ motivo: 'Licencia prolongada' });
    req.flush(usuario({ estado: 'BLOQUEADO' }));
    await asentar(fixture);
    ctrl
      .expectOne((r) => r.url === `${API_BASE}/admin/usuarios`)
      .flush({ items: [usuario({ estado: 'BLOQUEADO' })], total: 1, pagina: 1, tamano: 15 });
    await asentar(fixture);
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('bloqueado');
  });

  it('desbloquear llama a la API sin pedir motivo', async () => {
    const { fixture, el, ctrl } = await montar([usuario({ estado: 'BLOQUEADO' })]);
    el.querySelector<HTMLButtonElement>('button[title="Desbloquear a maria"]')!.click();
    ctrl.expectOne(`${API_BASE}/admin/usuarios/1/desbloquear`).flush(usuario({}));
    await asentar(fixture);
    ctrl
      .expectOne((r) => r.url === `${API_BASE}/admin/usuarios`)
      .flush({ items: [usuario({})], total: 1, pagina: 1, tamano: 15 });
    await asentar(fixture);
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('desbloqueado');
  });

  it('restablecer la contraseña no pide escribir nada: el sistema la genera y la envía por correo', async () => {
    const { fixture, el, ctrl } = await montar([usuario({})]);
    el.querySelector<HTMLButtonElement>(
      'button[title="Restablecer la contraseña de maria"]',
    )!.click();
    await asentar(fixture);
    const dialogo = el.querySelector('dialog[open]')!;
    expect(dialogo.querySelector('input')).toBeNull();
    expect(dialogo.textContent).toContain('Usted no la verá');
    dialogo.querySelector<HTMLButtonElement>('button.boton:not(.secundario)')!.click();
    const req = ctrl.expectOne(`${API_BASE}/admin/usuarios/1/restablecer-password`);
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 204, statusText: 'Sin contenido' });
    await asentar(fixture);
    ctrl
      .expectOne((r) => r.url === `${API_BASE}/admin/usuarios`)
      .flush({ items: [usuario({})], total: 1, pagina: 1, tamano: 15 });
    await asentar(fixture);
    expect(el.querySelector('.aviso.exito')?.textContent).toContain(
      'Enviamos una contraseña temporal',
    );
  });

  it('muestra el error de la API (por ejemplo, regla del administrador principal)', async () => {
    const { fixture, el, ctrl } = await montar([usuario({ estado: 'BLOQUEADO' })]);
    el.querySelector<HTMLButtonElement>('button[title="Desbloquear a maria"]')!.click();
    ctrl
      .expectOne(`${API_BASE}/admin/usuarios/1/desbloquear`)
      .flush(
        { error: { codigo: 'NO_BLOQUEADO', mensaje: 'El usuario no está bloqueado' } },
        { status: 409, statusText: 'Conflicto' },
      );
    await asentar(fixture);
    expect(el.querySelector('.aviso.error')?.textContent).toContain('no está bloqueado');
  });
});
