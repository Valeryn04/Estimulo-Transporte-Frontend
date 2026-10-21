import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import '../../../../testing/locale';
import { VigenciasPage } from './vigencias-page';

const vig = (c: object) => ({
  id: 1,
  anio: 2026,
  fechaInicio: '2026-01-01',
  fechaFin: '2026-12-31',
  cuposTotales: 3000,
  activa: true,
  version: 1,
  ...c,
});

describe('VigenciasPage', () => {
  async function montar() {
    const p = montarPantalla(VigenciasPage);
    p.ctrl.expectOne(`${API_BASE}/admin/vigencias`).flush({
      items: [
        vig({}),
        vig({
          id: 2,
          anio: 2025,
          fechaInicio: '2025-01-01',
          fechaFin: '2025-12-31',
          cuposTotales: 1500,
          activa: false,
        }),
      ],
    });
    await p.asentar();
    return p;
  }

  it('muestra las vigencias con fechas en formato día/mes/año, cupos y estado', async () => {
    const { el } = await montar();
    const filas = el.querySelectorAll('tbody tr');
    expect(filas[0]?.textContent).toContain('01/01/2026');
    expect(filas[0]?.textContent).toContain('31/12/2026');
    expect(filas[0]?.textContent).toContain('3.000');
    expect(filas[0]?.textContent).toContain('Activa');
    expect(filas[1]?.textContent).toContain('Inactiva');
  });

  it('solo ofrece activar las vigencias inactivas', async () => {
    const { el } = await montar();
    expect(el.querySelector('button[title="Activar la vigencia 2026"]')).toBeNull();
    expect(el.querySelector('button[title="Activar la vigencia 2025"]')).not.toBeNull();
  });

  it('una vigencia nueva propone el año siguiente y rechaza cupos negativos y fechas invertidas sin llamar a la API', async () => {
    const { el, ctrl, asentar, escribir, enviar } = await montar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    expect(el.querySelector<HTMLInputElement>('#vig-anio')!.value).toBe('2027');
    escribir('#vig-cupos', '-5');
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('#vig-cupos-error')?.textContent).toContain('mínimo');
    escribir('#vig-cupos', '100');
    escribir('#vig-fin', '2026-06-01');
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('#vig-fin-error')?.textContent).toContain('anterior a la inicial');
  });

  it('edita las fechas, deja los cupos de solo lectura y muestra el error de cruce de fechas que devuelve la API', async () => {
    const { el, ctrl, asentar, escribir, enviar } = await montar();
    el.querySelector<HTMLButtonElement>('button[title="Editar la vigencia 2026"]')!.click();
    await asentar();
    expect(el.querySelector<HTMLInputElement>('#vig-anio')!.disabled).toBe(true);
    // Los cupos de una vigencia existente no se cambian aquí: se modifican con su soporte en «Cupos y presupuesto».
    expect(el.querySelector<HTMLInputElement>('#vig-cupos')!.disabled).toBe(true);
    escribir('#vig-fin', '2026-11-30');
    enviar();
    const req = ctrl.expectOne(`${API_BASE}/admin/vigencias/1`);
    expect(req.request.body).toEqual({
      fechaInicio: '2026-01-01',
      fechaFin: '2026-11-30',
      cuposTotales: 3000,
    });
    req.flush(
      errorApi('VALIDACION', 'Revise', [
        { campo: 'fechaInicio', mensaje: 'Fechas: se cruzan con la vigencia 2025' },
      ]),
      {
        status: 422,
        statusText: 'Inválido',
      },
    );
    await asentar();
    expect(el.querySelector('#vig-inicio-error')?.textContent).toContain('se cruzan');
  });
});
