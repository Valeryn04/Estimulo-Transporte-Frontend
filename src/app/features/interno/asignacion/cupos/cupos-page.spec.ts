import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { esperarTareas } from '../../../../testing/asentar';
import { AjusteCupos, CuposConCatalogos } from '../modelos-asignacion';
import { CuposPage } from './cupos-page';

const URL = `${API_BASE}/admin/asignacion/cupos`;

const datos = (c: Partial<CuposConCatalogos> = {}): CuposConCatalogos => ({
  vigencia: { id: 1, anio: 2026, activa: true },
  cupos: { totales: 3, ocupados: 1, liberados: 0, disponibles: 2 },
  valorEstimulo: 500_000,
  presupuesto: { total: 2_500_000, comprometido: 1_000_000, disponible: 1_500_000 },
  distribucion: {
    localidades: [{ tipo: 'LOCALIDAD', itemId: 3, nombre: 'Riomar', cupos: 2, ocupados: 1 }],
    transportes: [],
  },
  catalogos: {
    localidades: [
      { id: 3, nombre: 'Riomar' },
      { id: 4, nombre: 'Metropolitana' },
    ],
    tiposTransporte: [{ id: 8, nombre: 'Transmetro' }],
  },
  ...c,
});

const ajuste = (c: Partial<AjusteCupos> = {}): AjusteCupos => ({
  id: 1,
  tipo: 'CUPOS',
  valorAnterior: 0,
  valorNuevo: 3,
  motivo: 'Resolución de la vigencia 2026',
  soporte: { nombre: 'acto.pdf', tamanoBytes: 100 },
  creadoPor: 'responsable',
  creadoAt: '2026-10-05T10:00:00Z',
  ...c,
});

describe('CuposPage', () => {
  async function montar(permisos = ['asignacion.ver', 'cupos.administrar']) {
    const p = montarPantalla(CuposPage, {}, permisos);
    p.ctrl.expectOne(URL).flush(datos());
    p.ctrl.expectOne(`${URL}/ajustes`).flush({ items: [ajuste()] });
    await p.asentar();
    return p;
  }

  const archivo = (el: HTMLElement) => {
    const input = el.querySelector<HTMLInputElement>('#cupos-soporte')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF-1.4'], 'acto.pdf', { type: 'application/pdf' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
  };

  it('muestra los cupos y el presupuesto en línea, la distribución y el historial con su soporte', async () => {
    const { el } = await montar();
    const t = el.textContent!;
    expect(t).toContain('2 disponibles de 3');
    expect(t).toContain('Ocupados: 1');
    expect(t).toContain('1.500.000');
    expect(t).toContain('Comprometido');
    expect(el.querySelector('section[aria-labelledby="t-dist"]')?.textContent).toContain('Riomar');
    const fila = el.querySelector('section[aria-labelledby="t-hist"] tbody tr')!;
    expect(fila.textContent).toContain('Cupos totales');
    expect(fila.textContent).toContain('0 → 3');
    expect(fila.textContent).toContain('Resolución de la vigencia 2026');
    expect(fila.textContent).toContain('acto.pdf');
  });

  it('sin permiso de administrar solo se consulta', async () => {
    const { el } = await montar(['asignacion.ver']);
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('section[aria-labelledby="t-hist"]')).not.toBeNull();
  });

  it('un cambio de cupos o presupuesto exige motivo y soporte antes de llamar a la API', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    escribir('#cupos-totales', '5');
    enviar('section form');
    await asentar();
    ctrl.expectNone((r) => r.method === 'PUT');
    expect(el.querySelector('#cupos-motivo-error')?.textContent).toBeTruthy();
    escribir('#cupos-motivo', 'Adición presupuestal de la vigencia');
    enviar('section form');
    await asentar();
    ctrl.expectNone((r) => r.method === 'PUT');
    expect(el.querySelector('.aviso.error')?.textContent).toContain('Soporte: adjunte');
  });

  it('sin ningún cambio no llama a la API', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    escribir('#cupos-motivo', 'No cambia nada de nada');
    enviar('section form');
    await asentar();
    ctrl.expectNone((r) => r.method === 'PUT');
    expect(el.querySelector('.aviso.error')?.textContent).toContain('No hay ningún cambio');
  });

  it('registra el cambio con su motivo y soporte y actualiza el resumen y el historial', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    escribir('#cupos-totales', '5');
    escribir('#cupos-presupuesto', '4000000');
    escribir('#cupos-motivo', 'Adición presupuestal de la vigencia');
    archivo(el);
    enviar('section form');
    await esperarTareas();
    const r = ctrl.expectOne(URL);
    expect(r.request.method).toBe('PUT');
    const form = r.request.body as FormData;
    expect(JSON.parse(form.get('datos') as string)).toEqual({
      motivo: 'Adición presupuestal de la vigencia',
      cuposTotales: 5,
      presupuestoTotal: 4_000_000,
    });
    expect(form.get('archivo')).toBeInstanceOf(File);
    r.flush(
      datos({
        cupos: { totales: 5, ocupados: 1, liberados: 0, disponibles: 4 },
        presupuesto: { total: 4_000_000, comprometido: 1_000_000, disponible: 3_000_000 },
      }),
    );
    await asentar();
    ctrl.expectOne(`${URL}/ajustes`).flush({
      items: [
        ajuste({ id: 2, tipo: 'PRESUPUESTO', valorAnterior: 2500000, valorNuevo: 4000000 }),
        ajuste(),
      ],
    });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('motivo');
    expect(el.textContent).toContain('4 disponibles de 5');
    expect(el.querySelectorAll('section[aria-labelledby="t-hist"] tbody tr')).toHaveLength(2);
  });

  it('envía la distribución por localidad que se arma en el formulario', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('fieldset.distribucion button.boton')]
      .find((b) => b.textContent?.includes('Agregar localidad'))!
      .click();
    await asentar();
    // Con [ngValue] la opción se elige por su posición: 0 es «Elija…», 1 Riomar y 2 Metropolitana.
    const loc = el.querySelector<HTMLSelectElement>('#loc-1')!;
    loc.selectedIndex = 2;
    loc.dispatchEvent(new Event('change'));
    escribir('#loc-cupos-1', '1');
    escribir('#cupos-motivo', 'Distribución acordada con la Gerencia');
    await asentar();
    enviar('section form');
    await esperarTareas();
    const r = ctrl.expectOne(URL);
    expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
      motivo: 'Distribución acordada con la Gerencia',
      distribucionLocalidad: [
        { itemId: 3, cupos: 2 },
        { itemId: 4, cupos: 1 },
      ],
    });
    r.flush(datos());
    await asentar();
    ctrl.expectOne(`${URL}/ajustes`).flush({ items: [] });
  });

  it('muestra los errores que devuelve la API', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    escribir('#cupos-presupuesto', '3000000');
    escribir('#cupos-motivo', 'Ajuste del presupuesto solicitado');
    archivo(el);
    enviar('section form');
    await esperarTareas();
    ctrl.expectOne(URL).flush(
      errorApi('VALIDACION', 'Revise', [
        {
          campo: 'presupuestoTotal',
          mensaje: 'Presupuesto: el acto adjunto no corresponde a la vigencia',
        },
      ]),
      { status: 422, statusText: 'No procesable' },
    );
    await asentar();
    expect(el.querySelector('.aviso.error')?.textContent).toContain('no corresponde a la vigencia');
  });
});
