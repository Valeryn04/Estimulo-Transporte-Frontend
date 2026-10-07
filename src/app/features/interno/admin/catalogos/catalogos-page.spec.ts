import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { CatalogosPage } from './catalogos-page';

const item = (c: object) => ({
  id: 1,
  catalogo: 'TIPO_IDENTIFICACION',
  codigo: 'CC',
  nombre: 'Cédula de Ciudadanía',
  padreId: null,
  padreNombre: null,
  orden: 1,
  activo: true,
  version: 1,
  updatedAt: '2026-10-01T10:00:00Z',
  ...c,
});

const RESUMEN = [
  { catalogo: 'TIPO_IDENTIFICACION', total: 5, activos: 5 },
  { catalogo: 'LOCALIDAD', total: 5, activos: 5 },
  { catalogo: 'BARRIO', total: 178, activos: 178 },
];

describe('CatalogosPage', () => {
  async function montar() {
    const p = montarPantalla(CatalogosPage);
    p.ctrl.expectOne(`${API_BASE}/admin/catalogos`).flush({ items: RESUMEN });
    p.ctrl
      .expectOne((r) => r.url.endsWith('/catalogos/LOCALIDAD/items'))
      .flush({
        items: [item({ id: 10, catalogo: 'LOCALIDAD', nombre: 'Riomar' })],
        total: 1,
        pagina: 1,
        tamano: 100,
      });
    p.ctrl
      .expectOne((r) => r.url.endsWith('/catalogos/TIPO_IDENTIFICACION/items'))
      .flush({
        items: [
          item({}),
          item({ id: 2, codigo: 'TI', nombre: 'Tarjeta de Identidad', activo: false }),
        ],
        total: 2,
        pagina: 1,
        tamano: 20,
      });
    await p.asentar();
    return p;
  }

  it('muestra las listas con su número de elementos activos y el contenido de la primera', async () => {
    const { el } = await montar();
    const opciones = [...el.querySelectorAll('#lista option')].map((o) =>
      o.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(opciones[0]).toBe('Tipos de identificación (5 activos)');
    expect(opciones).toContain('Barrios (178 activos)');
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.querySelector('tbody')?.textContent).toContain('Inactivo');
  });

  it('crear un tipo de identificación exige su sigla y envía los datos a la API', async () => {
    const { fixture, el, ctrl, escribir, enviar, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    enviar();
    await asentar();
    expect(el.querySelector('dialog')?.textContent).toContain('Sigla');
    ctrl.expectNone((r) => r.method === 'POST');

    escribir('#item-nombre', 'Pasaporte');
    escribir('#item-codigo', 'pa');
    enviar();
    const req = ctrl.expectOne(`${API_BASE}/admin/catalogos/TIPO_IDENTIFICACION/items`);
    expect(req.request.body).toEqual({
      nombre: 'Pasaporte',
      codigo: 'PA',
      padreId: null,
      orden: 0,
    });
    req.flush(item({ id: 9, codigo: 'PA', nombre: 'Pasaporte' }), {
      status: 201,
      statusText: 'Creado',
    });
    await asentar();
    ctrl.expectOne(`${API_BASE}/admin/catalogos`).flush({ items: RESUMEN });
    ctrl
      .expectOne((r) => r.url.endsWith('/catalogos/TIPO_IDENTIFICACION/items'))
      .flush({ items: [], total: 0, pagina: 1, tamano: 20 });
    await asentar();
    expect(fixture.nativeElement.querySelector('.aviso.exito')?.textContent).toContain('Pasaporte');
  });

  it('un barrio exige la localidad y marca el campo como obligatorio', async () => {
    const { el, ctrl, asentar, escribir, enviar } = await montar();
    escribir('#lista', 'BARRIO');
    ctrl
      .expectOne((r) => r.url.endsWith('/catalogos/BARRIO/items'))
      .flush({ items: [], total: 0, pagina: 1, tamano: 20 });
    await asentar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    expect(el.querySelector('dialog')?.textContent).toContain('Localidad *');
    escribir('#item-nombre', 'Barrio Nuevo');
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('#item-localidad-error')?.textContent).toContain('Localidad');
  });

  it('desactivar llama a la API y muestra el error de negocio cuando la localidad tiene barrios activos', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('button[title="Desactivar Cédula de Ciudadanía"]')!.click();
    ctrl
      .expectOne(`${API_BASE}/admin/catalogos/items/1/desactivar`)
      .flush(errorApi('TIENE_BARRIOS_ACTIVOS', 'La localidad tiene barrios activos'), {
        status: 409,
        statusText: 'Conflicto',
      });
    await asentar();
    expect(el.querySelector('.aviso.error')?.textContent).toContain('barrios activos');
  });

  it('muestra el historial de versiones de un elemento', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>(
      'button[title="Historial de Cédula de Ciudadanía"]',
    )!.click();
    ctrl.expectOne(`${API_BASE}/admin/catalogos/items/1/versiones`).flush({
      items: [
        {
          version: 2,
          snapshot: { nombre: 'Cédula', orden: 1, activo: true },
          usuario: 'admin',
          creadoAt: '2026-10-02T10:00:00Z',
        },
        {
          version: 1,
          snapshot: { nombre: 'Cédula de Ciudadanía', orden: 1, activo: true },
          usuario: null,
          creadoAt: '2026-10-01T10:00:00Z',
        },
      ],
    });
    await asentar();
    const versiones = el.querySelectorAll('dialog .historial li');
    expect(versiones).toHaveLength(2);
    expect(versiones[0]?.textContent).toContain('Versión 2');
    expect(versiones[1]?.textContent).toContain('Sistema');
  });
});
