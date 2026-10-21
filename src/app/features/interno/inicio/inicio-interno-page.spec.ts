import { API_BASE } from '../../../core/api/api';
import { montarPantalla } from '../../../testing/config';
import { InicioInternoPage } from './inicio-interno-page';

describe('InicioInternoPage', () => {
  it('con permiso de tablero muestra solo el tablero de control', async () => {
    const { el, ctrl, asentar } = montarPantalla(InicioInternoPage, {}, ['tablero.ver']);
    await asentar();
    expect(el.querySelector('app-tablero-page')).not.toBeNull();
    expect(el.querySelector('.atajos, .avisos')).toBeNull();
    ctrl.expectOne(`${API_BASE}/admin/seguimiento/filtros`);
    ctrl.expectOne((r) => r.url === `${API_BASE}/admin/tablero`);
  });

  it('sin permiso de tablero no muestra nada más que el saludo', async () => {
    const { el, ctrl, asentar } = montarPantalla(InicioInternoPage, {}, ['validacion.ver']);
    await asentar();
    expect(el.querySelector('app-tablero-page')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Bienvenido');
    expect(el.querySelectorAll('a, section, .tarjeta')).toHaveLength(0);
    ctrl.expectNone((r) => r.url.includes('/admin/tablero'));
  });
});
