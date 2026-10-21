import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { ListasFiltro, Tablero } from '../modelos-seguimiento';
import { TableroPage } from './tablero-page';

const URL = `${API_BASE}/admin/tablero`;
const esTablero = (r: { url: string }) => r.url === URL;

const LISTAS: ListasFiltro = {
  vigencias: [
    { id: 2, anio: 2026, activa: true },
    { id: 1, anio: 2025, activa: false },
  ],
  localidades: [{ id: 10, nombre: 'Riomar' }],
  estados: [{ codigo: 'ASIGNADA', nombre: 'Asignada' }],
};

const tablero = (extra: Partial<Tablero> = {}): Tablero => ({
  vigenciaId: 2,
  vigencia: 2026,
  embudo: {
    preinscritos: 120,
    caracterizados: 100,
    validados: 80,
    rechazados: 10,
    priorizados: 70,
    asignados: 50,
    listaEspera: 20,
    activos: 40,
    entregas: 45,
  },
  novedades: { bloqueos: 3, levantamientos: 1, revocatorias: 2 },
  avance: { meta: 3000, asignadosVigentes: 50, porcentaje: 1.7 },
  presupuesto: {
    total: 50000000,
    comprometido: 25000000,
    disponible: 25000000,
    porcentaje: 50,
    cupos: 100,
  },
  tiemposPromedioDias: { validacion: 2.5, priorizacion: null, asignacion: 4, entrega: 1 },
  satisfaccion: 82.5,
  porLocalidad: [{ localidad: 'Riomar', solicitudes: 60, asignados: 30 }],
  ...extra,
});

describe('TableroPage', () => {
  async function montar(datos = tablero()) {
    const p = montarPantalla(TableroPage, {}, ['tablero.ver']);
    p.ctrl.expectOne(`${API_BASE}/admin/seguimiento/filtros`).flush(LISTAS);
    p.ctrl.expectOne(esTablero).flush(datos);
    await p.asentar();
    return p;
  }

  it('muestra cada etapa del proceso con su cantidad', async () => {
    const { el } = await montar();
    const por = (clave: string) =>
      el.querySelector(`[data-etapa="${clave}"] .valor`)?.textContent?.trim();
    expect(por('preinscritos')).toBe('120');
    expect(por('asignados')).toBe('50');
    expect(por('listaEspera')).toBe('20');
    expect(por('rechazados')).toBe('10');
    expect(el.querySelector('h2')?.textContent).toContain('vigencia 2026');
  });

  it('muestra el avance contra la meta y la ejecución presupuestal', async () => {
    const { el } = await montar();
    expect(el.textContent).toContain('50 de 3.000 beneficiarios');
    const barras = el.querySelectorAll<HTMLProgressElement>('progress');
    expect(barras[0]?.max).toBe(3000);
    expect(barras[1]?.value).toBe(25000000);
    expect(el.textContent).toContain('50 %');
  });

  it('muestra los tiempos promedio, la satisfacción y las localidades', async () => {
    const { el } = await montar();
    expect(el.textContent).toContain('2,5 días');
    expect(el.textContent).toContain('Sin datos');
    expect(el.textContent).toContain('82,5 de 100');
    expect(el.textContent).toContain('Riomar');
  });

  it('sin respuestas de encuesta no inventa la satisfacción', async () => {
    const { el } = await montar(tablero({ satisfaccion: null }));
    expect(el.textContent).toContain('Sin respuestas');
  });

  it('actualiza con los filtros elegidos', async () => {
    const { ctrl, escribir, enviar, asentar } = await montar();
    escribir('#vigencia', '1');
    escribir('#localidad', '10');
    escribir('#poblacion', 'CON_CUIDADOR');
    enviar('form[role="search"]');
    const r = ctrl.expectOne(esTablero);
    expect(r.request.params.get('vigenciaId')).toBe('1');
    expect(r.request.params.get('localidadId')).toBe('10');
    expect(r.request.params.get('poblacion')).toBe('CON_CUIDADOR');
    r.flush(tablero({ vigencia: 2025 }));
    await asentar();
  });

  it('muestra el error de la API', async () => {
    const p = montarPantalla(TableroPage, {}, ['tablero.ver']);
    p.ctrl.expectOne(`${API_BASE}/admin/seguimiento/filtros`).flush(LISTAS);
    p.ctrl.expectOne(esTablero).flush(errorApi('NO_ENCONTRADO', 'No hay vigencias configuradas'), {
      status: 404,
      statusText: 'No encontrado',
    });
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('vigencias');
  });
});
