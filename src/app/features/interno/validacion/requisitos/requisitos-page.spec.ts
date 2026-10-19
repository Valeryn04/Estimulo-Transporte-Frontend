import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { Requisito } from '../modelos-validacion';
import { RequisitosPage } from './requisitos-page';

const req = (c: Partial<Requisito>): Requisito => ({
  id: 1,
  codigo: 'PCD_SISBEN',
  nombre: 'SISBÉN IV grupo A, B o C',
  descripcion: 'Está clasificada en SISBÉN IV.',
  aplicaA: 'PCD',
  fuenteSugerida: 'Consulta del SISBÉN IV',
  documentoId: 4,
  documentoNombre: 'Soporte SISBÉN IV',
  campos: [],
  cruceCodigo: null,
  activo: true,
  version: 1,
  ...c,
});

const URL = `${API_BASE}/admin/requisitos`;

describe('RequisitosPage', () => {
  async function montar(
    lista: Requisito[] = [
      req({}),
      req({
        id: 2,
        nombre: 'Carta firmada',
        aplicaA: 'COMUN',
        documentoId: null,
        documentoNombre: null,
        campos: ['celular'],
        activo: false,
      }),
    ],
  ) {
    const p = montarPantalla(RequisitosPage, {}, ['requisitos.administrar']);
    p.ctrl.expectOne(URL).flush({ items: lista });
    p.ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos`).flush({
      items: [
        {
          id: 4,
          nombre: 'Soporte SISBÉN IV',
          codigo: 'X',
          descripcion: '',
          aplicaA: 'PCD',
          obligatorio: true,
          activo: true,
          version: 1,
        },
      ],
    });
    p.ctrl.expectOne(`${URL}/cruces`).flush({
      items: [{ codigo: 'BENEFICIOS_INCOMPATIBLES', nombre: 'Apoyos de transporte incompatibles' }],
    });
    await p.asentar();
    return p;
  }

  it('lista los requisitos con a quién aplican y qué puede corregir la persona', async () => {
    const { el } = await montar();
    const filas = el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('SISBÉN IV grupo A, B o C');
    expect(filas[0]?.textContent).toContain('Documento: Soporte SISBÉN IV');
    expect(filas[1]?.textContent).toContain('1 dato(s) del formulario');
    expect(filas[1]?.textContent).toContain('Inactivo');
  });

  it('crea un requisito con el documento y los datos que la persona podrá corregir', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    escribir('#req-nombre', 'Convivencia con el cuidador');
    escribir('#req-aplica', 'COMUN');
    const celular = [...el.querySelectorAll<HTMLInputElement>('.datos-corregibles input')].find(
      (i) => i.parentElement!.textContent!.trim() === 'Celular',
    )!;
    celular.click();
    await asentar();
    enviar();
    const r = ctrl.expectOne(URL);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toMatchObject({
      nombre: 'Convivencia con el cuidador',
      aplicaA: 'COMUN',
      documentoId: null,
      cruceCodigo: null,
    });
    expect(r.request.body.campos).toEqual(['celular']);
    r.flush(req({ id: 3 }), { status: 201, statusText: 'Creado' });
    await asentar();
    ctrl.expectOne(URL).flush({ items: [req({})] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('Convivencia con el cuidador');
  });

  it('muestra en el campo el error de nombre repetido que devuelve la API', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    escribir('#req-nombre', 'SISBÉN IV grupo A, B o C');
    enviar();
    ctrl.expectOne(URL).flush(
      errorApi('VALIDACION', 'Revise', [
        {
          campo: 'nombre',
          mensaje: 'Nombre: ya existe un requisito con ese nombre para esa persona',
        },
      ]),
      { status: 422, statusText: 'No procesable' },
    );
    await asentar();
    expect(el.querySelector('#req-nombre-error')?.textContent).toContain('ya existe');
  });

  it('activa y desactiva sin borrar', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>(
      'button[title="Desactivar SISBÉN IV grupo A, B o C"]',
    )!.click();
    ctrl.expectOne(`${URL}/1/desactivar`).flush(req({ activo: false }));
    await asentar();
    ctrl.expectOne(URL).flush({ items: [req({ activo: false })] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('desactivado');
  });

  it('muestra el historial de versiones', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>(
      'button[title="Historial de SISBÉN IV grupo A, B o C"]',
    )!.click();
    ctrl.expectOne(`${URL}/1/versiones`).flush({
      items: [
        {
          version: 2,
          snapshot: { nombre: 'SISBÉN IV', activo: true },
          usuario: 'admin',
          creadoAt: '2026-10-02T10:00:00Z',
        },
        {
          version: 1,
          snapshot: { nombre: 'SISBÉN', activo: true },
          usuario: null,
          creadoAt: '2026-10-01T10:00:00Z',
        },
      ],
    });
    await asentar();
    expect(el.querySelector('dialog[open]')?.textContent).toContain('Versión 2');
  });
});
