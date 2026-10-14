import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE } from '../../../../../core/api/api';
import { erroresInterceptor } from '../../../../../core/api/errores.interceptor';
import { asentar } from '../../../../../testing/asentar';
import { UsuarioFormPage } from './usuario-form-page';

const ROLES = [
  {
    id: 1,
    codigo: 'ANALISTA',
    nombre: 'Analista',
    descripcion: 'Consulta',
    sistema: true,
    usuarios: 0,
    permisos: [],
  },
  {
    id: 2,
    codigo: 'ADMINISTRADOR',
    nombre: 'Administrador',
    descripcion: 'Admin',
    sistema: true,
    usuarios: 1,
    permisos: ['usuarios.administrar'],
  },
  {
    id: 3,
    codigo: 'COORDINACION',
    nombre: 'Coordinación',
    descripcion: 'Rol propio',
    sistema: false,
    usuarios: 0,
    permisos: ['catalogos.administrar'],
  },
];

describe('UsuarioFormPage', () => {
  async function montar(id?: string, usuario?: object) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(UsuarioFormPage);
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    const ctrl = TestBed.inject(HttpTestingController);
    ctrl.expectOne(`${API_BASE}/admin/roles`).flush({ items: ROLES });
    await asentar(fixture);
    if (usuario) {
      ctrl.expectOne(`${API_BASE}/admin/usuarios/${id}`).flush(usuario);
      await asentar(fixture);
    }
    const el = fixture.nativeElement as HTMLElement;
    const escribir = (sel: string, valor: string) => {
      const input = el.querySelector<HTMLInputElement>(sel)!;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    };
    const enviar = () =>
      el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    return { fixture, el, ctrl, escribir, enviar };
  }

  it('al crear, exige los datos y el rol antes de llamar a la API', async () => {
    const { fixture, el, ctrl, enviar } = await montar();
    enviar();
    await asentar(fixture);
    ctrl.expectNone(`${API_BASE}/admin/usuarios`);
    expect(el.querySelector('#usuario')?.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('.aviso.error')?.textContent).toContain('Revise los campos');
  });

  const elegirRol = (el: HTMLElement, nombre: string) => {
    const lista = el.querySelector<HTMLSelectElement>('#rolId')!;
    lista.value = [...lista.options].find((o) => o.textContent!.includes(nombre))!.value;
    lista.dispatchEvent(new Event('change'));
  };

  it('el rol se elige de una lista (uno solo) y no pide fechas de vigencia', async () => {
    const { el } = await montar();
    const lista = el.querySelector<HTMLSelectElement>('#rolId')!;
    expect([...lista.options].map((o) => o.textContent!.trim())).toEqual([
      'Seleccione un rol',
      'Analista',
      'Administrador',
      'Coordinación',
    ]);
    expect(lista.multiple).toBe(false);
    expect(el.querySelector('input[type="checkbox"]')).toBeNull();
    expect(el.querySelector('input[type="date"]')).toBeNull();
    expect(el.textContent).not.toMatch(/vigencia|vigente/i);
  });

  it('al elegir un rol muestra qué es', async () => {
    const { fixture, el } = await montar();
    elegirRol(el, 'Coordinación');
    await asentar(fixture);
    expect(el.querySelector('.detalle-rol')?.textContent).toContain('Rol propio');
  });

  it('al crear no pide contraseña: la genera el sistema y la envía por correo', async () => {
    const { el } = await montar();
    expect(el.querySelector('#password')).toBeNull();
    expect(el.textContent).toContain('genera el sistema');
  });

  it('crea el usuario con el rol elegido y vuelve a la lista', async () => {
    const { fixture, el, ctrl, escribir, enviar } = await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    escribir('#usuario', 'maria.lopez');
    escribir('#nombres', 'María López');
    escribir('#correo', 'maria@barranquilla.gov.co');
    elegirRol(el, 'Coordinación');
    await asentar(fixture);
    enviar();
    const req = ctrl.expectOne(`${API_BASE}/admin/usuarios`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      usuario: 'maria.lopez',
      nombres: 'María López',
      correo: 'maria@barranquilla.gov.co',
      rolId: 3,
    });
    req.flush({ id: 9 }, { status: 201, statusText: 'Creado' });
    await asentar(fixture);
    expect(navegar).toHaveBeenCalledWith(['/interno/admin/usuarios']);
  });

  it('muestra en el campo el error de unicidad que devuelve la API', async () => {
    const { fixture, el, ctrl, escribir, enviar } = await montar();
    escribir('#usuario', 'maria.lopez');
    escribir('#nombres', 'María López');
    escribir('#correo', 'maria@barranquilla.gov.co');
    elegirRol(el, 'Analista');
    await asentar(fixture);
    enviar();
    ctrl.expectOne(`${API_BASE}/admin/usuarios`).flush(
      {
        error: {
          codigo: 'VALIDACION',
          mensaje: 'Revise los datos',
          errores: [{ campo: 'correo', mensaje: 'Correo: ya está asociado a otra cuenta' }],
        },
      },
      { status: 422, statusText: 'Inválido' },
    );
    await asentar(fixture);
    expect(el.querySelector('#correo-error')?.textContent).toContain('ya está asociado');
  });

  it('al editar precarga los datos, bloquea el usuario y mantiene fijo el rol del administrador principal', async () => {
    const { el } = await montar('5', {
      id: 5,
      usuario: 'admin',
      nombres: 'Administrador',
      correo: 'admin@alcaldia.test',
      estado: 'ACTIVO',
      bloqueoTemporalHasta: null,
      debeCambiarPassword: false,
      protegido: true,
      ultimoLoginAt: null,
      creadoAt: '2026-10-01T10:00:00Z',
      rol: { id: 2, codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
    });
    expect(el.querySelector<HTMLInputElement>('#usuario')!.disabled).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#nombres')!.value).toBe('Administrador');
    expect(el.querySelector('#password')).toBeNull();
    const lista = el.querySelector<HTMLSelectElement>('#rolId')!;
    expect(lista.selectedOptions[0]?.textContent).toContain('Administrador');
    expect(lista.disabled).toBe(true);
    expect(el.textContent).toContain('administrador principal');
  });
});
