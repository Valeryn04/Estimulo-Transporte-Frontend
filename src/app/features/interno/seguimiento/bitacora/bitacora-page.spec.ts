import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { PaginaBitacora } from '../modelos-seguimiento';
import { BitacoraPage } from './bitacora-page';

const URL = `${API_BASE}/admin/bitacora`;
const esBitacora = (r: { url: string }) => r.url === URL;

const pagina = (extra: Partial<PaginaBitacora> = {}): PaginaBitacora => ({
  pagina: 1,
  tamano: 25,
  total: 2,
  sensiblesOcultos: false,
  items: [
    {
      id: 2,
      fecha: '2026-10-20T15:00:00Z',
      usuario: 'asignador',
      modulo: 'asignacion',
      accion: 'BENEFICIO_ASIGNADO',
      entidad: 'beneficio',
      entidadId: '1',
      radicado: 'EST-2026-000001',
      justificacion: null,
      ip: '10.0.0.5',
      anterior: null,
      nuevo: { estado: 'PENDIENTE_ENTREGA' },
      detalle: {},
    },
    {
      id: 1,
      fecha: '2026-10-20T14:00:00Z',
      usuario: null,
      modulo: 'preinscripcion',
      accion: 'PREINSCRIPCION_CREADA',
      entidad: 'solicitud',
      entidadId: '1',
      radicado: null,
      justificacion: null,
      ip: null,
      anterior: null,
      nuevo: null,
      detalle: {},
    },
  ],
  ...extra,
});

describe('BitacoraPage', () => {
  async function montar(datos = pagina()) {
    const p = montarPantalla(BitacoraPage, {}, ['bitacora.ver']);
    p.ctrl.expectOne(`${URL}/modulos`).flush({ items: ['asignacion', 'preinscripcion'] });
    p.ctrl.expectOne(`${URL}/acciones`).flush({ items: ['BENEFICIO_ASIGNADO', 'LOGIN_OK'] });
    p.ctrl.expectOne(esBitacora).flush(datos);
    await p.asentar();
    return p;
  }

  it('lista los eventos con su usuario, acción y expediente', async () => {
    const { el } = await montar();
    const filas = el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('Beneficio asignado');
    expect(filas[0]?.textContent).toContain('asignador');
    expect(filas[0]?.querySelector('a')?.textContent).toContain('EST-2026-000001');
    expect(filas[1]?.textContent).toContain('Sistema o ciudadano');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('2 evento(s)');
  });

  it('muestra los valores solo cuando el evento los tiene', async () => {
    const { el } = await montar();
    const filas = el.querySelectorAll('tbody tr');
    expect(filas[0]?.querySelector('details')?.textContent).toContain('PENDIENTE_ENTREGA');
    expect(filas[1]?.querySelector('details')).toBeNull();
  });

  it('avisa cuando los valores están ocultos por falta de permiso', async () => {
    const { el } = await montar(pagina({ sensiblesOcultos: true }));
    expect(el.querySelector('[role="status"]')?.textContent).toContain('datos sensibles');
  });

  it('busca con los filtros escritos y vuelve a la primera página', async () => {
    const { ctrl, escribir, enviar, asentar } = await montar();
    escribir('#radicado', ' EST-2026-000001 ');
    escribir('#modulo', 'asignacion');
    escribir('#desde', '2026-10-01');
    enviar('form[role="search"]');
    const r = ctrl.expectOne(esBitacora);
    expect(r.request.params.get('radicado')).toBe('EST-2026-000001');
    expect(r.request.params.get('modulo')).toBe('asignacion');
    expect(r.request.params.get('desde')).toBe('2026-10-01');
    expect(r.request.params.get('usuario')).toBeNull();
    expect(r.request.params.get('pagina')).toBe('1');
    r.flush(pagina({ total: 1 }));
    await asentar();
  });

  it('exporta la bitácora con los filtros escritos solo a quien puede exportar', async () => {
    globalThis.URL.createObjectURL = () => 'blob:prueba';
    globalThis.URL.revokeObjectURL = () => undefined;
    const p = montarPantalla(BitacoraPage, {}, ['bitacora.ver', 'reportes.exportar']);
    p.ctrl.expectOne(`${URL}/modulos`).flush({ items: [] });
    p.ctrl.expectOne(`${URL}/acciones`).flush({ items: [] });
    p.ctrl.expectOne(esBitacora).flush(pagina());
    await p.asentar();
    p.escribir('#radicado', 'EST-2026-000001');
    [...p.el.querySelectorAll<HTMLButtonElement>('.acciones button')]
      .find((b) => b.textContent?.includes('Excel'))!
      .click();
    const r = p.ctrl.expectOne((q) => q.url === `${URL}/exportar`);
    expect(r.request.params.get('formato')).toBe('XLSX');
    expect(r.request.params.get('radicado')).toBe('EST-2026-000001');
    expect(r.request.responseType).toBe('blob');
    r.flush(new Blob(['x']));
    await p.asentar();
  });

  it('sin permiso de exportación no hay botones de exportar', async () => {
    const { el } = await montar();
    expect([...el.querySelectorAll('.acciones button')].map((b) => b.textContent?.trim())).toEqual([
      'Buscar',
      'Limpiar',
    ]);
  });

  it('pasa de página', async () => {
    const { el, ctrl, asentar } = await montar(pagina({ total: 60 }));
    expect(el.textContent).toContain('Página 1 de 3');
    [...el.querySelectorAll<HTMLButtonElement>('.paginas button')]
      .find((b) => b.textContent?.includes('Siguiente'))!
      .click();
    const r = ctrl.expectOne(esBitacora);
    expect(r.request.params.get('pagina')).toBe('2');
    r.flush(pagina({ pagina: 2, total: 60 }));
    await asentar();
    expect(el.textContent).toContain('Página 2 de 3');
  });

  it('muestra el error de la API', async () => {
    const p = montarPantalla(BitacoraPage, {}, ['bitacora.ver']);
    p.ctrl.expectOne(`${URL}/modulos`).flush({ items: [] });
    p.ctrl.expectOne(`${URL}/acciones`).flush({ items: [] });
    p.ctrl.expectOne(esBitacora).flush(errorApi('VALIDACION', 'Desde: use el formato AAAA-MM-DD'), {
      status: 422,
      statusText: 'No procesable',
    });
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('Desde');
  });
});
