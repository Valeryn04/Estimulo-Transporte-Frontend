import { API_BASE } from '../../../core/api/api';
import { montarPantalla } from '../../../testing/config';
import { InicioInternoPage } from './inicio-interno-page';

const URL = `${API_BASE}/admin/alertas`;

describe('InicioInternoPage', () => {
  it('muestra los avisos pendientes del rol y deja marcarlos como atendidos', async () => {
    const { el, ctrl, asentar } = montarPantalla(InicioInternoPage, {}, [
      'asignacion.ver',
      'asignacion.asignar',
    ]);
    ctrl.expectOne(URL).flush({
      items: [
        {
          id: 7,
          tipo: 'CUPO_LIBERADO',
          titulo: 'Se liberó un cupo (EST-2026-000001)',
          mensaje: 'El siguiente caso en el orden de prioridad es EST-2026-000003.',
          enlace: '/interno/asignacion',
          solicitudId: 1,
          creadaAt: '2026-10-06T10:00:00Z',
        },
      ],
    });
    await asentar();
    const aviso = el.querySelector('.avisos .aviso')!;
    expect(aviso.textContent).toContain('Se liberó un cupo');
    expect(aviso.textContent).toContain('EST-2026-000003');
    expect(aviso.querySelector('a')?.getAttribute('href')).toBe('/interno/asignacion');
    aviso.querySelector<HTMLButtonElement>('button')!.click();
    ctrl.expectOne(`${URL}/7/atender`).flush(null, { status: 204, statusText: 'Sin contenido' });
    await asentar();
    expect(el.querySelector('.avisos')).toBeNull();
  });

  it('sin avisos no muestra la sección, y ofrece los atajos de lo que el rol puede hacer', async () => {
    const { el, ctrl, asentar } = montarPantalla(InicioInternoPage, {}, [
      'asignacion.ver',
      'priorizacion.ver',
    ]);
    ctrl.expectOne(URL).flush({ items: [] });
    await asentar();
    expect(el.querySelector('.avisos')).toBeNull();
    const enlaces = [...el.querySelectorAll('a.tarjeta')].map((a) => a.getAttribute('href'));
    expect(enlaces).toContain('/interno/asignacion');
    expect(enlaces).toContain('/interno/priorizacion');
    expect(enlaces).not.toContain('/interno/admin/usuarios');
  });

  it('si no se pueden consultar los avisos, la pantalla sigue funcionando', async () => {
    const { el, ctrl, asentar } = montarPantalla(InicioInternoPage, {}, []);
    ctrl.expectOne(URL).flush(null, { status: 500, statusText: 'Error' });
    await asentar();
    expect(el.querySelector('.avisos')).toBeNull();
  });
});
