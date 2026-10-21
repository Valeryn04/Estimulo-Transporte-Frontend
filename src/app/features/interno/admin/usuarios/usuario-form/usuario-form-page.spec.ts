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
    /** Al enviar se revisa si el usuario o el correo ya existen: aquí se responde que están libres. */
    const libres = async () => {
      for (const r of ctrl.match((x) => x.url.endsWith('/admin/usuarios/disponibilidad'))) {
        r.flush({
          usuario: { disponible: true },
          correo: { disponible: true },
        });
      }
      await asentar(fixture);
    };
    return { fixture, el, ctrl, escribir, enviar, libres };
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

  it('el correo se escribe dos veces: si son diferentes lo dice y no se envía', async () => {
    const { fixture, el, ctrl, escribir, enviar } = await montar();
    escribir('#usuario', 'maria.lopez');
    escribir('#nombres', 'María López');
    escribir('#correo', 'maria@barranquilla.gov.co');
    escribir('#correoConfirmacion', 'maira@barranquilla.gov.co');
    elegirRol(el, 'Coordinación');
    await asentar(fixture);
    expect(el.querySelector('#correoConfirmacion-error')?.textContent).toContain(
      'los dos correos no coinciden',
    );
    enviar();
    await asentar(fixture);
    ctrl.expectNone((r) => r.method === 'POST');
    // Al corregir la confirmación el error desaparece.
    escribir('#correoConfirmacion', 'maria@barranquilla.gov.co');
    await asentar(fixture);
    expect(el.querySelector('#correoConfirmacion-error')).toBeNull();
  });

  it('al salir del campo avisa si otra cuenta ya usa el correo o el usuario, y dice cuál cuenta', async () => {
    const { fixture, el, ctrl, escribir } = await montar();
    escribir('#correo', 'ana@barranquilla.gov.co');
    el.querySelector<HTMLInputElement>('#correo')!.dispatchEvent(new Event('blur'));
    const correo = ctrl.expectOne(
      (r) => r.url.endsWith('/admin/usuarios/disponibilidad') && r.params.has('correo'),
    );
    expect(correo.request.params.get('correo')).toBe('ana@barranquilla.gov.co');
    correo.flush({
      usuario: null,
      correo: { disponible: false },
    });
    await asentar(fixture);
    expect(el.querySelector('#correo-error')?.textContent).toContain(
      'este correo ya está registrado',
    );
    expect(el.querySelector('#correo')?.getAttribute('aria-invalid')).toBe('true');

    escribir('#usuario', 'ana.perez');
    el.querySelector<HTMLInputElement>('#usuario')!.dispatchEvent(new Event('blur'));
    ctrl
      .expectOne((r) => r.url.endsWith('/admin/usuarios/disponibilidad') && r.params.has('usuario'))
      .flush({ usuario: { disponible: false }, correo: null });
    await asentar(fixture);
    expect(el.querySelector('#usuario-error')?.textContent).toContain(
      'este usuario ya está registrado',
    );

    // Al cambiar el correo, el aviso se quita solo.
    escribir('#correo', 'ana.otra@barranquilla.gov.co');
    await asentar(fixture);
    expect(el.querySelector('#correo-error')).toBeNull();
  });

  it('un correo ya usado impide enviar aunque no se haya salido del campo', async () => {
    const { fixture, el, ctrl, escribir, enviar } = await montar();
    escribir('#usuario', 'maria.lopez');
    escribir('#nombres', 'María López');
    escribir('#correo', 'maria@barranquilla.gov.co');
    escribir('#correoConfirmacion', 'maria@barranquilla.gov.co');
    elegirRol(el, 'Analista');
    await asentar(fixture);
    enviar();
    for (const r of ctrl.match((x) => x.url.endsWith('/admin/usuarios/disponibilidad'))) {
      r.flush({
        usuario: { disponible: true, usadoPor: null },
        correo: { disponible: false, usadoPor: 'maria.gomez', estado: 'ACTIVO' },
      });
    }
    await asentar(fixture);
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('#correo-error')?.textContent).toContain(
      'ya lo usa la cuenta «maria.gomez»',
    );
  });

  it('crea el usuario con el rol elegido y vuelve a la lista', async () => {
    const { fixture, el, ctrl, escribir, enviar, libres } = await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    escribir('#usuario', 'maria.lopez');
    escribir('#nombres', 'María López');
    escribir('#correo', 'maria@barranquilla.gov.co');
    escribir('#correoConfirmacion', 'maria@barranquilla.gov.co');
    elegirRol(el, 'Coordinación');
    await asentar(fixture);
    enviar();
    await libres();
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
    const { fixture, el, ctrl, escribir, enviar, libres } = await montar();
    escribir('#usuario', 'maria.lopez');
    escribir('#nombres', 'María López');
    escribir('#correo', 'maria@barranquilla.gov.co');
    escribir('#correoConfirmacion', 'maria@barranquilla.gov.co');
    elegirRol(el, 'Analista');
    await asentar(fixture);
    enviar();
    await libres();
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
