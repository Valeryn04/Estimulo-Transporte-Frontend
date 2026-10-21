import { API_BASE } from '../../../core/api/api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { AlertasCrucePage } from './alertas/alertas-cruce-page';
import { ExpedienteBeneficio } from './expediente/expediente-beneficio';
import { AlertaCruce, ExpedienteNovedades, Revocatoria } from './modelos-novedades';
import { RevocatoriasPage } from './revocatorias/revocatorias-page';
import { NovedadesPage } from './resumen/novedades-page';

const URL = `${API_BASE}/admin/novedades`;
const GESTOR = ['novedades.ver', 'novedades.gestionar'];

const expediente = (c: Partial<ExpedienteNovedades> = {}): ExpedienteNovedades => ({
  beneficio: {
    id: 5,
    radicado: 'EST-2026-000005',
    estado: 'ACTIVO',
    pcdNombre: 'María Fernanda Pérez',
    hoy: '2026-10-19',
    asignadoDia: '2026-10-05',
  },
  novedades: [],
  revocatorias: [],
  causales: {
    bloqueo: [{ id: 11, nombre: 'Reporte de pérdida de la tarjeta' }],
    revocatoria: [{ id: 21, nombre: 'Uso indebido' }],
  },
  ...c,
});

const archivo = (el: HTMLElement, id: string) => {
  const input = el.querySelector<HTMLInputElement>(id)!;
  Object.defineProperty(input, 'files', {
    value: [new File(['%PDF-1.4'], 'soporte.pdf', { type: 'application/pdf' })],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
};

const revocatoria = (c: Partial<Revocatoria> = {}): Revocatoria => ({
  id: 3,
  beneficioId: 5,
  radicado: 'EST-2026-000005',
  pcdNombre: 'María Fernanda Pérez',
  causal: 'Uso indebido',
  descripcion: 'Uso por una persona distinta a la autorizada.',
  estado: 'INICIADA',
  resultado: null,
  trasladoAt: null,
  venceDescargosAt: null,
  descargosAt: null,
  sinDescargos: false,
  decididaAt: null,
  iniciadaPor: 'gestor',
  creadaAt: '2026-10-05T10:00:00Z',
  puedeDecidir: false,
  puedeSinDescargos: false,
  plazoDecisionDias: 15,
  eventos: [
    {
      id: 1,
      etapa: 'INICIO',
      texto: 'Uso por una persona distinta a la autorizada.',
      fecha: '2026-10-05',
      referencia: null,
      evidencia: { nombre: 'reporte.pdf', tamanoBytes: 10 },
      usuario: 'gestor',
      creadoAt: '2026-10-05T10:00:00Z',
    },
  ],
  ...c,
});

describe('NovedadesPage', () => {
  it('lista los beneficios con su estado y abre el expediente', async () => {
    const p = montarPantalla(NovedadesPage, {}, GESTOR);
    p.ctrl
      .expectOne((r) => r.url === `${URL}/resumen`)
      .flush({
        items: [
          {
            beneficioId: 5,
            radicado: 'EST-2026-000005',
            pcdNombre: 'María',
            estado: 'BLOQUEADO',
            novedades: 2,
            revocatoria: null,
          },
          {
            beneficioId: 6,
            radicado: 'EST-2026-000006',
            pcdNombre: 'Luis',
            estado: 'ACTIVO',
            novedades: 0,
            revocatoria: 'EN_TRASLADO',
          },
        ],
        total: 2,
      });
    await p.asentar();
    const filas = p.el.querySelectorAll('tbody tr');
    expect(filas[0]?.textContent).toContain('Bloqueado');
    expect(filas[1]?.textContent).toContain('En curso');
    p.el.querySelector<HTMLButtonElement>('tbody .enlace')!.click();
    await p.asentar();
    p.ctrl.expectOne(`${URL}/beneficios/5`).flush(expediente());
    await p.asentar();
    expect(p.el.querySelector('dialog[open]')?.textContent).toContain('EST-2026-000005');
  });
});

describe('ExpedienteBeneficio', () => {
  async function montar(d: ExpedienteNovedades = expediente(), puede = true) {
    const p = montarPantalla(
      ExpedienteBeneficio,
      { beneficioId: 5, puedeGestionar: puede },
      GESTOR,
    );
    await p.asentar();
    p.ctrl.expectOne(`${URL}/beneficios/5`).flush(d);
    await p.asentar();
    return p;
  }

  it('un beneficio activo se puede bloquear o suspender, y un bloqueado solo reactivar', async () => {
    const a = await montar();
    expect(
      [...a.el.querySelectorAll<HTMLOptionElement>('#nov-tipo option')].map((o) => o.value),
    ).toEqual(['BLOQUEO', 'SUSPENSION']);
  });

  it('exige causal y evidencia, y registra la novedad con la fecha efectiva', async () => {
    const p = await montar();
    p.enviar('dialog form');
    await p.asentar();
    p.ctrl.expectNone((r) => r.method === 'POST');
    const causal = p.el.querySelector<HTMLSelectElement>('#nov-causal')!;
    causal.selectedIndex = 1;
    causal.dispatchEvent(new Event('change'));
    p.escribir('#nov-obs', 'Reporte recibido en la línea de atención');
    p.enviar('dialog form');
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('evidencia');
    archivo(p.el, '#nov-evidencia');
    p.enviar('dialog form');
    const r = p.ctrl.expectOne(`${URL}/beneficios/5/novedades`);
    expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
      tipo: 'BLOQUEO',
      causalId: 11,
      fechaEfectiva: '2026-10-19',
      observacion: 'Reporte recibido en la línea de atención',
    });
    r.flush(expediente(), { status: 201, statusText: 'Creado' });
    await p.asentar();
    p.ctrl.expectOne(`${URL}/beneficios/5`).flush(
      expediente({
        beneficio: { ...expediente().beneficio, estado: 'BLOQUEADO' },
        novedades: [
          {
            id: 1,
            tipo: 'BLOQUEO',
            tipoNombre: 'Bloqueo temporal',
            causal: 'Reporte de pérdida de la tarjeta',
            fechaEfectiva: '2026-10-19',
            observacion: 'Reporte recibido',
            evidencia: { nombre: 'soporte.pdf', tamanoBytes: 10 },
            responsable: 'gestor',
            levantamientoProgramado: null,
            estadoPrevio: 'ACTIVO',
            creadaAt: '2026-10-19T10:00:00Z',
            abierta: true,
          },
        ],
      }),
    );
    await p.asentar();
    expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('comunicada');
    expect(p.el.querySelector('tbody')?.textContent).toContain('Sin levantar');
    expect(
      [...p.el.querySelectorAll<HTMLOptionElement>('#nov-tipo option')].map((o) => o.value),
    ).toEqual(['LEVANTAMIENTO']);
  });

  it('muestra el error de la API al registrar', async () => {
    const p = await montar();
    const causal = p.el.querySelector<HTMLSelectElement>('#nov-causal')!;
    causal.selectedIndex = 1;
    causal.dispatchEvent(new Event('change'));
    archivo(p.el, '#nov-evidencia');
    p.enviar('dialog form');
    p.ctrl
      .expectOne(`${URL}/beneficios/5/novedades`)
      .flush(errorApi('BENEFICIO_NO_ACTIVO', 'Solo se bloquea o suspende un beneficio activo.'), {
        status: 409,
        statusText: 'Conflicto',
      });
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('beneficio activo');
  });

  it('inicia una revocatoria con causal, hechos y evidencia', async () => {
    const p = await montar();
    const causal = p.el.querySelector<HTMLSelectElement>('#rev-causal')!;
    causal.selectedIndex = 1;
    causal.dispatchEvent(new Event('change'));
    p.escribir('#rev-desc', 'La tarjeta fue usada por una persona distinta');
    archivo(p.el, '#rev-evidencia');
    const botones = [...p.el.querySelectorAll<HTMLFormElement>('dialog form')];
    botones[1]!.dispatchEvent(new Event('submit'));
    const r = p.ctrl.expectOne(`${URL}/beneficios/5/revocatorias`);
    expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
      causalId: 21,
      descripcion: 'La tarjeta fue usada por una persona distinta',
    });
    r.flush(revocatoria(), { status: 201, statusText: 'Creado' });
    await p.asentar();
    p.ctrl.expectOne(`${URL}/beneficios/5`).flush(expediente());
    await p.asentar();
  });

  it('sin permiso de gestionar solo se consulta', async () => {
    const p = await montar(expediente(), false);
    expect(p.el.querySelector('form')).toBeNull();
  });
});

describe('RevocatoriasPage', () => {
  const resumen = revocatoria();

  async function montar(r: Revocatoria) {
    const p = montarPantalla(RevocatoriasPage, { id: '3' }, GESTOR);
    p.ctrl.expectOne((x) => x.url === `${URL}/revocatorias`).flush({ items: [resumen], total: 1 });
    p.ctrl.expectOne(`${URL}/revocatorias/3`).flush(r);
    await p.asentar();
    return p;
  }

  it('abre la revocatoria de la ruta, con su línea de tiempo, y pide el traslado como siguiente paso', async () => {
    const p = await montar(revocatoria());
    const d = p.el.querySelector('dialog[open]')!;
    expect(d.textContent).toContain('Inicio: causal y evidencia');
    expect(d.textContent).toContain('reporte.pdf');
    expect(d.querySelector('#rev-traslado')).not.toBeNull();
    expect(d.querySelector('#rev-descargos')).toBeNull();
    expect(d.querySelector('#rev-acto')).toBeNull();
  });

  it('registra el traslado y pasa a la etapa de descargos', async () => {
    const p = await montar(revocatoria());
    [...p.el.querySelectorAll<HTMLButtonElement>('dialog .boton')]
      .find((b) => b.textContent?.includes('Registrar el traslado'))!
      .click();
    await p.asentar();
    p.ctrl.expectNone((r) => r.method === 'POST');
    p.escribir('#rev-traslado', 'El operador reportó usos incompatibles con su titular.');
    [...p.el.querySelectorAll<HTMLButtonElement>('dialog .boton')]
      .find((b) => b.textContent?.includes('Registrar el traslado'))!
      .click();
    const r = p.ctrl.expectOne(`${URL}/revocatorias/3/traslado`);
    expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
      texto: 'El operador reportó usos incompatibles con su titular.',
    });
    r.flush(revocatoria({ estado: 'EN_TRASLADO', venceDescargosAt: '2026-11-03T04:59:59Z' }));
    await p.asentar();
    p.ctrl.expectOne((x) => x.url === `${URL}/revocatorias`).flush({ items: [resumen], total: 1 });
    await p.asentar();
    const d = p.el.querySelector('dialog[open]')!;
    expect(d.textContent).toContain('Plazo para presentar descargos');
    expect(d.querySelector('#rev-descargos')).not.toBeNull();
    expect(d.querySelector('#rev-traslado')).toBeNull();
  });

  it('vencido el plazo se registra que no hubo descargos', async () => {
    const p = await montar(
      revocatoria({
        estado: 'EN_TRASLADO',
        puedeSinDescargos: true,
        venceDescargosAt: '2026-10-01T04:59:59Z',
      }),
    );
    [...p.el.querySelectorAll<HTMLButtonElement>('dialog .boton')]
      .find((b) => b.textContent?.includes('Registrar que no hubo descargos'))!
      .click();
    const r = p.ctrl.expectOne(`${URL}/revocatorias/3/descargos`);
    expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
      texto: '',
      sinDescargos: true,
    });
    r.flush(revocatoria({ estado: 'EN_TRASLADO', sinDescargos: true, puedeDecidir: true }));
    await p.asentar();
    p.ctrl.expectOne((x) => x.url === `${URL}/revocatorias`).flush({ items: [resumen], total: 1 });
    await p.asentar();
    expect(p.el.querySelector('#rev-acto')).not.toBeNull();
  });

  it('el acto exige número, motivación y archivo, y al revocar informa que el cupo quedó libre', async () => {
    const p = await montar(revocatoria({ estado: 'CON_DESCARGOS', puedeDecidir: true }));
    const decidir = () =>
      [...p.el.querySelectorAll<HTMLButtonElement>('dialog .boton')]
        .find((b) => b.textContent?.includes('Registrar el acto'))!
        .click();
    decidir();
    await p.asentar();
    p.ctrl.expectNone((r) => r.method === 'POST');
    expect(p.el.querySelector('dialog .aviso.error')?.textContent).toContain('acto administrativo');
    p.escribir('#rev-acto', 'RES-2026-001');
    p.escribir('#rev-motivacion', 'Se verificó el uso indebido de la tarjeta por un tercero.');
    archivo(p.el, '#rev-acto-archivo');
    decidir();
    const r = p.ctrl.expectOne(`${URL}/revocatorias/3/decision`);
    expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
      resultado: 'REVOCAR',
      motivacion: 'Se verificó el uso indebido de la tarjeta por un tercero.',
      numeroActo: 'RES-2026-001',
    });
    r.flush(revocatoria({ estado: 'DECIDIDA', resultado: 'REVOCADA' }));
    await p.asentar();
    p.ctrl.expectOne((x) => x.url === `${URL}/revocatorias`).flush({ items: [], total: 0 });
    await p.asentar();
    expect(p.el.querySelector('dialog .aviso.exito')?.textContent).toContain('cupo quedó libre');
  });

  it('muestra el error que devuelve la API', async () => {
    const p = await montar(revocatoria({ estado: 'CON_DESCARGOS', puedeDecidir: true }));
    p.escribir('#rev-acto', 'RES-1');
    p.escribir('#rev-motivacion', 'Se verificó el uso indebido de la tarjeta por un tercero.');
    archivo(p.el, '#rev-acto-archivo');
    [...p.el.querySelectorAll<HTMLButtonElement>('dialog .boton')]
      .find((b) => b.textContent?.includes('Registrar el acto'))!
      .click();
    p.ctrl
      .expectOne(`${URL}/revocatorias/3/decision`)
      .flush(
        errorApi(
          'ETAPAS_PENDIENTES',
          'No se puede decidir: falta agotar el traslado y los descargos.',
        ),
        { status: 409, statusText: 'Conflicto' },
      );
    await p.asentar();
    expect(p.el.querySelector('dialog .aviso.error')?.textContent).toContain('falta agotar');
  });
});

describe('AlertasCrucePage', () => {
  const alerta = (c: Partial<AlertaCruce> = {}): AlertaCruce => ({
    id: 4,
    cargaId: 1,
    estructura: 'Registro de defunciones',
    beneficioId: 5,
    radicado: 'EST-2026-000005',
    pcdNombre: 'María',
    causalCodigo: 'FALLECIMIENTO',
    detalle: 'La persona con discapacidad aparece en «Registro de defunciones»: 2026-09-30',
    estado: 'PENDIENTE',
    analizadaPor: null,
    analizadaAt: null,
    observacion: null,
    revocatoriaId: null,
    creadaAt: '2026-10-05T10:00:00Z',
    ...c,
  });

  async function montar(permisos = GESTOR) {
    const p = montarPantalla(AlertasCrucePage, {}, permisos);
    p.ctrl
      .expectOne((r) => r.url === `${URL}/alertas-cruce`)
      .flush({ items: [alerta()], total: 1 });
    await p.asentar();
    return p;
  }

  it('lista las alertas pendientes con lo que se encontró', async () => {
    const { el } = await montar();
    expect(el.querySelector('tbody')?.textContent).toContain(
      'aparece en «Registro de defunciones»',
    );
    expect(el.querySelector('tbody')?.textContent).toContain('Pendiente de análisis');
  });

  it('descarta con un análisis, sin tocar el beneficio', async () => {
    const p = await montar();
    p.el.querySelector<HTMLButtonElement>('tbody .enlace')!.click();
    await p.asentar();
    p.enviar('dialog form');
    await p.asentar();
    p.ctrl.expectNone((r) => r.method === 'POST');
    expect(p.el.querySelector('dialog .aviso.error')?.textContent).toContain('análisis');
    p.escribir('#alerta-obs', 'Es una homonimia: otra persona');
    p.enviar('dialog form');
    const r = p.ctrl.expectOne(`${URL}/alertas-cruce/4/analizar`);
    expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
      accion: 'DESCARTAR',
      observacion: 'Es una homonimia: otra persona',
    });
    r.flush(alerta({ estado: 'DESCARTADA' }));
    await p.asentar();
    p.ctrl.expectOne((x) => x.url === `${URL}/alertas-cruce`).flush({ items: [], total: 0 });
    await p.asentar();
    expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('el beneficio no cambió');
  });

  it('iniciar la revocatoria exige la evidencia', async () => {
    const p = await montar();
    p.el.querySelector<HTMLButtonElement>('tbody .enlace')!.click();
    await p.asentar();
    p.escribir('#alerta-accion', 'INICIAR_REVOCATORIA');
    p.escribir('#alerta-obs', 'Se verificó el registro civil');
    await p.asentar();
    p.enviar('dialog form');
    await p.asentar();
    p.ctrl.expectNone((r) => r.method === 'POST');
    expect(p.el.querySelector('dialog .aviso.error')?.textContent).toContain('evidencia');
    archivo(p.el, '#alerta-archivo');
    p.enviar('dialog form');
    expect(p.ctrl.expectOne(`${URL}/alertas-cruce/4/analizar`).request.method).toBe('POST');
  });

  it('sin permiso de gestionar no se puede analizar', async () => {
    const { el } = await montar(['novedades.ver']);
    expect(el.querySelector('tbody .enlace')).toBeNull();
  });
});
