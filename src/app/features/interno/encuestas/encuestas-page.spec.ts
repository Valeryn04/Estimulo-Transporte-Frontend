import { API_BASE } from '../../../core/api/api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { EncuestasPage } from './encuestas-page';
import { Encuesta, ResultadosEncuesta } from './modelos-encuestas';

const URL = `${API_BASE}/admin/encuestas`;

const encuesta = (c: Partial<Encuesta> = {}): Encuesta => ({
  id: 1,
  titulo: 'Satisfacción con el servicio',
  descripcion: '',
  estado: 'BORRADOR',
  vigenteDesde: '2026-10-01',
  vigenteHasta: '2026-10-31',
  creadaPor: 'admin',
  creadaAt: '2026-10-01T10:00:00Z',
  publicadaAt: null,
  cerradaAt: null,
  invitadas: 0,
  respondidas: 0,
  ...c,
});

const ADMIN = ['encuestas.administrar', 'encuestas.resultados'];

describe('EncuestasPage', () => {
  async function montar(lista: Encuesta[] = [encuesta()], permisos = ADMIN) {
    const p = montarPantalla(EncuestasPage, {}, permisos);
    p.ctrl.expectOne(URL).flush({ items: lista });
    await p.asentar();
    return p;
  }

  it('lista las encuestas con su estado y cuántas respondieron', async () => {
    const { el } = await montar([
      encuesta({ estado: 'PUBLICADA', invitadas: 20, respondidas: 7 }),
      encuesta({ id: 2, titulo: 'Otra' }),
    ]);
    const filas = el.querySelectorAll('tbody tr');
    expect(filas[0]?.textContent).toContain('Publicada');
    expect(filas[0]?.textContent).toContain('7 de 20');
    expect(filas[1]?.textContent).toContain('Borrador');
  });

  it('crea una encuesta con preguntas de selección, escala y texto', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    escribir('#enc-titulo', 'Satisfacción 2026');
    escribir('#p-texto-0', '¿Qué tan satisfecho está con el servicio?');
    [...el.querySelectorAll<HTMLButtonElement>('dialog button')]
      .find((b) => b.textContent?.includes('Agregar pregunta'))!
      .click();
    await asentar();
    escribir('#p-tipo-1', 'SELECCION');
    await asentar();
    escribir('#p-texto-1', '¿Con qué frecuencia usa la tarjeta?');
    escribir('#p-opciones-1', 'Todos los días\nUna vez por semana\n');
    enviar('dialog form');
    const r = ctrl.expectOne(URL);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toMatchObject({
      titulo: 'Satisfacción 2026',
      preguntas: [
        {
          tipo: 'ESCALA',
          texto: '¿Qué tan satisfecho está con el servicio?',
          obligatoria: true,
          opciones: null,
          escalaMax: 5,
        },
        { tipo: 'SELECCION', opciones: ['Todos los días', 'Una vez por semana'], escalaMax: null },
      ],
    });
    r.flush({ ...encuesta(), preguntas: [] }, { status: 201, statusText: 'Creado' });
    await asentar();
    ctrl.expectOne(URL).flush({ items: [encuesta()] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('borrador');
  });

  it('muestra los errores que devuelve la API al guardar', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    escribir('#enc-titulo', 'Satisfacción 2026');
    escribir('#p-texto-0', '¿Qué tan satisfecho está con el servicio?');
    enviar('dialog form');
    ctrl
      .expectOne(URL)
      .flush(
        errorApi('VALIDACION', 'Revise', [
          { campo: 'hasta', mensaje: 'Vigente hasta: no puede ser anterior a la fecha de inicio' },
        ]),
        { status: 422, statusText: 'No procesable' },
      );
    await asentar();
    expect(el.querySelector('dialog .aviso.error')?.textContent).toContain('Vigente hasta');
  });

  it('publica con confirmación y avisa a cuántos beneficiarios se invitó', async () => {
    const { el, ctrl, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.includes('Publicar'))!
      .click();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('dialog[open]')?.textContent).toContain(
      'ya no se podrán cambiar sus preguntas',
    );
    [...el.querySelectorAll<HTMLButtonElement>('dialog[open] .boton')]
      .find((b) => b.textContent?.includes('Publicar e invitar'))!
      .click();
    ctrl
      .expectOne(`${URL}/1/publicar`)
      .flush({ ...encuesta({ estado: 'PUBLICADA', invitadas: 12 }), invitadosAhora: 12 });
    await asentar();
    ctrl.expectOne(URL).flush({ items: [encuesta({ estado: 'PUBLICADA', invitadas: 12 })] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('12 beneficiario(s)');
  });

  it('cierra una encuesta publicada', async () => {
    const { el, ctrl, asentar } = await montar([encuesta({ estado: 'PUBLICADA' })]);
    [...el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.includes('Cerrar'))!
      .click();
    ctrl.expectOne(`${URL}/1/cerrar`).flush(encuesta({ estado: 'CERRADA' }));
    await asentar();
    ctrl.expectOne(URL).flush({ items: [encuesta({ estado: 'CERRADA' })] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('cerrada');
  });

  it('muestra los resultados anonimizados con la tasa y el indicador de satisfacción', async () => {
    const { el, ctrl, asentar } = await montar([
      encuesta({ estado: 'PUBLICADA', invitadas: 4, respondidas: 2 }),
    ]);
    [...el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.includes('Resultados'))!
      .click();
    const resultados: ResultadosEncuesta = {
      encuesta: encuesta({ estado: 'PUBLICADA' }),
      invitadas: 4,
      respondidas: 2,
      tasaRespuesta: 50,
      satisfaccion: 62.5,
      porLocalidad: [],
      preguntas: [
        {
          id: 1,
          tipo: 'ESCALA',
          texto: '¿Qué tan satisfecho está?',
          respondidas: 2,
          promedio: 3.5,
          conteo: [
            { valor: '3', cantidad: 1 },
            { valor: '4', cantidad: 1 },
          ],
        },
        { id: 2, tipo: 'TEXTO', texto: '¿Qué mejoraría?', respondidas: 1, textos: ['Más rutas'] },
      ],
    };
    ctrl.expectOne(`${URL}/1/resultados`).flush(resultados);
    await asentar();
    const d = el.querySelector('dialog[open]')!;
    expect(d.textContent).toContain('Tasa de respuesta: 50 %');
    expect(d.textContent).toContain('62,5');
    expect(d.textContent).toContain('Promedio: 3,5');
    expect(d.textContent).toContain('Más rutas');
    expect(d.textContent).toContain('no identifican');
  });

  it('quien solo ve resultados no crea ni publica', async () => {
    const { el } = await montar(
      [encuesta({ estado: 'PUBLICADA' }), encuesta({ id: 2 })],
      ['encuestas.resultados'],
    );
    expect(el.querySelector('.encabezado .boton')).toBeNull();
    expect(el.querySelector('tbody')?.textContent).not.toContain('Publicar');
    expect(el.querySelector('tbody')?.textContent).toContain('Resultados');
  });
});
