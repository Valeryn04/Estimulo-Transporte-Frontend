import { vi } from 'vitest';
import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { ListasFiltro, VistaReporte } from '../modelos-seguimiento';
import { ReportesPage } from './reportes-page';

const ADMIN = `${API_BASE}/admin`;
const esVista = (r: { url: string }) => r.url === `${ADMIN}/reportes/BENEFICIARIOS`;

const LISTAS: ListasFiltro = {
  vigencias: [{ id: 2, anio: 2026, activa: true }],
  localidades: [{ id: 10, nombre: 'Riomar' }],
  estados: [{ codigo: 'ASIGNADA', nombre: 'Asignada' }],
};

const VISTA: VistaReporte = {
  reporte: 'BENEFICIARIOS',
  nombre: 'Beneficiarios asignados',
  filtros: ['Vigencia: 2026', 'Localidad: Riomar'],
  total: 250,
  columnas: [
    { clave: 'radicado', titulo: 'Radicado' },
    { clave: 'nombre', titulo: 'Persona' },
  ],
  filas: [{ radicado: 'EST-2026-000001', nombre: 'Ana Pérez' }],
};

const EXPORTACION = {
  id: 1,
  usuario: 'control',
  reporte: 'BENEFICIARIOS',
  nombre: 'Beneficiarios asignados',
  formato: 'XLSX' as const,
  filas: 250,
  archivo: 'beneficiarios-2026-10-21.xlsx',
  sha256: 'a'.repeat(64),
  fecha: '2026-10-21T10:00:00Z',
};

describe('ReportesPage', () => {
  async function montar(permisos = ['reportes.ver', 'reportes.exportar']) {
    const p = montarPantalla(ReportesPage, {}, permisos);
    p.ctrl.expectOne(`${ADMIN}/reportes`).flush({
      items: [
        { codigo: 'BENEFICIARIOS', nombre: 'Beneficiarios asignados' },
        { codigo: 'ENTREGAS', nombre: 'Entregas de tarjeta' },
      ],
    });
    p.ctrl.expectOne(`${ADMIN}/seguimiento/filtros`).flush(LISTAS);
    if (permisos.includes('reportes.exportar')) {
      p.ctrl.expectOne(`${ADMIN}/reportes/exportaciones`).flush({ items: [EXPORTACION] });
    }
    await p.asentar();
    return p;
  }

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:prueba');
    URL.revokeObjectURL = vi.fn();
  });

  it('ofrece los reportes y el historial de exportaciones', async () => {
    const { el } = await montar();
    expect([...el.querySelectorAll('#reporte option')].map((o) => o.textContent)).toEqual([
      'Beneficiarios asignados',
      'Entregas de tarjeta',
    ]);
    expect(el.querySelector('#t-hist')?.textContent).toContain('Historial');
    expect(el.textContent).toContain('aaaaaaaaaaaaaaaa…');
  });

  it('muestra la vista previa con los filtros aplicados', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    escribir('#localidad', '10');
    escribir('#desde', '2026-10-01');
    enviar('form[aria-label="Filtros del reporte"]');
    const r = ctrl.expectOne(esVista);
    expect(r.request.params.get('localidadId')).toBe('10');
    expect(r.request.params.get('desde')).toBe('2026-10-01');
    expect(r.request.params.get('estado')).toBeNull();
    r.flush(VISTA);
    await asentar();
    expect(el.querySelector('#t-vista')?.textContent).toBe('Beneficiarios asignados');
    expect(el.querySelector('.filtros-aplicados')?.textContent).toContain('Localidad: Riomar');
    expect(el.textContent).toContain('250 fila(s)');
    expect(el.textContent).toContain('se muestran las primeras 1');
    expect(el.querySelector('tbody')?.textContent).toContain('Ana Pérez');
  });

  it('exporta a Excel, descarga el archivo y actualiza el historial', async () => {
    const { el, ctrl, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('.acciones button')]
      .find((b) => b.textContent?.includes('Excel'))!
      .click();
    const r = ctrl.expectOne((q) => q.url === `${ADMIN}/reportes/BENEFICIARIOS/exportar`);
    expect(r.request.params.get('formato')).toBe('XLSX');
    expect(r.request.responseType).toBe('blob');
    r.flush(new Blob(['x']));
    await asentar();
    ctrl.expectOne(`${ADMIN}/reportes/exportaciones`).flush({ items: [EXPORTACION, EXPORTACION] });
    await asentar();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('quedó registrada');
  });

  it('exporta a PDF', async () => {
    const { el, ctrl, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('.acciones button')]
      .find((b) => b.textContent?.includes('PDF'))!
      .click();
    const r = ctrl.expectOne((q) => q.url === `${ADMIN}/reportes/BENEFICIARIOS/exportar`);
    expect(r.request.params.get('formato')).toBe('PDF');
    r.flush(new Blob(['x']));
    await asentar();
    ctrl.expectOne(`${ADMIN}/reportes/exportaciones`).flush({ items: [] });
    await asentar();
  });

  it('quien solo consulta no ve exportar ni historial ni BI', async () => {
    const { el } = await montar(['reportes.ver']);
    expect([...el.querySelectorAll('.acciones button')].map((b) => b.textContent?.trim())).toEqual([
      'Ver reporte',
    ]);
    expect(el.querySelector('#t-hist')).toBeNull();
    expect(el.querySelector('#t-bi')).toBeNull();
  });

  it('con permiso de BI descarga los eventos en CSV', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar(['reportes.ver', 'bi.consultar']);
    expect(el.querySelector('#t-bi')).not.toBeNull();
    escribir('#bi-desde', '2026-10-01');
    enviar('form[aria-label="Eventos para BI"]');
    const r = ctrl.expectOne((q) => q.url === `${ADMIN}/bi/eventos`);
    expect(r.request.params.get('formato')).toBe('csv');
    expect(r.request.params.get('desde')).toBe('2026-10-01');
    r.flush(new Blob(['a;b']));
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('eventos-bi.csv');
  });

  it('muestra el error de la API al generar el reporte', async () => {
    const { el, ctrl, enviar, asentar } = await montar();
    enviar('form[aria-label="Filtros del reporte"]');
    ctrl.expectOne(esVista).flush(errorApi('VALIDACION', 'Hasta: use el formato AAAA-MM-DD'), {
      status: 422,
      statusText: 'No procesable',
    });
    await asentar();
    expect(el.querySelector('.aviso.error')?.textContent).toContain('Hasta');
  });
});
