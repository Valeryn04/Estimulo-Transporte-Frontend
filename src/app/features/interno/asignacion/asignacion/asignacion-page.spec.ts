import { vi } from 'vitest';
import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { Beneficiario, FilaPropuesta, Propuesta } from '../modelos-asignacion';
import { AsignacionPage } from './asignacion-page';
import { esperarTareas } from '../../../../testing/asentar';

const URL = `${API_BASE}/admin/asignacion`;
const esPropuesta = (r: { url: string }) => r.url === `${URL}/propuesta`;
const esBeneficiarios = (r: { url: string }) => r.url === `${URL}/beneficiarios`;

const fila = (n: number, c: Partial<FilaPropuesta> = {}): FilaPropuesta => ({
  posicion: n,
  solicitudId: n,
  radicado: `EST-2026-00000${n}`,
  radicadaAt: '2026-10-01T15:00:00Z',
  pcdNombre: `Persona ${n}`,
  estado: 'PRIORIZADA',
  localidad: 'Riomar',
  transporte: 'Transmetro',
  conCuidador: true,
  puntaje: 100 - n * 10,
  ajuste: 0,
  puntajeFinal: 100 - n * 10,
  criterioDesempate: null,
  alcanza: true,
  motivo: null,
  motivoTexto: null,
  ...c,
});

const propuesta = (items: FilaPropuesta[]): Propuesta => ({
  resumen: {
    vigencia: { id: 1, anio: 2026, activa: true },
    cupos: { totales: 3, ocupados: 0, liberados: 0, disponibles: 3 },
    valorEstimulo: 500_000,
    presupuesto: { total: 2_500_000, comprometido: 0, disponible: 2_500_000 },
    distribucion: { localidades: [], transportes: [] },
  },
  total: items.length,
  alcanzan: items.filter((x) => x.alcanza).length,
  sinCupo: items.filter((x) => !x.alcanza).length,
  items,
});

const TRES = [
  fila(1),
  fila(2),
  fila(3, {
    alcanza: false,
    motivo: 'SIN_PRESUPUESTO',
    motivoTexto: 'No alcanza el presupuesto disponible',
  }),
];

const PERMISOS = ['asignacion.ver', 'asignacion.asignar'];

describe('AsignacionPage', () => {
  async function montar(items: FilaPropuesta[] = TRES, permisos = PERMISOS) {
    const p = montarPantalla(AsignacionPage, {}, permisos);
    p.ctrl.expectOne(esPropuesta).flush(propuesta(items));
    await p.asentar();
    return p;
  }

  const marcar = (el: HTMLElement, radicado: string) =>
    el.querySelector<HTMLInputElement>(`input[aria-label="Marcar el caso ${radicado}"]`)!.click();
  const boton = (el: HTMLElement, texto: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(texto),
    )!;

  it('ofrece la pestaña de cupos y presupuesto a quien los administra, sin salir del menú de Asignación', async () => {
    const { el } = await montar(TRES, ['asignacion.ver', 'cupos.administrar']);
    expect([...el.querySelectorAll('.pestanas a')].map((a) => a.textContent?.trim())).toEqual([
      'Asignación del beneficio',
      'Cupos y presupuesto',
    ]);
  });

  it('muestra los cupos y el presupuesto y la propuesta en orden con lo que alcanza y lo que no', async () => {
    const { el } = await montar();
    expect(el.querySelector('.resumen')?.textContent).toContain('3 de 3');
    expect(el.querySelector('.total')?.textContent).toContain('2 alcanzan');
    const filas = el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(3);
    expect(filas[0]?.textContent).toContain('EST-2026-000001');
    expect(filas[0]?.textContent).toContain('Alcanza');
    expect(filas[2]?.textContent).toContain('No alcanza');
    expect(filas[2]?.textContent).toContain('No alcanza el presupuesto disponible');
    // Lo que no alcanza no se puede marcar.
    expect(
      el.querySelector<HTMLInputElement>('input[aria-label="Marcar el caso EST-2026-000003"]')!
        .disabled,
    ).toBe(true);
  });

  it('sin permiso de asignar solo se consulta', async () => {
    const { el } = await montar(TRES, ['asignacion.ver']);
    expect(el.querySelector('tbody input[type="checkbox"]')).toBeNull();
    expect(el.querySelector('.barra')).toBeNull();
  });

  it('marca los que alcanzan y los asigna por lote, sin pedir causas', async () => {
    const { el, ctrl, asentar } = await montar();
    boton(el, 'Marcar los que alcanzan').click();
    await asentar();
    expect(boton(el, 'Asignar los marcados').textContent).toContain('(2)');
    boton(el, 'Asignar los marcados').click();
    await esperarTareas();
    const r = ctrl.expectOne(`${URL}/asignar`);
    expect(r.request.body).toEqual({ solicitudIds: [1, 2], omisiones: [] });
    r.flush(
      { asignados: 2, resumen: propuesta([]).resumen },
      { status: 201, statusText: 'Creado' },
    );
    await asentar();
    ctrl.expectOne(esPropuesta).flush(propuesta([fila(3)]));
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('2 caso(s) asignado(s)');
  });

  it('si se salta un caso que iba antes pide la causa de cada uno antes de asignar', async () => {
    const { el, ctrl, asentar } = await montar();
    marcar(el, 'EST-2026-000002');
    await asentar();
    boton(el, 'Asignar los marcados').click();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    const dialogo = el.querySelector('dialog[open]')!;
    expect(dialogo.textContent).toContain('EST-2026-000001');
    // Sin la causa no se envía.
    dialogo.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(dialogo.querySelector('.aviso.error')?.textContent).toContain('causa');
    const causa = dialogo.querySelector<HTMLTextAreaElement>('#causa-0')!;
    causa.value = 'La familia pidió aplazar la entrega';
    causa.dispatchEvent(new Event('input'));
    dialogo.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const r = ctrl.expectOne(`${URL}/asignar`);
    expect(r.request.body).toEqual({
      solicitudIds: [2],
      omisiones: [{ solicitudId: 1, causa: 'La familia pidió aplazar la entrega' }],
    });
    r.flush(
      { asignados: 1, resumen: propuesta([]).resumen },
      { status: 201, statusText: 'Creado' },
    );
    await asentar();
    ctrl.expectOne(esPropuesta).flush(propuesta([fila(1), fila(3)]));
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('1 caso(s) asignado(s)');
  });

  it('muestra el error de la API al asignar', async () => {
    const { el, ctrl, asentar } = await montar();
    marcar(el, 'EST-2026-000001');
    await asentar();
    boton(el, 'Asignar los marcados').click();
    await esperarTareas();
    ctrl
      .expectOne(`${URL}/asignar`)
      .flush(errorApi('SIN_CUPO', 'EST-2026-000001: No quedan cupos disponibles.'), {
        status: 409,
        statusText: 'Conflicto',
      });
    await asentar();
    expect(el.querySelector('.aviso.error')?.textContent).toContain('No quedan cupos');
  });

  it('pasa a lista de espera los que no alcanzan, con confirmación', async () => {
    const { el, ctrl, asentar } = await montar();
    boton(el, 'Pasar a lista de espera los que no alcanzan').click();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('dialog[open]')?.textContent).toContain('se les notificará');
    [...el.querySelectorAll<HTMLButtonElement>('dialog[open] .boton')]
      .find((b) => b.textContent?.trim() === 'Pasar a lista de espera')!
      .click();
    await esperarTareas();
    const r = ctrl.expectOne(`${URL}/lista-espera`);
    r.flush({ enListaDeEspera: 1, radicados: ['EST-2026-000003'] });
    await asentar();
    ctrl.expectOne(esPropuesta).flush(
      propuesta([
        fila(1),
        fila(2),
        fila(3, {
          estado: 'EN_LISTA_ESPERA',
          alcanza: false,
          motivo: 'SIN_PRESUPUESTO',
          motivoTexto: 'No alcanza el presupuesto disponible',
        }),
      ]),
    );
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain(
      '1 caso(s) pasaron a lista de espera',
    );
    expect(el.querySelectorAll('tbody tr')[2]?.textContent).toContain('En lista de espera');
  });

  it('lista los beneficiarios con la trazabilidad del cupo reasignado', async () => {
    const { el, ctrl, asentar } = await montar();
    boton(el, 'Beneficiarios').click();
    const ben: Beneficiario[] = [
      {
        id: 2,
        solicitudId: 3,
        radicado: 'EST-2026-000003',
        pcdNombre: 'Persona 3',
        estado: 'PENDIENTE_ENTREGA',
        personas: 2,
        valorComprometido: 1_000_000,
        localidad: 'Riomar',
        transporte: null,
        puntajeFinal: 70,
        posicion: 1,
        asignadoPor: 'asignador',
        asignadoAt: '2026-10-06T10:00:00Z',
        reemplazaRadicado: 'EST-2026-000001',
        finalizadoAt: null,
        motivoFin: null,
        entregas: 1,
      },
      {
        id: 1,
        solicitudId: 1,
        radicado: 'EST-2026-000001',
        pcdNombre: 'Persona 1',
        estado: 'FINALIZADO',
        personas: 1,
        valorComprometido: 500_000,
        localidad: null,
        transporte: null,
        puntajeFinal: 90,
        posicion: 1,
        asignadoPor: 'asignador',
        asignadoAt: '2026-10-05T10:00:00Z',
        reemplazaRadicado: null,
        finalizadoAt: '2026-10-06T09:00:00Z',
        motivoFin: 'Renuncia voluntaria',
        entregas: 0,
      },
    ];
    ctrl.expectOne(esBeneficiarios).flush({ items: ben, total: 2 });
    await asentar();
    const filas = el.querySelectorAll('tbody tr');
    expect(filas[0]?.textContent).toContain('Pendiente de entrega');
    expect(filas[0]?.textContent).toContain('Reasignado del cupo de EST-2026-000001');
    expect(filas[1]?.textContent).toContain('Finalizado');
    expect(filas[1]?.textContent).toContain('Renuncia voluntaria');
  });

  it('genera la planilla de entrega solo con los beneficios marcados que esperan su tarjeta', async () => {
    const { el, ctrl, asentar } = await montar();
    boton(el, 'Beneficiarios').click();
    const base = {
      solicitudId: 3,
      pcdNombre: 'Persona',
      valorComprometido: 1,
      localidad: null,
      transporte: null,
      puntajeFinal: 70,
      posicion: 1,
      asignadoPor: 'asignador',
      asignadoAt: '2026-10-06T10:00:00Z',
      reemplazaRadicado: null,
      finalizadoAt: null,
      motivoFin: null,
    };
    const items: Beneficiario[] = [
      {
        ...base,
        id: 2,
        radicado: 'EST-2026-000003',
        estado: 'PENDIENTE_ENTREGA',
        personas: 2,
        entregas: 0,
      },
      {
        ...base,
        id: 1,
        radicado: 'EST-2026-000001',
        estado: 'FINALIZADO',
        personas: 1,
        entregas: 0,
      },
    ];
    ctrl.expectOne(esBeneficiarios).flush({ items, total: 2 });
    await asentar();
    const marcas = el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]');
    expect(marcas).toHaveLength(1);
    const generar = [...el.querySelectorAll<HTMLButtonElement>('.acta-entrega button')][0]!;
    expect(generar.disabled).toBe(true);
    marcas[0]!.click();
    await asentar();
    expect(generar.disabled).toBe(false);
    globalThis.URL.createObjectURL = () => 'blob:acta';
    globalThis.URL.revokeObjectURL = () => undefined;
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    generar.click();
    const r = ctrl.expectOne((x) => x.url === `${URL}/actas-entrega`);
    expect(r.request.params.get('beneficios')).toBe('2');
    r.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    await asentar();
    expect(abrir).toHaveBeenCalledWith('blob:acta', '_blank', 'noopener');
  });
});
