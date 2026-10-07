import { API_BASE } from '../../../core/api/api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { VerificarCorreoPage } from './verificar-correo-page';

describe('VerificarCorreoPage', () => {
  async function montar(token: string | undefined) {
    const p = montarPantalla(VerificarCorreoPage, token ? { token } : {});
    return p;
  }
  const url = `${API_BASE}/publico/preinscripciones/verificar-correo`;

  it('verifica el correo con el token del enlace e informa el siguiente paso', async () => {
    const p = await montar('token-del-enlace-1234567890');
    const req = p.ctrl.expectOne(url);
    expect(req.request.body).toEqual({ token: 'token-del-enlace-1234567890' });
    req.flush({ estado: 'VERIFICADO' });
    await p.asentar();
    expect(p.el.querySelector('h1')?.textContent).toContain('Correo verificado');
    expect(p.el.textContent).toContain('no equivale a la aprobación');
  });

  it('si el correo ya estaba verificado lo dice sin alarmar', async () => {
    const p = await montar('token-del-enlace-1234567890');
    p.ctrl.expectOne(url).flush({ estado: 'YA_VERIFICADO' });
    await p.asentar();
    expect(p.el.querySelector('h1')?.textContent).toContain('ya estaba verificado');
  });

  it('un enlace vencido ofrece pedir uno nuevo', async () => {
    const p = await montar('token-del-enlace-1234567890');
    p.ctrl
      .expectOne(url)
      .flush(errorApi('ENLACE_VENCIDO', 'El enlace venció'), { status: 410, statusText: 'Gone' });
    await p.asentar();
    expect(p.el.querySelector('h1')?.textContent).toContain('venció');
    expect(p.el.querySelector('a.boton')?.getAttribute('href')).toBe('/reenviar-verificacion');
  });

  it('un enlace inválido o sin token no llama a la API de verificación inútilmente', async () => {
    const sinToken = await montar(undefined);
    sinToken.ctrl.expectNone(url);
    await sinToken.asentar();
    expect(sinToken.el.querySelector('h1')?.textContent).toContain('no es válido');
  });

  it('un fallo inesperado muestra el mensaje y pide reintentar', async () => {
    const p = await montar('token-del-enlace-1234567890');
    p.ctrl.expectOne(url).flush(errorApi('ERROR_INTERNO', 'Ocurrió un error inesperado.'), {
      status: 500,
      statusText: 'Error',
    });
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('error inesperado');
  });
});
