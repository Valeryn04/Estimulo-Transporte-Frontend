import { API_BASE } from '../../../core/api/api';
import { montarPantalla } from '../../../testing/config';
import { ReenviarVerificacionPage } from './reenviar-verificacion-page';

const TIPOS = [
  { id: 1, codigo: 'CC', nombre: 'Cédula de Ciudadanía' },
  { id: 4, codigo: 'CE', nombre: 'Cédula de Extranjería' },
];

describe('ReenviarVerificacionPage', () => {
  async function montar() {
    const p = montarPantalla(ReenviarVerificacionPage);
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush({
      abierta: true,
      anio: 2026,
      tiposIdentificacion: TIPOS,
      localidades: [],
      barrios: [],
      autorizacion: null,
      formularioToken: 't',
    });
    await p.asentar();
    return p;
  }

  it('exige el tipo y el número de identificación antes de llamar a la API', async () => {
    const p = await montar();
    p.enviar('form');
    await p.asentar();
    p.ctrl.expectNone((r) => r.method === 'POST');
    expect(p.el.querySelector('#re-tipo-error')?.textContent).toContain('elija una opción');
    expect(p.el.querySelector('#re-numero-error')?.textContent).toContain('complete este dato');
  });

  it('envía la solicitud y muestra la respuesta, igual exista o no la preinscripción', async () => {
    const p = await montar();
    const s = p.el.querySelector<HTMLSelectElement>('#re-tipo')!;
    s.value = [...s.options].find((o) => o.textContent!.includes('CC'))!.value;
    s.dispatchEvent(new Event('change'));
    p.escribir('#re-numero', '1.234.567');
    p.enviar('form');
    const req = p.ctrl.expectOne(`${API_BASE}/publico/preinscripciones/reenviar-verificacion`);
    expect(req.request.body).toEqual({ tipoIdentificacionId: 1, numero: '1.234.567' });
    req.flush(
      {
        mensaje:
          'Si existe una preinscripción pendiente de verificación, enviamos de nuevo el enlace.',
      },
      { status: 202, statusText: 'Aceptado' },
    );
    await p.asentar();
    expect(p.el.querySelector('.aviso.exito')?.textContent).toContain(
      'Si existe una preinscripción',
    );
    expect(p.el.querySelector('form')).toBeNull();
  });
});
