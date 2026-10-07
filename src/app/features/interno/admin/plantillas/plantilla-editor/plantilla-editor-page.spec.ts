import { API_BASE } from '../../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../../testing/config';
import '../../../../../testing/locale';
import { PlantillaEditorPage } from './plantilla-editor-page';

const version = (n: number, cuerpo = 'Hola {{nombre}}. Radicado {{radicado}}.') => ({
  version: n,
  asunto: 'Solicitud {{radicado}} radicada',
  cuerpo,
  justificacion: null,
  creadoPor: n === 1 ? null : 'admin',
  creadoAt: '2026-10-01T10:00:00Z',
});

const plantilla = (versiones = [version(1)]) => ({
  codigo: 'CARACTERIZACION_RADICADA',
  nombre: 'Caracterización radicada',
  descripcion: 'Se envía al radicar la solicitud',
  variables: [
    { nombre: 'nombre', descripcion: 'Nombre de la persona', obligatoria: false },
    { nombre: 'radicado', descripcion: 'Número de radicado', obligatoria: true },
  ],
  vigente: versiones[0],
  versiones,
});

describe('PlantillaEditorPage', () => {
  async function montar() {
    const p = montarPantalla(PlantillaEditorPage, { codigo: 'CARACTERIZACION_RADICADA' });
    p.ctrl.expectOne(`${API_BASE}/admin/plantillas/CARACTERIZACION_RADICADA`).flush(plantilla());
    await p.asentar();
    return p;
  }

  it('carga la versión vigente en el editor y lista las variables, marcando las obligatorias', async () => {
    const { el } = await montar();
    expect(el.querySelector<HTMLInputElement>('#pl-asunto')!.value).toBe(
      'Solicitud {{radicado}} radicada',
    );
    expect(el.querySelector<HTMLTextAreaElement>('#pl-cuerpo')!.value).toContain('Hola {{nombre}}');
    const variables = [...el.querySelectorAll('.variables button')].map((b) =>
      b.textContent!.trim(),
    );
    expect(variables).toEqual(['{{nombre}}', '{{radicado}} *']);
  });

  it('el botón de una variable la inserta en el texto', async () => {
    const { el, asentar } = await montar();
    const antes = el.querySelector<HTMLTextAreaElement>('#pl-cuerpo')!.value;
    [...el.querySelectorAll<HTMLButtonElement>('.variables button')][0]!.click();
    await asentar();
    expect(el.querySelector<HTMLTextAreaElement>('#pl-cuerpo')!.value.length).toBe(
      antes.length + '{{nombre}}'.length,
    );
  });

  it('la vista previa se pide a la API y muestra el resultado y los problemas', async () => {
    const { el, ctrl, asentar } = await montar();
    [...el.querySelectorAll<HTMLButtonElement>('.acciones button')]
      .find((b) => b.textContent!.includes('Vista previa'))!
      .click();
    const req = ctrl.expectOne(
      `${API_BASE}/admin/plantillas/CARACTERIZACION_RADICADA/vista-previa`,
    );
    expect(req.request.body.asunto).toBe('Solicitud {{radicado}} radicada');
    req.flush({
      asunto: 'Solicitud EST-2026-000123 radicada',
      cuerpo: 'Hola María Pérez. Radicado EST-2026-000123.',
      variablesUsadas: ['nombre', 'radicado'],
      problemas: ['El texto debe incluir la variable obligatoria {{enlace_consulta}}'],
    });
    await asentar();
    expect(el.querySelector('.vista .asunto')?.textContent).toContain('EST-2026-000123');
    expect(el.querySelector('.vista .cuerpo')?.textContent).toContain('Hola María Pérez');
    expect(el.querySelector('.vista .aviso.advertencia')?.textContent).toContain(
      '{{enlace_consulta}}',
    );
  });

  it('guarda una versión nueva con el motivo y recarga las versiones', async () => {
    const { el, ctrl, asentar, escribir, fixture } = await montar();
    escribir('#pl-cuerpo', 'Hola {{nombre}}. Su radicado es {{radicado}}.');
    escribir('#pl-motivo', 'Ajuste de redacción');
    await asentar();
    el.querySelector<HTMLFormElement>('form.tarjeta')!.dispatchEvent(new Event('submit'));
    const req = ctrl.expectOne(`${API_BASE}/admin/plantillas/CARACTERIZACION_RADICADA/versiones`);
    expect(req.request.body.justificacion).toBe('Ajuste de redacción');
    req.flush({ version: 2 }, { status: 201, statusText: 'Creado' });
    await asentar();
    ctrl
      .expectOne(`${API_BASE}/admin/plantillas/CARACTERIZACION_RADICADA`)
      .flush(plantilla([version(2, 'Hola {{nombre}}. Su radicado es {{radicado}}.'), version(1)]));
    await asentar();
    expect(fixture.nativeElement.querySelector('.aviso.exito')?.textContent).toContain('versión 2');
    expect(el.querySelectorAll('.versiones li')).toHaveLength(2);
  });

  it('muestra los errores de validación de la API (variable obligatoria faltante)', async () => {
    const { el, ctrl, asentar, escribir } = await montar();
    escribir('#pl-cuerpo', 'Hola {{nombre}}, recibimos su solicitud completa.');
    await asentar();
    el.querySelector<HTMLFormElement>('form.tarjeta')!.dispatchEvent(new Event('submit'));
    ctrl.expectOne(`${API_BASE}/admin/plantillas/CARACTERIZACION_RADICADA/versiones`).flush(
      errorApi('VALIDACION', 'Revise', [
        {
          campo: 'cuerpo',
          mensaje: 'El texto debe incluir la variable obligatoria {{radicado}}',
        },
      ]),
      {
        status: 422,
        statusText: 'Inválido',
      },
    );
    await asentar();
    expect(el.querySelector('.aviso.error')?.textContent).toContain('{{radicado}}');
  });

  it('permite cargar una versión anterior en el editor', async () => {
    const p = montarPantalla(PlantillaEditorPage, { codigo: 'CARACTERIZACION_RADICADA' });
    p.ctrl
      .expectOne(`${API_BASE}/admin/plantillas/CARACTERIZACION_RADICADA`)
      .flush(plantilla([version(2, 'Texto nuevo con {{radicado}} y más palabras'), version(1)]));
    await p.asentar();
    p.el.querySelector<HTMLButtonElement>('.versiones li button')!.click();
    await p.asentar();
    expect(p.el.querySelector<HTMLTextAreaElement>('#pl-cuerpo')!.value).toBe(
      'Hola {{nombre}}. Radicado {{radicado}}.',
    );
  });

  it('actualiza la vista previa sola al dejar de escribir y no deja guardar si hay problemas', async () => {
    {
      const p = montarPantalla(PlantillaEditorPage, { codigo: 'CARACTERIZACION_RADICADA' });
      p.ctrl.expectOne(`${API_BASE}/admin/plantillas/CARACTERIZACION_RADICADA`).flush(plantilla());
      await p.asentar();
      p.escribir('#pl-cuerpo', 'Hola {{nombre}}, recibimos su solicitud completa.');
      await new Promise((r) => setTimeout(r, 900));
      p.ctrl.expectOne(`${API_BASE}/admin/plantillas/CARACTERIZACION_RADICADA/vista-previa`).flush({
        asunto: 'Solicitud EST-2026-000123 radicada',
        cuerpo: 'Hola María Pérez, recibimos su solicitud completa.',
        variablesUsadas: ['nombre'],
        problemas: ['El texto debe incluir la variable obligatoria {{radicado}}'],
      });
      await p.asentar();
      expect(p.el.querySelector('.vista .aviso.advertencia')?.textContent).toContain(
        '{{radicado}}',
      );
      expect(p.el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
      p.el.querySelector<HTMLFormElement>('form.tarjeta')!.dispatchEvent(new Event('submit'));
      p.ctrl.expectNone(`${API_BASE}/admin/plantillas/CARACTERIZACION_RADICADA/versiones`);
    }
  });
});
