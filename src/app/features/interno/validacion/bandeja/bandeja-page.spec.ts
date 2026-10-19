import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { Bandeja, FilaBandeja } from '../modelos-validacion';
import { BandejaPage } from './bandeja-page';

const fila = (c: Partial<FilaBandeja>): FilaBandeja => ({
  solicitudId: 1,
  radicado: 'EST-2026-000001',
  radicadaAt: '2026-10-01T15:00:00Z',
  estado: { codigo: 'RADICADA', nombre: 'Radicada' },
  pcdNombre: 'María Fernanda Pérez',
  dias: 2,
  superaTiempo: false,
  asignadoA: null,
  enRevisionPor: null,
  subsanado: false,
  ronda: 1,
  subsanacionVenceAt: null,
  subsanacionVencida: false,
  ...c,
});

const BANDEJA = (items: FilaBandeja[]): Bandeja => ({
  items,
  total: items.length,
  pagina: 1,
  tamano: 20,
  tiempoMaxDias: 5,
});

const URL_BANDEJA = (r: { url: string }) => r.url === `${API_BASE}/admin/validacion/bandeja`;

describe('BandejaPage', () => {
  async function montar(items: FilaBandeja[], permisos = ['validacion.ver', 'validacion.validar']) {
    const p = montarPantalla(BandejaPage, {}, permisos);
    if (permisos.includes('validacion.asignar')) {
      p.ctrl
        .expectOne(`${API_BASE}/admin/validacion/validadores`)
        .flush({ items: [{ id: 5, usuario: 'ana', nombres: 'Ana Gómez' }] });
    }
    p.ctrl.expectOne(URL_BANDEJA).flush(BANDEJA(items));
    await p.asentar();
    return p;
  }

  it('muestra radicado, fecha, nombre, estado y días transcurridos de cada caso', async () => {
    const { el } = await montar([
      fila({}),
      fila({
        solicitudId: 2,
        radicado: 'EST-2026-000002',
        estado: { codigo: 'SUBSANADA', nombre: 'Subsanada' },
        subsanado: true,
        dias: 3,
      }),
    ]);
    const filas = el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('EST-2026-000001');
    expect(filas[0]?.textContent).toContain('01/10/2026');
    expect(filas[0]?.textContent).toContain('María Fernanda Pérez');
    expect(filas[1]?.textContent).toContain('Subsanado');
    expect(filas[0]?.querySelector('a')?.getAttribute('href')).toBe('/interno/validacion/caso/1');
  });

  it('resalta los casos que superan el tiempo máximo de atención', async () => {
    const { el } = await montar([fila({ dias: 9, superaTiempo: true }), fila({ solicitudId: 2 })]);
    const filas = el.querySelectorAll('tbody tr');
    expect(filas[0]?.classList.contains('supera')).toBe(true);
    expect(filas[0]?.textContent).toContain('Supera 5');
    expect(filas[1]?.classList.contains('supera')).toBe(false);
  });

  it('muestra quién lo tiene asignado y quién lo está revisando, y el plazo vencido de una subsanación', async () => {
    const { el } = await montar([
      fila({
        asignadoA: { id: 5, nombre: 'Ana Gómez' },
        enRevisionPor: { id: 5, nombre: 'Ana Gómez' },
        estado: { codigo: 'EN_SUBSANACION', nombre: 'Por subsanar' },
        subsanacionVencida: true,
      }),
    ]);
    const texto = el.querySelector('tbody tr')!.textContent!;
    expect(texto).toContain('Ana Gómez');
    expect(texto).toContain('Plazo vencido');
  });

  it('filtra por estado, asignación y tiempo, y ordena por la columna elegida', async () => {
    const { el, ctrl, escribir, asentar } = await montar([fila({})]);
    escribir('#q', 'beltr');
    escribir('#estado', 'SUBSANADA');
    escribir('#asignado', 'mios');
    el.querySelector<HTMLInputElement>('input[formcontrolname="vencidas"]')!.click();
    el.querySelector<HTMLFormElement>('form[role="search"]')!.dispatchEvent(new Event('submit'));
    const r = ctrl.expectOne(URL_BANDEJA);
    expect(r.request.params.get('q')).toBe('beltr');
    expect(r.request.params.get('estado')).toBe('SUBSANADA');
    expect(r.request.params.get('asignado')).toBe('mios');
    expect(r.request.params.get('vencidas')).toBe('true');
    r.flush(BANDEJA([fila({})]));
    await asentar();
    el.querySelectorAll<HTMLButtonElement>('th .orden')[2]!.click(); // Persona con discapacidad
    const o = ctrl.expectOne(URL_BANDEJA);
    expect(o.request.params.get('orden')).toBe('nombre');
    expect(o.request.params.get('direccion')).toBe('asc');
    o.flush(BANDEJA([fila({})]));
    await asentar();
    expect(el.querySelectorAll('th')[2]?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('solo quien puede asignar ve las casillas y la barra de asignación', async () => {
    const sin = await montar([fila({})]);
    expect(sin.el.querySelector('tbody input[type="checkbox"]')).toBeNull();
  });

  it('el responsable del proceso marca casos y los asigna a un validador', async () => {
    const { el, ctrl, escribir, asentar } = await montar(
      [fila({}), fila({ solicitudId: 2, radicado: 'EST-2026-000002' })],
      ['validacion.ver', 'validacion.asignar'],
    );
    expect(el.querySelector('.barra-asignar')).toBeNull();
    el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')[0]!.click();
    el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')[1]!.click();
    await asentar();
    expect(el.querySelector('.barra-asignar')?.textContent).toContain('2 caso(s) marcado(s)');
    expect(el.querySelector<HTMLButtonElement>('.barra-asignar .boton')!.disabled).toBe(true);
    escribir('#validador', '5');
    await asentar();
    el.querySelector<HTMLButtonElement>('.barra-asignar .boton')!.click();
    const req = ctrl.expectOne(`${API_BASE}/admin/validacion/asignar`);
    expect(req.request.body).toEqual({ solicitudIds: [1, 2], validadorId: 5 });
    req.flush({ asignados: 2 });
    await asentar();
    ctrl.expectOne(URL_BANDEJA).flush(BANDEJA([fila({})]));
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('2 caso(s) asignado(s)');
  });

  it('muestra el error de la API', async () => {
    const p = montarPantalla(BandejaPage, {}, ['validacion.ver']);
    p.ctrl
      .expectOne(URL_BANDEJA)
      .flush(errorApi('SIN_PERMISO', 'No tiene permiso para esta acción'), {
        status: 403,
        statusText: 'Prohibido',
      });
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('No tiene permiso');
  });
});
