import { API_BASE } from '../../../core/api/api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { EncuestaPage } from './encuesta-page';

const URL = `${API_BASE}/publico/encuesta`;
const esEncuesta = (r: { url: string }) => r.url === URL;

const ENCUESTA = {
  titulo: 'Satisfacción con el servicio',
  descripcion: 'Queremos conocer su experiencia',
  vigenteHasta: '2026-10-31',
  preguntas: [
    {
      id: 1,
      tipo: 'ESCALA',
      texto: '¿Qué tan satisfecho está?',
      obligatoria: true,
      opciones: null,
      escalaMax: 5,
    },
    {
      id: 2,
      tipo: 'SELECCION',
      texto: '¿Con qué frecuencia lo usa?',
      obligatoria: true,
      opciones: ['Diario', 'Semanal'],
      escalaMax: null,
    },
    {
      id: 3,
      tipo: 'TEXTO',
      texto: '¿Algún comentario?',
      obligatoria: false,
      opciones: null,
      escalaMax: null,
    },
  ],
};

describe('EncuestaPage', () => {
  async function montar(token = 't'.repeat(43)) {
    const p = montarPantalla(EncuestaPage, { token });
    p.ctrl.expectOne(esEncuesta).flush(ENCUESTA);
    await p.asentar();
    return p;
  }

  it('muestra la encuesta con la nota de que es anónima', async () => {
    const { el } = await montar();
    expect(el.querySelector('h1')?.textContent).toContain('Satisfacción con el servicio');
    expect(el.textContent).toContain('de forma anónima');
    expect(el.querySelectorAll('input[type="radio"]').length).toBe(7);
    expect(el.querySelector('textarea')).not.toBeNull();
  });

  it('sin enlace no hay encuesta', async () => {
    const p = montarPantalla(EncuestaPage, {});
    await p.asentar();
    p.ctrl.expectNone(esEncuesta);
    expect(p.el.querySelector('h1')?.textContent).toContain('El enlace no es válido');
  });

  it('marca las preguntas obligatorias sin responder y no envía', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelectorAll('fieldset.falta')).toHaveLength(2);
    expect(el.querySelector('.aviso.error')?.textContent).toContain('obligatorias');
  });

  it('envía las respuestas y agradece', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelectorAll<HTMLInputElement>('input[name="p-1"]')[3]!.click();
    el.querySelectorAll<HTMLInputElement>('input[name="p-2"]')[1]!.click();
    const texto = el.querySelector<HTMLTextAreaElement>('textarea')!;
    texto.value = 'Más rutas';
    texto.dispatchEvent(new Event('input'));
    await asentar();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const r = ctrl.expectOne(`${URL}/responder`);
    expect(r.request.body).toEqual({
      token: 't'.repeat(43),
      respuestas: { '1': 4, '2': 'Semanal', '3': 'Más rutas' },
    });
    r.flush({ mensaje: 'Gracias' }, { status: 201, statusText: 'Creado' });
    await asentar();
    expect(el.querySelector('h1')?.textContent).toContain('Gracias por su opinión');
  });

  it('si ya respondió o la encuesta se cerró lo explica', async () => {
    const a = montarPantalla(EncuestaPage, { token: 't'.repeat(43) });
    a.ctrl
      .expectOne(esEncuesta)
      .flush(errorApi('ENCUESTA_YA_RESPONDIDA', 'Ya respondió esta encuesta.'), {
        status: 409,
        statusText: 'Conflicto',
      });
    await a.asentar();
    expect(a.el.querySelector('h1')?.textContent).toContain('Ya respondió');
  });

  it('una encuesta cerrada no se puede responder', async () => {
    const p = montarPantalla(EncuestaPage, { token: 't'.repeat(43) });
    p.ctrl
      .expectOne(esEncuesta)
      .flush(errorApi('ENCUESTA_CERRADA', 'Esta encuesta ya no está disponible.'), {
        status: 409,
        statusText: 'Conflicto',
      });
    await p.asentar();
    expect(p.el.querySelector('h1')?.textContent).toContain('ya no está disponible');
  });
});
