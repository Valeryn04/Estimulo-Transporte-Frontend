import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { Permiso, Rol } from '../modelos';
import { RolesPage } from './roles-page';

const PERMISOS: Permiso[] = [
  {
    codigo: 'catalogos.administrar',
    modulo: 'Administración',
    descripcion: 'Administrar los catálogos',
  },
  {
    codigo: 'usuarios.administrar',
    modulo: 'Administración',
    descripcion: 'Administrar usuarios y roles',
  },
  {
    codigo: 'parametros.administrar',
    modulo: 'Administración',
    descripcion: 'Administrar los parámetros',
    soloAdministrador: true,
  },
];

const rol = (c: Partial<Rol>): Rol => ({
  id: 1,
  codigo: 'ANALISTA',
  nombre: 'Analista',
  descripcion: 'Consulta expedientes',
  sistema: true,
  usuarios: 2,
  permisos: [],
  ...c,
});

const LISTA = [
  rol({
    id: 2,
    codigo: 'ADMINISTRADOR',
    nombre: 'Administrador',
    permisos: ['catalogos.administrar', 'usuarios.administrar'],
    usuarios: 1,
  }),
  rol({}),
  rol({
    id: 9,
    codigo: 'COORDINACION',
    nombre: 'Coordinación',
    descripcion: 'Rol propio',
    sistema: false,
    usuarios: 0,
    permisos: ['catalogos.administrar'],
  }),
];

describe('RolesPage', () => {
  async function montar(lista: Rol[] = LISTA) {
    const p = montarPantalla(RolesPage);
    p.ctrl.expectOne(`${API_BASE}/admin/roles`).flush({ items: lista });
    p.ctrl.expectOne(`${API_BASE}/admin/permisos`).flush({ items: PERMISOS });
    await p.asentar();
    const q = <T extends Element>(s: string) => p.el.querySelector<T>(s);
    const diálogoAbierto = () => p.el.querySelector('dialog[open]');
    const recargar = async (nueva: Rol[]) => {
      p.ctrl.expectOne(`${API_BASE}/admin/roles`).flush({ items: nueva });
      p.ctrl.expectOne(`${API_BASE}/admin/permisos`).flush({ items: PERMISOS });
      await p.asentar();
    };
    return { ...p, q, diálogoAbierto, recargar };
  }

  it('lista los roles con su tipo, sus permisos y cuántos usuarios los tienen', async () => {
    const p = await montar();
    const filas = p.el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(3);
    expect(filas[0]?.textContent).toContain('Administrador');
    expect(filas[0]?.textContent).toContain('Del sistema');
    expect(filas[0]?.textContent).toContain('2 permiso(s)');
    expect(filas[0]?.textContent).toContain('Administración');
    expect(filas[1]?.textContent).toContain('Sin permisos todavía');
    expect(filas[2]?.textContent).toContain('Propio');
    expect(filas[2]?.querySelector('td.num')?.textContent).toContain('0');
  });

  it('explica que cada usuario tiene un solo rol', async () => {
    const p = await montar();
    expect(p.el.textContent).toContain('un solo rol');
  });

  it('solo los roles propios se pueden eliminar', async () => {
    const p = await montar();
    expect(p.q('button[title="Eliminar Coordinación"]')).not.toBeNull();
    expect(p.q('button[title="Eliminar Analista"]')).toBeNull();
    expect(p.q('button[title="Eliminar Administrador"]')).toBeNull();
  });

  describe('crear un rol', () => {
    it('pide el nombre y la descripción antes de llamar a la API', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('.encabezado .boton')!.click();
      await p.asentar();
      p.enviar('dialog form');
      await p.asentar();
      p.ctrl.expectNone(`${API_BASE}/admin/roles`);
      expect(p.q('#rol-nombre')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('crea el rol con los permisos marcados y muestra un aviso', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('.encabezado .boton')!.click();
      await p.asentar();
      p.escribir('#rol-nombre', 'Revisor Externo');
      p.escribir('#rol-descripcion', 'Revisa los catálogos');
      const casillas = p.el.querySelectorAll<HTMLInputElement>(
        '.permisos-rol input[type="checkbox"]',
      );
      expect(casillas).toHaveLength(3);
      casillas[0]!.click();
      await p.asentar();
      p.enviar('dialog form');
      const req = p.ctrl.expectOne(`${API_BASE}/admin/roles`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        nombre: 'Revisor Externo',
        descripcion: 'Revisa los catálogos',
        permisos: ['catalogos.administrar'],
      });
      req.flush(rol({ id: 10, nombre: 'Revisor Externo' }), { status: 201, statusText: 'Creado' });
      await p.asentar();
      await p.recargar([...LISTA, rol({ id: 10, nombre: 'Revisor Externo', sistema: false })]);
      expect(p.diálogoAbierto()).toBeNull();
      expect(p.q('.aviso.exito')?.textContent).toContain('«Revisor Externo» se creó');
      expect(p.el.querySelectorAll('tbody tr')).toHaveLength(4);
    });

    it('los permisos exclusivos del administrador salen deshabilitados y nunca se envían', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('.encabezado .boton')!.click();
      await p.asentar();
      const casillas = p.el.querySelectorAll<HTMLInputElement>(
        '.permisos-rol input[type="checkbox"]',
      );
      const parametros = casillas[2]!;
      expect(parametros.disabled).toBe(true);
      expect(parametros.checked).toBe(false);
      expect(p.q('.permisos-rol')?.textContent).toContain('Solo el administrador');
      expect(casillas[0]!.disabled).toBe(false);
    });

    it('un rol puede crearse sin permisos', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('.encabezado .boton')!.click();
      await p.asentar();
      p.escribir('#rol-nombre', 'Rol vacío');
      p.escribir('#rol-descripcion', 'Todavía sin permisos');
      p.enviar('dialog form');
      expect(p.ctrl.expectOne(`${API_BASE}/admin/roles`).request.body.permisos).toEqual([]);
    });

    it('muestra en el campo que el nombre ya existe', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('.encabezado .boton')!.click();
      await p.asentar();
      p.escribir('#rol-nombre', 'Analista');
      p.escribir('#rol-descripcion', 'Otro rol');
      p.enviar('dialog form');
      p.ctrl
        .expectOne(`${API_BASE}/admin/roles`)
        .flush(
          errorApi('VALIDACION', 'Revise', [
            { campo: 'nombre', mensaje: 'Nombre: ya existe un rol con ese nombre o muy parecido' },
          ]),
          { status: 422, statusText: 'Inválido' },
        );
      await p.asentar();
      expect(p.q('#rol-nombre-error')?.textContent).toContain('ya existe un rol');
      expect(p.diálogoAbierto()).not.toBeNull();
    });
  });

  describe('editar un rol', () => {
    it('un rol propio precarga sus datos y permisos y guarda los cambios', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('button[title="Editar Coordinación"]')!.click();
      await p.asentar();
      expect(p.q<HTMLInputElement>('#rol-nombre')!.value).toBe('Coordinación');
      expect(p.q<HTMLInputElement>('#rol-nombre')!.disabled).toBe(false);
      const casillas = p.el.querySelectorAll<HTMLInputElement>(
        '.permisos-rol input[type="checkbox"]',
      );
      expect([...casillas].map((c) => c.checked)).toEqual([true, false, false]);
      casillas[1]!.click();
      await p.asentar();
      p.enviar('dialog form');
      const req = p.ctrl.expectOne(`${API_BASE}/admin/roles/9`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.permisos).toEqual(['catalogos.administrar', 'usuarios.administrar']);
      req.flush(rol({ id: 9 }));
      await p.asentar();
      await p.recargar(LISTA);
      expect(p.q('.aviso.exito')?.textContent).toContain('rigen de inmediato');
    });

    it('un rol del sistema conserva su nombre pero se le pueden dar permisos', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('button[title="Editar Analista"]')!.click();
      await p.asentar();
      expect(p.q<HTMLInputElement>('#rol-nombre')!.disabled).toBe(true);
      expect(p.q('#rol-nombre-ayuda')?.textContent).toContain('no se puede cambiar');
      p.el.querySelectorAll<HTMLInputElement>('.permisos-rol input[type="checkbox"]')[0]!.click();
      await p.asentar();
      p.enviar('dialog form');
      const req = p.ctrl.expectOne(`${API_BASE}/admin/roles/1`);
      expect(req.request.body.nombre).toBe('Analista');
      expect(req.request.body.permisos).toEqual(['catalogos.administrar']);
      req.flush(rol({}));
    });

    it('el rol de administrador solo se consulta: todos los permisos marcados y sin guardar', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('button[title="Ver Administrador"]')!.click();
      await p.asentar();
      const casillas = p.el.querySelectorAll<HTMLInputElement>(
        '.permisos-rol input[type="checkbox"]',
      );
      expect([...casillas].every((c) => c.checked && c.disabled)).toBe(true);
      expect(p.q('dialog[open] .aviso')?.textContent).toContain('no se puede modificar');
      expect(p.el.querySelector('dialog[open] button[type="submit"]')).toBeNull();
      p.enviar('dialog form');
      p.ctrl.expectNone(`${API_BASE}/admin/roles/2`);
    });
  });

  describe('eliminar un rol', () => {
    it('pide confirmación y lo elimina', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('button[title="Eliminar Coordinación"]')!.click();
      await p.asentar();
      expect(p.q('dialog[open]')?.textContent).toContain('Coordinación');
      p.ctrl.expectNone(`${API_BASE}/admin/roles/9`);
      [...p.el.querySelectorAll<HTMLButtonElement>('dialog[open] button')]
        .find((b) => b.textContent!.includes('Sí, eliminar'))!
        .click();
      const req = p.ctrl.expectOne(`${API_BASE}/admin/roles/9`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'Sin contenido' });
      await p.asentar();
      await p.recargar(LISTA.filter((r) => r.id !== 9));
      expect(p.q('.aviso.exito')?.textContent).toContain('se eliminó');
      expect(p.el.querySelectorAll('tbody tr')).toHaveLength(2);
    });

    it('si el rol tiene usuarios, explica por qué no se puede eliminar', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('button[title="Eliminar Coordinación"]')!.click();
      await p.asentar();
      [...p.el.querySelectorAll<HTMLButtonElement>('dialog[open] button')]
        .find((b) => b.textContent!.includes('Sí, eliminar'))!
        .click();
      p.ctrl
        .expectOne(`${API_BASE}/admin/roles/9`)
        .flush(
          errorApi(
            'ROL_EN_USO',
            'El rol lo tienen 2 usuarios: cámbieles el rol antes de eliminarlo.',
          ),
          { status: 409, statusText: 'Conflicto' },
        );
      await p.asentar();
      expect(p.q('dialog[open] .aviso.error')?.textContent).toContain('cámbieles el rol');
    });

    it('cancelar no elimina nada', async () => {
      const p = await montar();
      p.q<HTMLButtonElement>('button[title="Eliminar Coordinación"]')!.click();
      await p.asentar();
      [...p.el.querySelectorAll<HTMLButtonElement>('dialog[open] button')]
        .find((b) => b.textContent!.includes('Cancelar'))!
        .click();
      await p.asentar();
      p.ctrl.expectNone(`${API_BASE}/admin/roles/9`);
      expect(p.diálogoAbierto()).toBeNull();
    });
  });

  it('muestra el error si no se pueden cargar los roles', async () => {
    const p = montarPantalla(RolesPage);
    p.ctrl
      .expectOne(`${API_BASE}/admin/roles`)
      .flush(errorApi('SIN_PERMISO', 'No tiene permiso para esta acción'), {
        status: 403,
        statusText: 'Prohibido',
      });
    p.ctrl
      .expectOne(`${API_BASE}/admin/permisos`)
      .flush(errorApi('SIN_PERMISO', 'No tiene permiso para esta acción'), {
        status: 403,
        statusText: 'Prohibido',
      });
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('No tiene permiso');
  });
});
