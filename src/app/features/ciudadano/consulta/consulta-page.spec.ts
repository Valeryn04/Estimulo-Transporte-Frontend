import { API_BASE } from '../../../core/api/api';
import { EstadoSolicitud } from '../../../core/publico/publico-api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { ConsultaPage } from './consulta-page';

const FORMULARIO = {
  abierta: true,
  anio: 2026,
  tiposIdentificacion: [
    { id: 1, codigo: 'CC', nombre: 'Cédula de Ciudadanía' },
    { id: 4, codigo: 'CE', nombre: 'Cédula de Extranjería' },
  ],
  localidades: [],
  barrios: [],
  autorizacion: null,
  formularioToken: 't',
};

const ESTADO: EstadoSolicitud = {
  vigencia: 2026,
  personaConDiscapacidad: 'Ana María Rodríguez',
  correo: 'r******@correo.com',
  fechaPreinscripcion: '2026-10-06T19:03:00Z',
  radicado: null,
  fechaRadicacion: null,
  etapa: 'Preinscripción',
  estado: { codigo: 'CORREO_VERIFICADO', nombre: 'Correo verificado' },
  explicacion: 'Su correo está verificado y la preinscripción quedó registrada.',
  siguientePaso: 'Ingrese al enlace que le enviamos por correo para completar la caracterización.',
  aviso: 'Importante: la preinscripción no equivale a la aprobación del beneficio.',
  comunicaciones: [
    {
      id: 2,
      nombre: 'Preinscripción exitosa',
      asunto: 'Preinscripción exitosa',
      enviadoAt: '2026-10-06T19:03:00Z',
      entrega: 'Enviado',
    },
    {
      id: 1,
      nombre: 'Verificación del correo',
      asunto: 'Verifique su correo',
      enviadoAt: '2026-10-06T19:00:00Z',
      entrega: 'Entregado',
    },
  ],
};

describe('ConsultaPage', () => {
  async function montar(token?: string) {
    const p = montarPantalla(ConsultaPage, token ? { token } : {});
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush(FORMULARIO);
    await p.asentar();
    const elegirTipo = (texto: string) => {
      const s = p.el.querySelector<HTMLSelectElement>('#co-tipo')!;
      s.value = [...s.options].find((o) => o.textContent!.includes(texto))!.value;
      s.dispatchEvent(new Event('change'));
    };
    return { ...p, elegirTipo };
  }

  it('al entrar no muestra ninguna información de solicitudes: pide la identificación', async () => {
    const { el, ctrl } = await montar();
    expect(el.querySelector('h1')?.textContent).toContain('Consultar el estado');
    expect(el.textContent).toContain('código de un solo uso');
    expect(el.querySelector('#co-numero')).not.toBeNull();
    ctrl.expectNone((r) => r.url.includes('/consulta/solicitud'));
  });

  it('exige el tipo y el número antes de pedir el código', async () => {
    const p = await montar();
    p.enviar('form');
    await p.asentar();
    p.ctrl.expectNone((r) => r.method === 'POST');
    expect(p.el.querySelector('#co-tipo-error')?.textContent).toContain('elija una opción');
    p.elegirTipo('CC');
    p.escribir('#co-numero', 'ABC');
    p.enviar('form');
    await p.asentar();
    expect(p.el.querySelector('#co-numero-error')?.textContent).toContain('cédula de ciudadanía');
  });

  it('pide el código con la identificación y pasa a escribirlo', async () => {
    const p = await montar();
    p.elegirTipo('CC');
    p.escribir('#co-numero', '1.045.678.901');
    p.enviar('form');
    const req = p.ctrl.expectOne(`${API_BASE}/publico/consulta/solicitar-codigo`);
    expect(req.request.body).toEqual({ tipoIdentificacionId: 1, numero: '1.045.678.901' });
    req.flush(
      {
        mensaje: 'Si existe una solicitud con esa identificación, enviamos un código a ese correo.',
      },
      { status: 202, statusText: 'Aceptado' },
    );
    await p.asentar();
    expect(p.el.querySelector('h1')?.textContent).toContain('Escriba el código');
    expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('Si existe una solicitud');
    expect(p.el.querySelector('#co-codigo')?.getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('valida el código y muestra la etapa, el estado, la explicación, el siguiente paso y las comunicaciones', async () => {
    const p = await montar();
    p.elegirTipo('CC');
    p.escribir('#co-numero', '1045678901');
    p.enviar('form');
    p.ctrl
      .expectOne(`${API_BASE}/publico/consulta/solicitar-codigo`)
      .flush({ mensaje: 'ok' }, { status: 202, statusText: 'Aceptado' });
    await p.asentar();
    p.escribir('#co-codigo', '123456');
    p.enviar('form');
    const v = p.ctrl.expectOne(`${API_BASE}/publico/consulta/verificar-codigo`);
    expect(v.request.body).toEqual({
      tipoIdentificacionId: 1,
      numero: '1045678901',
      codigo: '123456',
    });
    v.flush({ token: 'sesion-ciudadano', expiraEnMinutos: 30 });
    await p.asentar();
    const s = p.ctrl.expectOne(`${API_BASE}/publico/consulta/solicitud`);
    expect(s.request.headers.get('Authorization')).toBe('Bearer sesion-ciudadano');
    s.flush(ESTADO);
    await p.asentar();
    expect(p.el.querySelector('h1')?.textContent).toContain('Estado de su solicitud');
    expect(p.el.querySelector('#titulo-estado')?.textContent).toContain('Preinscripción');
    expect(p.el.querySelector('#titulo-estado')?.textContent).toContain('Correo verificado');
    expect(p.el.textContent).toContain('Su correo está verificado');
    expect(p.el.textContent).toContain('completar la caracterización');
    expect(p.el.textContent).toContain('no equivale a la aprobación');
    const filas = p.el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('Enviado');
    expect(filas[1]?.textContent).toContain('Entregado');
  });

  it('un código incorrecto muestra el error y deja volver a intentar sin mostrar datos', async () => {
    const p = await montar();
    p.elegirTipo('CC');
    p.escribir('#co-numero', '1045678901');
    p.enviar('form');
    p.ctrl
      .expectOne(`${API_BASE}/publico/consulta/solicitar-codigo`)
      .flush({ mensaje: 'ok' }, { status: 202, statusText: 'Aceptado' });
    await p.asentar();
    p.escribir('#co-codigo', '000000');
    p.enviar('form');
    p.ctrl
      .expectOne(`${API_BASE}/publico/consulta/verificar-codigo`)
      .flush(
        errorApi('CODIGO_INVALIDO', 'El código no es válido o ya venció. Solicite uno nuevo.'),
        { status: 401, statusText: 'No autorizado' },
      );
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('no es válido o ya venció');
    expect(p.el.querySelector('#co-codigo')).not.toBeNull();
    expect(p.el.querySelector('h1')?.textContent).not.toContain('Estado de su solicitud');
  });

  it('el código debe tener 6 dígitos antes de llamar a la API', async () => {
    const p = await montar();
    p.elegirTipo('CC');
    p.escribir('#co-numero', '1045678901');
    p.enviar('form');
    p.ctrl
      .expectOne(`${API_BASE}/publico/consulta/solicitar-codigo`)
      .flush({ mensaje: 'ok' }, { status: 202, statusText: 'Aceptado' });
    await p.asentar();
    p.escribir('#co-codigo', '12');
    p.enviar('form');
    await p.asentar();
    p.ctrl.expectNone(`${API_BASE}/publico/consulta/verificar-codigo`);
    expect(p.el.querySelector('#co-codigo-error')?.textContent).toContain('6 dígitos');
  });

  it('con el enlace seguro del correo entra directamente al estado', async () => {
    const p = montarPantalla(ConsultaPage, { token: 'enlace-seguro-del-correo-12345' });
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush(FORMULARIO);
    await p.asentar();
    const e = p.ctrl.expectOne(`${API_BASE}/publico/consulta/enlace`);
    expect(e.request.body).toEqual({ token: 'enlace-seguro-del-correo-12345' });
    e.flush({ token: 'sesion', expiraEnMinutos: 30 });
    await p.asentar();
    p.ctrl.expectOne(`${API_BASE}/publico/consulta/solicitud`).flush(ESTADO);
    await p.asentar();
    expect(p.el.querySelector('h1')?.textContent).toContain('Estado de su solicitud');
  });

  it('un enlace vencido explica cómo seguir y ofrece la identificación con código', async () => {
    const p = montarPantalla(ConsultaPage, { token: 'enlace-vencido-del-correo-12345' });
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush(FORMULARIO);
    await p.asentar();
    p.ctrl
      .expectOne(`${API_BASE}/publico/consulta/enlace`)
      .flush(
        errorApi(
          'ENLACE_VENCIDO',
          'El enlace venció. Ingrese con su documento y un código enviado a su correo.',
        ),
        { status: 401, statusText: 'No autorizado' },
      );
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('El enlace venció');
    expect(p.el.querySelector('#co-numero')).not.toBeNull();
  });

  it('con el correo verificado ofrece continuar con la caracterización', async () => {
    const p = montarPantalla(ConsultaPage, { token: 'enlace-seguro-del-correo-12345' });
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush(FORMULARIO);
    await p.asentar();
    p.ctrl
      .expectOne(`${API_BASE}/publico/consulta/enlace`)
      .flush({ token: 'sesion', expiraEnMinutos: 30 });
    await p.asentar();
    p.ctrl.expectOne(`${API_BASE}/publico/consulta/solicitud`).flush(ESTADO);
    await p.asentar();
    const enlace = p.el.querySelector<HTMLAnchorElement>('.acciones a.boton');
    expect(enlace?.textContent).toContain('Completar la caracterización');
    expect(enlace?.getAttribute('href')).toBe('/caracterizacion');
  });

  it('«Cerrar la consulta» borra el estado de la pantalla y vuelve al inicio', async () => {
    const p = montarPantalla(ConsultaPage, { token: 'enlace-seguro-del-correo-12345' });
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush(FORMULARIO);
    await p.asentar();
    p.ctrl
      .expectOne(`${API_BASE}/publico/consulta/enlace`)
      .flush({ token: 'sesion', expiraEnMinutos: 30 });
    await p.asentar();
    p.ctrl.expectOne(`${API_BASE}/publico/consulta/solicitud`).flush(ESTADO);
    await p.asentar();
    [...p.el.querySelectorAll<HTMLButtonElement>('.acciones button')]
      .find((b) => b.textContent!.includes('Cerrar la consulta'))!
      .click();
    await p.asentar();
    expect(p.el.textContent).not.toContain('Ana María Rodríguez');
    expect(p.el.querySelector('#co-numero')).not.toBeNull();
  });

  describe('consulta con el número de radicado (RF-PRE-05)', () => {
    it('permite cambiar a «Con mi número de radicado» y pide el código con él', async () => {
      const p = await montar();
      [...p.el.querySelectorAll<HTMLButtonElement>('.modo')]
        .find((b) => b.textContent!.includes('número de radicado'))!
        .click();
      await p.asentar();
      expect(p.el.querySelector('#co-tipo')).toBeNull();
      p.escribir('#co-radicado', 'est-2026-000123');
      p.enviar('form');
      const req = p.ctrl.expectOne(`${API_BASE}/publico/consulta/solicitar-codigo`);
      expect(req.request.body).toEqual({ radicado: 'EST-2026-000123' });
      req.flush({ mensaje: 'ok' }, { status: 202, statusText: 'Aceptado' });
      await p.asentar();
      p.escribir('#co-codigo', '123456');
      p.enviar('form');
      const v = p.ctrl.expectOne(`${API_BASE}/publico/consulta/verificar-codigo`);
      expect(v.request.body).toEqual({ radicado: 'EST-2026-000123', codigo: '123456' });
      v.flush({ token: 'sesion', expiraEnMinutos: 30 });
      await p.asentar();
      p.ctrl.expectOne(`${API_BASE}/publico/consulta/solicitud`).flush({
        ...ESTADO,
        radicado: 'EST-2026-000123',
        fechaRadicacion: '2026-10-07T02:30:00Z',
        etapa: 'Radicación',
        estado: { codigo: 'RADICADA', nombre: 'Radicada' },
      });
      await p.asentar();
      expect(p.el.textContent).toContain('EST-2026-000123');
      expect(p.el.textContent).toContain('06/10/2026 21:30');
      // Ya radicada, no se ofrece completar la caracterización.
      expect(p.el.querySelector('a[href="/caracterizacion"]')).toBeNull();
    });

    it('un radicado mal escrito explica cómo escribirlo y no llama al servidor', async () => {
      const p = await montar();
      [...p.el.querySelectorAll<HTMLButtonElement>('.modo')]
        .find((b) => b.textContent!.includes('número de radicado'))!
        .click();
      await p.asentar();
      p.escribir('#co-radicado', '12345');
      p.enviar('form');
      await p.asentar();
      p.ctrl.expectNone((r) => r.method === 'POST');
      expect(p.el.querySelector('#co-radicado-error')?.textContent).toContain('EST-2026-000123');
    });
  });
});
