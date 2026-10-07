import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import '../../../../testing/locale';
import { PlantillasPage } from './plantillas-page';

describe('PlantillasPage', () => {
  it('lista las plantillas con su versión vigente y un enlace para editar cada una', async () => {
    const p = montarPantalla(PlantillasPage);
    p.ctrl.expectOne(`${API_BASE}/admin/plantillas`).flush({
      items: [
        {
          codigo: 'PREINSCRIPCION_EXITOSA',
          nombre: 'Preinscripción exitosa',
          descripcion: 'Al verificar el correo',
          version: 2,
          actualizadaAt: '2026-10-01T10:00:00Z',
        },
      ],
    });
    await p.asentar();
    const fila = p.el.querySelector('tbody tr')!;
    expect(fila.textContent).toContain('Preinscripción exitosa');
    expect(fila.textContent).toContain('2');
    expect(fila.querySelector('a')?.getAttribute('href')).toBe(
      '/interno/admin/plantillas/PREINSCRIPCION_EXITOSA',
    );
  });

  it('muestra el error si no se pueden cargar', async () => {
    const p = montarPantalla(PlantillasPage);
    p.ctrl
      .expectOne(`${API_BASE}/admin/plantillas`)
      .flush(errorApi('SIN_PERMISO', 'No tiene permiso para esta acción'), {
        status: 403,
        statusText: 'Prohibido',
      });
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('No tiene permiso');
  });
});
