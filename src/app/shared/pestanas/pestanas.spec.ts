import { montarPantalla } from '../../testing/config';
import { Pestanas } from './pestanas';

describe('Pestanas de una sección', () => {
  it('muestra solo las pestañas que el rol puede ver', async () => {
    const p = montarPantalla(Pestanas, { seccion: 'novedades' }, ['novedades.ver']);
    await p.asentar();
    expect([...p.el.querySelectorAll('a')].map((a) => a.textContent?.trim())).toEqual([
      'Beneficios',
      'Revocatorias',
      'Alertas de cruce',
    ]);
  });

  it('incluye la pestaña de otra área solo con su permiso', async () => {
    const p = montarPantalla(Pestanas, { seccion: 'novedades' }, [
      'novedades.ver',
      'encuestas.resultados',
    ]);
    await p.asentar();
    expect(p.el.textContent).toContain('Encuestas');
  });

  it('con varias pestañas visibles dibuja la barra', async () => {
    const p = montarPantalla(Pestanas, { seccion: 'accesos' }, ['usuarios.administrar']);
    await p.asentar();
    expect(p.el.querySelectorAll('a')).toHaveLength(2);
  });

  it('si el rol ve una sola pestaña no dibuja la barra', async () => {
    const q = montarPantalla(Pestanas, { seccion: 'asignacion' }, ['cupos.administrar']);
    await q.asentar();
    expect(q.el.querySelector('nav')).toBeNull();
  });
});
