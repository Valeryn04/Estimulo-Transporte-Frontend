import { API_BASE } from '../../../core/api/api';
import { RevocatoriaPersona } from '../../../core/publico/publico-api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { Descargos } from './descargos';

const URL = `${API_BASE}/publico/consulta`;

const revocatoria = (c: Partial<RevocatoriaPersona> = {}): RevocatoriaPersona => ({
  causal: 'Uso indebido de la tarjeta',
  estado: 'EN_TRASLADO',
  razones: 'El reporte indica que la tarjeta la usó otra persona.',
  venceDescargosAt: '2026-10-30T23:59:59-05:00',
  puedePresentarDescargos: true,
  presentoDescargos: false,
  ...c,
});

describe('Descargos del ciudadano (RF-BEN-04)', () => {
  async function montar(r: RevocatoriaPersona | null = revocatoria()) {
    const p = montarPantalla(Descargos, { token: 'sesion-abc' });
    const g = p.ctrl.expectOne(`${URL}/revocatoria`);
    expect(g.request.headers.get('Authorization')).toBe('Bearer sesion-abc');
    g.flush({ revocatoria: r });
    await p.asentar();
    return p;
  }

  it('no muestra nada si no hay trámite de revocatoria', async () => {
    const p = await montar(null);
    expect(p.el.querySelector('section')).toBeNull();
  });

  it('muestra las razones trasladadas y el plazo, y permite presentar descargos', async () => {
    const p = await montar();
    expect(p.el.textContent).toContain('Uso indebido de la tarjeta');
    expect(p.el.textContent).toContain('la usó otra persona');
    expect(p.el.querySelector('form')).not.toBeNull();
  });

  it('exige descargos de al menos 10 caracteres', async () => {
    const p = await montar();
    p.escribir('#descargos-texto', 'no');
    p.enviar('form');
    await p.asentar();
    p.ctrl.expectNone((r) => r.method === 'POST');
    expect(p.el.querySelector('.error')?.textContent).toContain('al menos 10');
  });

  it('envía los descargos con la prueba y confirma que se recibieron', async () => {
    const p = await montar();
    p.escribir('#descargos-texto', 'Yo no presté la tarjeta; la usó mi cuidador autorizado.');
    const input = p.el.querySelector<HTMLInputElement>('#descargos-archivo')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF-1.4'], 'prueba.pdf', { type: 'application/pdf' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    p.enviar('form');
    const r = p.ctrl.expectOne(`${URL}/descargos`);
    const cuerpo = r.request.body as FormData;
    expect(cuerpo.get('texto')).toBe('Yo no presté la tarjeta; la usó mi cuidador autorizado.');
    expect(cuerpo.get('archivo')).toBeInstanceOf(File);
    r.flush({ mensaje: 'Recibimos sus descargos.' }, { status: 201, statusText: 'Creado' });
    await p.asentar();
    p.ctrl.expectOne(`${URL}/revocatoria`).flush({
      revocatoria: revocatoria({
        estado: 'CON_DESCARGOS',
        puedePresentarDescargos: false,
        presentoDescargos: true,
      }),
    });
    await p.asentar();
    expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('Recibimos sus descargos');
    expect(p.el.querySelector('form')).toBeNull();
  });

  it('con el plazo vencido avisa que ya no se puede', async () => {
    const p = await montar(revocatoria({ puedePresentarDescargos: false }));
    expect(p.el.querySelector('form')).toBeNull();
    expect(p.el.textContent).toContain('El plazo para presentar descargos terminó');
  });

  it('muestra el error de la API', async () => {
    const p = await montar();
    p.escribir('#descargos-texto', 'Estos son mis descargos sobre el trámite.');
    p.enviar('form');
    p.ctrl
      .expectOne(`${URL}/descargos`)
      .flush(
        errorApi('SIN_TRASLADO', 'No hay un trámite de revocatoria esperando sus descargos.'),
        {
          status: 409,
          statusText: 'Conflicto',
        },
      );
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('No hay un trámite');
  });
});
