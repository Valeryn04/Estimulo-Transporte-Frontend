import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { Excepcion } from '../modelos-priorizacion';
import { ExcepcionesPage } from './excepciones-page';
import { esperarTareas } from '../../../../testing/asentar';

const URL = `${API_BASE}/admin/priorizacion/excepciones`;
const esLista = (r: { url: string }) => r.url === URL;

const excepcion = (c: Partial<Excepcion> = {}): Excepcion => ({
  id: 1,
  solicitudId: 7,
  radicado: 'EST-2026-000007',
  pcdNombre: 'María Fernanda Pérez',
  puntajeOriginal: 35,
  ajuste: 20,
  puntajeConAjuste: 55,
  justificacion: 'Lista de espera de trasplante con controles semanales.',
  evidencia: { nombre: 'soporte.pdf', mime: 'application/pdf', tamanoBytes: 100, sha256: 'a' },
  estado: 'PROPUESTA',
  propuestaPor: 'asignador',
  propuestaAt: '2026-10-05T10:00:00Z',
  decididaPor: null,
  decididaAt: null,
  motivoDecision: null,
  aplicable: false,
  ...c,
});

describe('ExcepcionesPage', () => {
  async function montar(
    items: Excepcion[] = [excepcion()],
    permisos = ['priorizacion.ver', 'priorizacion.aprobar'],
  ) {
    const p = montarPantalla(ExcepcionesPage, {}, permisos);
    p.ctrl.expectOne(esLista).flush({ items, total: items.length });
    await p.asentar();
    return p;
  }

  it('lista por defecto las pendientes, con el ajuste, la justificación y quién las propuso', async () => {
    const { el } = await montar();
    const fila = el.querySelector('tbody tr')!;
    expect(fila.textContent).toContain('EST-2026-000007');
    expect(fila.textContent).toContain('35 → 55');
    expect(fila.textContent).toContain('+20');
    expect(fila.textContent).toContain('trasplante');
    expect(fila.textContent).toContain('asignador');
    expect(fila.textContent).toContain('Pendiente de decisión');
  });

  it('cambia el filtro de estado y vuelve a consultar', async () => {
    const { ctrl, escribir, asentar } = await montar();
    escribir('#estado', 'APROBADA');
    const r = ctrl.expectOne(esLista);
    expect(r.request.params.get('estado')).toBe('APROBADA');
    r.flush({ items: [excepcion({ estado: 'APROBADA', aplicable: true })], total: 1 });
    await asentar();
  });

  it('el responsable aprueba y el ajuste pasa a contar', async () => {
    const { el, ctrl, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.includes('Aprobar'))!
      .click();
    await asentar();
    [...el.querySelectorAll<HTMLButtonElement>('dialog[open] .boton')]
      .find((b) => b.textContent?.trim() === 'Aprobar')!
      .click();
    await esperarTareas();
    const r = ctrl.expectOne(`${URL}/1/decision`);
    expect(r.request.body).toEqual({ decision: 'APROBAR', motivo: '' });
    r.flush(excepcion({ estado: 'APROBADA', aplicable: true }));
    await asentar();
    ctrl.expectOne(esLista).flush({ items: [], total: 0 });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('aprobada');
  });

  it('rechazar exige un motivo y muestra el error de la API', async () => {
    const { el, ctrl, escribir, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.includes('Rechazar'))!
      .click();
    await asentar();
    el.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(new Event('submit'));
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('dialog[open] .aviso.error')?.textContent).toContain('Explique');
    escribir('#motivo', 'No hay evidencia suficiente');
    el.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(new Event('submit'));
    ctrl
      .expectOne(`${URL}/1/decision`)
      .flush(errorApi('EXCEPCION_DECIDIDA', 'Esta excepción ya fue decidida.'), {
        status: 409,
        statusText: 'Conflicto',
      });
    await asentar();
    expect(el.querySelector('dialog[open] .aviso.error')?.textContent).toContain('ya fue decidida');
  });

  it('quien propuso la excepción no ve cómo decidirla, ni quien no aprueba', async () => {
    const propia = await montar([excepcion({ propuestaPor: 'prueba' })]);
    expect(propia.el.querySelector('tbody')?.textContent).not.toContain('Aprobar');
    expect(propia.el.querySelector('tbody')?.textContent).toContain('Ver evidencia');
  });

  it('sin permiso de aprobar solo se consulta', async () => {
    const { el } = await montar([excepcion()], ['priorizacion.ver']);
    expect(el.querySelector('tbody')?.textContent).not.toContain('Aprobar');
  });

  it('avisa que una excepción aprobada ya no se aplica si el puntaje se recalculó', async () => {
    const { el } = await montar([
      excepcion({ estado: 'APROBADA', aplicable: false, decididaPor: 'responsable' }),
    ]);
    expect(el.querySelector('tbody')?.textContent).toContain(
      'No se aplica: el puntaje se recalculó',
    );
  });
});
