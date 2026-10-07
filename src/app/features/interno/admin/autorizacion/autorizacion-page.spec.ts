import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import '../../../../testing/locale';
import { AutorizacionPage } from './autorizacion-page';

const TEXTO =
  'AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES. Ley 1581 de 2012. Datos sensibles de salud y discapacidad.';
const estado = (extra: object[] = []) => ({
  vigente: {
    version: 1 + extra.length,
    contenido: TEXTO,
    vigenteDesde: '2026-10-01T10:00:00Z',
    creadoPor: null,
  },
  versiones: [
    ...extra,
    { version: 1, contenido: TEXTO, vigenteDesde: '2026-10-01T10:00:00Z', creadoPor: null },
  ],
});

describe('AutorizacionPage', () => {
  async function montar() {
    const p = montarPantalla(AutorizacionPage);
    p.ctrl.expectOne(`${API_BASE}/admin/autorizacion`).flush(estado());
    await p.asentar();
    return p;
  }

  it('muestra el texto vigente y no permite publicar sin cambios', async () => {
    const { el } = await montar();
    expect(el.querySelector<HTMLTextAreaElement>('#autorizacion-texto')!.value).toContain(
      'Ley 1581 de 2012',
    );
    expect(el.querySelector('.version-actual')?.textContent).toContain('1');
    expect(el.querySelector<HTMLButtonElement>('form button[type="submit"]')!.disabled).toBe(true);
  });

  it('publicar con un cambio crea una versión nueva sin recargar la página', async () => {
    const { el, ctrl, asentar, escribir } = await montar();
    escribir('#autorizacion-texto', `${TEXTO} Cláusula adicional.`);
    await asentar();
    const submit = el.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
    expect(submit.disabled).toBe(false);
    const evento = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
    const req = ctrl.expectOne(`${API_BASE}/admin/autorizacion`);
    expect(req.request.body).toEqual({ contenido: `${TEXTO} Cláusula adicional.` });
    req.flush({ version: 2 }, { status: 201, statusText: 'Creado' });
    await asentar();
    ctrl.expectOne(`${API_BASE}/admin/autorizacion`).flush(
      estado([
        {
          version: 2,
          contenido: `${TEXTO} Cláusula adicional.`,
          vigenteDesde: '2026-10-02T10:00:00Z',
          creadoPor: 'admin',
        },
      ]),
    );
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('versión 2');
    expect(el.querySelectorAll('.versiones li')).toHaveLength(2);
  });

  it('rechaza un texto demasiado corto sin llamar a la API', async () => {
    const { el, ctrl, asentar, escribir } = await montar();
    escribir('#autorizacion-texto', 'corto');
    await asentar();
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('#autorizacion-texto-error')?.textContent).toContain('al menos 50');
  });

  it('muestra el error de la API cuando el texto es igual al vigente', async () => {
    const { el, ctrl, asentar, escribir } = await montar();
    escribir('#autorizacion-texto', `${TEXTO} `);
    await asentar();
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    ctrl
      .expectOne(`${API_BASE}/admin/autorizacion`)
      .flush(errorApi('SIN_CAMBIO', 'El texto es igual al de la versión vigente'), {
        status: 409,
        statusText: 'Conflicto',
      });
    await asentar();
    expect(el.querySelector('.aviso.error')?.textContent).toContain(
      'igual al de la versión vigente',
    );
  });

  it('permite consultar el texto de una versión anterior', async () => {
    const { el, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.versiones button')!.click();
    await asentar();
    expect(el.querySelector('.texto')?.textContent).toContain('Ley 1581');
  });
});
