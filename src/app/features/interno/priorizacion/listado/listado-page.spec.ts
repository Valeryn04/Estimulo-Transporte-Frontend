import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { FilaListado, Listado } from '../modelos-priorizacion';
import { ListadoPriorizadoPage } from './listado-page';
import { esperarTareas } from '../../../../testing/asentar';

const URL = `${API_BASE}/admin/priorizacion`;
const esListado = (r: { url: string }) => r.url === `${URL}/listado`;

const fila = (c: Partial<FilaListado> = {}): FilaListado => ({
  posicion: 1,
  solicitudId: 7,
  radicado: 'EST-2026-000007',
  radicadaAt: '2026-10-01T15:00:00Z',
  estado: 'PRIORIZADA',
  pcdNombre: 'María Fernanda Pérez',
  localidad: 'Riomar',
  transporte: 'Transmetro',
  conCuidador: true,
  puntaje: 90,
  ajuste: 0,
  puntajeFinal: 90,
  matrizVersion: 1,
  calculadoAt: '2026-10-02T10:00:00Z',
  criterioDesempate: null,
  excepcionPendiente: false,
  ...c,
});

const listado = (items: FilaListado[]): Listado => ({
  items,
  total: items.length,
  matrizVersion: 1,
  desempate: ['Mayor puntaje en «Dependencia funcional»', 'Fecha de radicación más antigua'],
  vigenciaId: 1,
});

const PERMISOS = ['priorizacion.ver', 'priorizacion.calcular', 'priorizacion.proponer'];

describe('ListadoPriorizadoPage', () => {
  async function montar(items: FilaListado[] = [fila()], permisos = PERMISOS) {
    const p = montarPantalla(ListadoPriorizadoPage, {}, permisos);
    p.ctrl.expectOne(`${URL}/filtros`).flush({
      localidades: [{ id: 3, nombre: 'Riomar' }],
      tiposTransporte: [{ id: 4, nombre: 'Transmetro' }],
    });
    p.ctrl.expectOne(esListado).flush(listado(items));
    await p.asentar();
    return p;
  }

  it('muestra la posición, el puntaje, los criterios de desempate y el aplicado a cada caso', async () => {
    const { el } = await montar([
      fila(),
      fila({
        posicion: 2,
        solicitudId: 8,
        radicado: 'EST-2026-000008',
        puntaje: 40,
        puntajeFinal: 60,
        ajuste: 20,
        criterioDesempate: 'Fecha de radicación más antigua',
        excepcionPendiente: true,
      }),
    ]);
    expect(el.querySelector('.matriz')?.textContent).toContain('versión 1');
    expect(el.querySelector('.matriz')?.textContent).toContain('Dependencia funcional');
    const filas = el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('EST-2026-000007');
    expect(filas[0]?.textContent).toContain('90');
    expect(filas[1]?.textContent).toContain('60');
    expect(filas[1]?.textContent).toContain('40 +20 ajuste aprobado');
    expect(filas[1]?.textContent).toContain('Fecha de radicación más antigua');
    expect(filas[1]?.textContent).toContain('Excepción pendiente');
    // Con una excepción pendiente no se propone otra.
    expect(filas[1]?.textContent).not.toContain('Proponer ajuste');
  });

  it('filtra por localidad, transporte, población y texto', async () => {
    const { el, ctrl, escribir, asentar } = await montar();
    escribir('#q', 'maria');
    escribir('#localidad', '3');
    escribir('#transporte', '4');
    escribir('#poblacion', 'CON_CUIDADOR');
    el.querySelector<HTMLFormElement>('form[role="search"]')!.dispatchEvent(new Event('submit'));
    const r = ctrl.expectOne(esListado);
    expect(r.request.params.get('q')).toBe('maria');
    expect(r.request.params.get('localidadId')).toBe('3');
    expect(r.request.params.get('transporteId')).toBe('4');
    expect(r.request.params.get('poblacion')).toBe('CON_CUIDADOR');
    r.flush(listado([fila()]));
    await asentar();
  });

  it('calcula los casos sin puntaje y avisa cuántos se calcularon y cuáles no', async () => {
    const { el, ctrl, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('.encabezado .boton')]
      .find((b) => b.textContent?.includes('Calcular casos'))!
      .click();
    await esperarTareas();
    const r = ctrl.expectOne(`${URL}/calcular`);
    expect(r.request.body).toEqual({ recalcular: false });
    r.flush({
      matrizVersion: 1,
      calculados: 4,
      sinCambio: 2,
      omitidos: [{ radicado: 'EST-2026-000009', motivo: 'Faltan datos: Grupo del SISBÉN IV' }],
    });
    await asentar();
    ctrl.expectOne(esListado).flush(listado([fila()]));
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('se calcularon 4 caso(s)');
    expect(el.querySelector('.aviso.error')?.textContent).toContain('EST-2026-000009');
  });

  it('el recálculo con la versión vigente pide confirmación antes de hacerlo', async () => {
    const { el, ctrl, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('.encabezado .boton')]
      .find((b) => b.textContent?.includes('Recalcular'))!
      .click();
    await asentar();
    ctrl.expectNone(`${URL}/calcular`);
    expect(el.querySelector('dialog[open]')?.textContent).toContain('dejan de aplicarse');
    [...el.querySelectorAll<HTMLButtonElement>('dialog[open] .boton')]
      .find((b) => b.textContent?.trim() === 'Recalcular')!
      .click();
    await esperarTareas();
    expect(ctrl.expectOne(`${URL}/calcular`).request.body).toEqual({ recalcular: true });
  });

  it('quien no calcula ni propone no ve esas acciones', async () => {
    const { el } = await montar([fila()], ['priorizacion.ver']);
    expect(el.querySelector('.encabezado .boton')).toBeNull();
    expect(el.querySelector('tbody')?.textContent).not.toContain('Proponer ajuste');
    expect(el.querySelector('tbody')?.textContent).toContain('Ver puntaje');
  });

  it('muestra cómo se obtuvo el puntaje: detalle por variable, versión y fecha', async () => {
    const { el, ctrl, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.includes('Ver puntaje'))!
      .click();
    await esperarTareas();
    ctrl.expectOne(`${URL}/casos/7`).flush({
      solicitud: { id: 7, radicado: 'EST-2026-000007', estado: 'PRIORIZADA', pcdNombre: 'María' },
      puntaje: 90,
      ajuste: 0,
      puntajeFinal: 90,
      calculos: [
        {
          id: 1,
          matrizVersion: 1,
          puntaje: 90,
          vigente: true,
          calculadoPor: null,
          calculadoAt: '2026-10-02T10:00:00Z',
          detalle: [
            {
              variable: 'DEPENDENCIA_FUNCIONAL',
              nombre: 'Dependencia funcional',
              valor: 'SEVERA',
              etiqueta: 'Severa',
              puntos: 25,
              peso: 1,
              aporte: 25,
            },
          ],
        },
      ],
      excepciones: [],
    });
    await asentar();
    const d = el.querySelector('dialog[open]')!;
    expect(d.textContent).toContain('Dependencia funcional');
    expect(d.textContent).toContain('Severa');
    expect(d.textContent).toContain('25 × 1');
    expect(d.textContent).toContain('Automático al validar');
  });

  it('propone un ajuste con justificación y evidencia', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.includes('Proponer ajuste'))!
      .click();
    await asentar();
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    escribir('#exc-ajuste', '15');
    escribir('#exc-justificacion', 'Situación de urgencia documentada por la Secretaría de Salud.');
    enviar();
    await asentar();
    // Falta la evidencia.
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('dialog[open] .aviso.error')?.textContent).toContain('evidencia');
    const input = el.querySelector<HTMLInputElement>('#exc-archivo')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF-1.4'], 'soporte.pdf', { type: 'application/pdf' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    enviar();
    const r = ctrl.expectOne(`${URL}/casos/7/excepciones`);
    const form = r.request.body as FormData;
    expect(form.get('ajuste')).toBe('15');
    expect(form.get('justificacion')).toContain('urgencia');
    expect(form.get('archivo')).toBeInstanceOf(File);
    r.flush({ id: 1 }, { status: 201, statusText: 'Creado' });
    await asentar();
    ctrl.expectOne(esListado).flush(listado([fila({ excepcionPendiente: true })]));
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('EST-2026-000007');
  });

  it('muestra el error de la API al proponer', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.includes('Proponer ajuste'))!
      .click();
    await asentar();
    escribir('#exc-ajuste', '15');
    escribir('#exc-justificacion', 'Situación de urgencia documentada por la Secretaría de Salud.');
    const input = el.querySelector<HTMLInputElement>('#exc-archivo')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'a.pdf')],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    enviar();
    ctrl
      .expectOne(`${URL}/casos/7/excepciones`)
      .flush(
        errorApi('EXCEPCION_ABIERTA', 'Este caso ya tiene una excepción pendiente de decisión.'),
        { status: 409, statusText: 'Conflicto' },
      );
    await asentar();
    expect(el.querySelector('dialog[open] .aviso.error')?.textContent).toContain('pendiente');
  });
});
