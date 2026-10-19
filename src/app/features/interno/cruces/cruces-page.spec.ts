import { API_BASE } from '../../../core/api/api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { CrucesPage } from './cruces-page';
import { CargaCruce, EstructuraCruce } from './modelos-cruces';

const URL = `${API_BASE}/admin/cruces`;

const carga = (c: Partial<CargaCruce> = {}): CargaCruce => ({
  id: 5,
  archivoNombre: 'transmetro.csv',
  filasTotal: 10,
  filasValidas: 8,
  filasError: 2,
  vigente: true,
  cargadoPor: 'admin',
  cargadoAt: '2026-10-05T10:00:00Z',
  ...c,
});

const estructura = (c: Partial<EstructuraCruce> = {}): EstructuraCruce => ({
  id: 1,
  codigo: 'TRANSMETRO',
  nombre: 'Uso del sistema de transporte masivo',
  entidad: 'Transmetro',
  descripcion: '',
  columnaIdentificacion: 'IDENTIFICACION',
  columnaDetalle: 'ESTADO',
  aplicaA: 'PCD',
  activo: true,
  version: 1,
  vigente: null,
  ...c,
});

describe('CrucesPage', () => {
  async function montar(
    lista: EstructuraCruce[] = [
      estructura(),
      estructura({ id: 2, nombre: 'Defunciones', activo: false }),
    ],
  ) {
    const p = montarPantalla(CrucesPage, {}, ['cruces.administrar']);
    p.ctrl.expectOne(URL).flush({ items: lista });
    await p.asentar();
    return p;
  }

  it('lista los cruces con sus columnas, a quién buscan y la carga vigente', async () => {
    const { el } = await montar([
      estructura({ vigente: carga() }),
      estructura({ id: 2, nombre: 'Defunciones', activo: false }),
    ]);
    const filas = el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('Transmetro');
    expect(filas[0]?.textContent).toContain('Persona con discapacidad');
    expect(filas[0]?.textContent).toContain('8 registro(s)');
    expect(filas[0]?.textContent).toContain('2 fila(s) con errores');
    expect(filas[1]?.textContent).toContain('Sin archivo cargado');
    expect(filas[1]?.textContent).toContain('Inactivo');
  });

  it('crea un cruce y muestra en el campo el error de nombre repetido', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    escribir('#cruce-nombre', 'Defunciones');
    enviar();
    ctrl
      .expectOne(URL)
      .flush(
        errorApi('VALIDACION', 'Revise', [
          { campo: 'nombre', mensaje: 'Nombre: ya existe una estructura de cruce con ese nombre' },
        ]),
        { status: 422, statusText: 'No procesable' },
      );
    await asentar();
    expect(el.querySelector('#cruce-nombre-error')?.textContent).toContain('ya existe');
    escribir('#cruce-nombre', 'Subsidios del Distrito');
    enviar();
    const r = ctrl.expectOne(URL);
    expect(r.request.body).toMatchObject({
      nombre: 'Subsidios del Distrito',
      columnaIdentificacion: 'IDENTIFICACION',
      columnaDetalle: null,
      aplicaA: 'AMBOS',
    });
    r.flush(estructura({ id: 3 }), { status: 201, statusText: 'Creado' });
    await asentar();
    ctrl.expectOne(URL).flush({ items: [estructura()] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('Subsidios del Distrito');
  });

  it('activa y desactiva sin borrar', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>(
      'button[title="Desactivar Uso del sistema de transporte masivo"]',
    )!.click();
    ctrl.expectOne(`${URL}/1/desactivar`).flush(estructura({ activo: false }));
    await asentar();
    ctrl.expectOne(URL).flush({ items: [estructura({ activo: false })] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('desactivado');
  });

  it('carga un archivo CSV y avisa cuántas filas se cargaron y cuántas tenían errores', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>(
      'button[title="Cargar archivo de Uso del sistema de transporte masivo"]',
    )!.click();
    ctrl.expectOne(`${URL}/1/cargas`).flush({ items: [] });
    await asentar();
    // Sin elegir archivo no se llama a la API.
    [...el.querySelectorAll<HTMLButtonElement>('dialog[open] .boton')]
      .find((b) => b.textContent?.trim() === 'Cargar')!
      .click();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('dialog[open] .aviso.error')?.textContent).toContain('Seleccione');
    const input = el.querySelector<HTMLInputElement>('#cruce-archivo')!;
    const archivo = new File(['IDENTIFICACION\n12345678\n'], 'transmetro.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
    input.dispatchEvent(new Event('change'));
    [...el.querySelectorAll<HTMLButtonElement>('dialog[open] .boton')]
      .find((b) => b.textContent?.trim() === 'Cargar')!
      .click();
    const r = ctrl.expectOne(`${URL}/1/cargas`);
    expect(r.request.method).toBe('POST');
    expect((r.request.body as FormData).get('archivo')).toBeInstanceOf(File);
    r.flush(carga(), { status: 201, statusText: 'Creado' });
    await asentar();
    ctrl.expectOne(`${URL}/1/cargas`).flush({ items: [carga()] });
    await asentar();
    ctrl.expectOne(URL).flush({ items: [estructura({ vigente: carga() })] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('8 registro(s)');
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('2 fila(s) tenían errores');
    expect(el.querySelector('dialog[open]')?.textContent).toContain('Descargar 2 error(es)');
  });

  it('muestra el error del archivo que devuelve la API', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>(
      'button[title="Cargar archivo de Uso del sistema de transporte masivo"]',
    )!.click();
    ctrl.expectOne(`${URL}/1/cargas`).flush({ items: [] });
    await asentar();
    const input = el.querySelector<HTMLInputElement>('#cruce-archivo')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'malo.csv')],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    [...el.querySelectorAll<HTMLButtonElement>('dialog[open] .boton')]
      .find((b) => b.textContent?.trim() === 'Cargar')!
      .click();
    ctrl.expectOne(`${URL}/1/cargas`).flush(
      errorApi('VALIDACION', 'Revise', [
        {
          campo: 'archivo',
          mensaje: 'Archivo: el archivo no tiene la columna «IDENTIFICACION».',
        },
      ]),
      { status: 422, statusText: 'No procesable' },
    );
    await asentar();
    expect(el.querySelector('dialog[open] .aviso.error')?.textContent).toContain(
      'no tiene la columna',
    );
  });

  it('muestra el historial de versiones', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>(
      'button[title="Historial de Uso del sistema de transporte masivo"]',
    )!.click();
    ctrl.expectOne(`${URL}/1/versiones`).flush({
      items: [
        {
          version: 2,
          snapshot: { nombre: 'Transmetro', activo: true },
          usuario: 'admin',
          creadoAt: '2026-10-02T10:00:00Z',
        },
      ],
    });
    await asentar();
    expect(el.querySelector('dialog[open]')?.textContent).toContain('Versión 2');
  });
});
