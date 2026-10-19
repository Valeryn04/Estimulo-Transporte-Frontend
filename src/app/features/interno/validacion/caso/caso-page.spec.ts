import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { Caso, ItemCaso } from '../modelos-validacion';
import { CasoPage } from './caso-page';

const item = (c: Partial<ItemCaso>): ItemCaso => ({
  id: 10,
  requisitoId: 1,
  codigo: 'PCD_SISBEN',
  nombre: 'SISBÉN IV grupo A, B o C',
  descripcion: 'Está clasificada en SISBÉN IV.',
  aplicaA: 'PCD',
  fuenteSugerida: 'Consulta del SISBÉN IV',
  documentoId: 4,
  campos: [],
  cruceCodigo: null,
  resultado: 'PENDIENTE',
  fuente: '',
  observacion: '',
  evidencia: '',
  registradoPor: null,
  registradoAt: null,
  version: 1,
  subsanable: true,
  ...c,
});

const caso = (c: Partial<Caso> = {}, items: ItemCaso[] = [item({})]): Caso => ({
  solicitud: {
    id: 7,
    radicado: 'EST-2026-000007',
    radicadaAt: '2026-10-01T15:00:00Z',
    vigencia: 2026,
    estado: { codigo: 'EN_REVISION', nombre: 'En revisión' },
    dias: 2,
    superaTiempo: false,
    correo: 'familia@correo.com',
    direccion: 'Calle 72 # 54 - 30',
    localidad: 'Riomar',
    barrio: 'Altamira',
  },
  pcd: { id: 1, nombre: 'María Fernanda Pérez', tipo: 'CC', numero: '1045678901' },
  cuidador: { id: 2, nombre: 'Carlos López', tipo: 'CC', numero: '1045678902' },
  validacion: {
    asignadoA: null,
    enRevisionPor: 'Funcionario uno',
    tomadaAt: '2026-10-02T10:00:00Z',
    ronda: 1,
    subsanado: false,
    puedeEditar: true,
    subsanacionesPrevias: 0,
    maxRondas: 2,
  },
  datos: { generoId: 7, celular: '3001234567', epsId: 9, recibeSubsidios: false },
  catalogos: { '7': 'Femenino', '9': 'Sanitas' },
  sensiblesOcultos: false,
  alertas: [],
  priorizacion: { matrizVersion: 1, variables: [], puntaje: null },
  version: 3,
  documentos: [
    {
      id: 4,
      nombre: 'Soporte SISBÉN IV',
      aplicaA: 'PCD',
      obligatorio: true,
      estado: 'CARGADO',
      reemplazos: 1,
      archivo: {
        nombre: 'sisben.pdf',
        formato: 'pdf',
        tamanoBytes: 1000,
        sha256: 'a'.repeat(64),
        cargadoAt: '2026-10-01T14:00:00Z',
      },
      puedeVer: true,
    },
  ],
  items,
  decisiones: [],
  subsanacion: null,
  ...c,
});

const PERMISOS = ['validacion.ver', 'validacion.validar'];
const URL_CASO = `${API_BASE}/admin/validacion/casos/7`;

describe('CasoPage', () => {
  async function montar(abierto: Caso = caso(), permisos = PERMISOS) {
    const p = montarPantalla(CasoPage, { id: '7' }, permisos);
    p.ctrl.expectOne(`${URL_CASO}/tomar`).flush(abierto);
    await p.asentar();
    return p;
  }

  it('al abrirlo lo toma para revisarlo y muestra el solicitante, los datos, los documentos y la lista de chequeo', async () => {
    const { el } = await montar();
    expect(el.querySelector('h1')?.textContent).toContain('EST-2026-000007');
    expect(el.textContent).toContain('María Fernanda Pérez');
    expect(el.textContent).toContain('Carlos López');
    expect(el.textContent).toContain('Calle 72 # 54 - 30');
    // Los datos de lista salen con su nombre, no con su número.
    expect(el.textContent).toContain('Femenino');
    expect(el.textContent).toContain('Sanitas');
    expect(el.querySelector('.documentos')?.textContent).toContain('sisben.pdf');
    expect(el.querySelector('.documentos')?.textContent).toContain('1 versión(es) anterior(es)');
    expect(el.querySelector('fieldset.requisito legend')?.textContent).toContain('SISBÉN IV');
    expect(el.querySelectorAll('fieldset.requisito input[type="radio"]')).toHaveLength(4);
  });

  it('si otra persona lo está revisando, lo muestra en solo lectura con el aviso', async () => {
    const p = montarPantalla(CasoPage, { id: '7' }, PERMISOS);
    p.ctrl
      .expectOne(`${URL_CASO}/tomar`)
      .flush(errorApi('CASO_EN_REVISION', 'El caso lo está revisando Ana Gómez.'), {
        status: 409,
        statusText: 'Conflicto',
      });
    await p.asentar();
    p.ctrl.expectOne(URL_CASO).flush(
      caso({
        validacion: {
          asignadoA: null,
          enRevisionPor: 'Ana Gómez',
          tomadaAt: null,
          ronda: 1,
          subsanado: false,
          puedeEditar: false,
          subsanacionesPrevias: 0,
          maxRondas: 2,
        },
      }),
    );
    await p.asentar();
    expect(p.el.querySelector('.aviso')?.textContent).toContain('lo está revisando Ana Gómez');
    expect(p.el.querySelector('fieldset.requisito')?.hasAttribute('disabled')).toBe(true);
    expect(p.el.querySelector('#motivacion')).toBeNull();
  });

  it('quien no valida solo consulta el caso: no lo toma ni ve la decisión', async () => {
    const p = montarPantalla(CasoPage, { id: '7' }, ['validacion.ver']);
    p.ctrl.expectNone(`${URL_CASO}/tomar`);
    p.ctrl.expectOne(URL_CASO).flush(
      caso({
        validacion: {
          asignadoA: null,
          enRevisionPor: null,
          tomadaAt: null,
          ronda: 1,
          subsanado: false,
          puedeEditar: false,
          subsanacionesPrevias: 0,
          maxRondas: 2,
        },
      }),
    );
    await p.asentar();
    expect(p.el.querySelector('#motivacion')).toBeNull();
    expect(p.el.querySelector('fieldset.requisito')?.hasAttribute('disabled')).toBe(true);
  });

  it('los datos sensibles salen ocultos y sin botón para abrir los documentos cuando el rol no tiene permiso', async () => {
    const { el } = await montar(
      caso({
        sensiblesOcultos: true,
        datos: { celular: '3001234567', epsId: null },
        documentos: [{ ...caso().documentos[0]!, puedeVer: false }],
      }),
    );
    expect(el.textContent).toContain('Dato sensible (oculto para su rol)');
    expect(el.textContent).toContain('no tiene acceso a los datos sensibles');
    expect(el.querySelector('.documentos button')).toBeNull();
  });

  it('cada cambio en un requisito se guarda y avisa que quedó guardado', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelectorAll<HTMLInputElement>('.requisito input[type="radio"]')[0]!.click();
    const req = ctrl.expectOne(`${URL_CASO}/items/10`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      resultado: 'CUMPLE',
      fuente: '',
      observacion: '',
      evidencia: '',
    });
    req.flush(item({ resultado: 'CUMPLE', registradoPor: 'func' }));
    await asentar();
    expect(el.querySelector('.estado-guardado')?.textContent).toContain('Guardado');
    expect(el.textContent).toContain('1 cumple');
  });

  it('la fuente sugerida se puede usar con un clic', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.requisito .enlace[type="button"]:not(.vinculo button)')!;
    const usar = [...el.querySelectorAll<HTMLButtonElement>('.requisito button.enlace')].find((b) =>
      b.textContent!.includes('Usar'),
    )!;
    usar.click();
    const req = ctrl.expectOne(`${URL_CASO}/items/10`);
    expect(req.request.body.fuente).toBe('Consulta del SISBÉN IV');
    req.flush(item({ fuente: 'Consulta del SISBÉN IV' }));
    await asentar();
  });

  it('muestra el error que devuelve la API al guardar un requisito', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelectorAll<HTMLInputElement>('.requisito input[type="radio"]')[0]!.click();
    ctrl
      .expectOne(`${URL_CASO}/items/10`)
      .flush(
        errorApi('CASO_NO_TOMADO', 'Abra el caso para revisarlo antes de registrar resultados.'),
        {
          status: 409,
          statusText: 'Conflicto',
        },
      );
    await asentar();
    expect(el.querySelector('.requisito .aviso.error')?.textContent).toContain('Abra el caso');
  });

  describe('decisión', () => {
    it('hay que elegir una decisión antes de confirmar', async () => {
      const { el, ctrl, asentar } = await montar();
      el.querySelector<HTMLButtonElement>(
        '#t-decision ~ form button[type="submit"], form button[type="submit"]',
      )!.click();
      await asentar();
      expect(el.querySelector('.aviso.error')?.textContent).toContain('Elija una decisión');
      ctrl.expectNone((r) => r.url.endsWith('/decision'));
    });

    it('pide confirmación y registra la decisión; luego muestra el resultado', async () => {
      const { el, ctrl, escribir, asentar } = await montar(
        caso({}, [item({ resultado: 'CUMPLE', fuente: 'SISBÉN' })]),
      );
      el.querySelectorAll<HTMLInputElement>('.opciones-decision input')[0]!.click();
      escribir('#motivacion', 'Todo en orden');
      await asentar();
      el.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
      await asentar();
      expect(el.querySelector('dialog[open]')?.textContent).toContain('Aprobar la validación');
      ctrl.expectNone((r) => r.url.endsWith('/decision'));
      el.querySelector<HTMLButtonElement>('dialog[open] .boton:not(.secundario)')!.click();
      const req = ctrl.expectOne(`${URL_CASO}/decision`);
      expect(req.request.body).toEqual({ decision: 'APROBAR', motivacion: 'Todo en orden' });
      req.flush(
        { estado: { codigo: 'VALIDADA', nombre: 'Validada' }, venceAt: null, aviso: '' },
        { status: 201, statusText: 'Creado' },
      );
      await asentar();
      expect(el.querySelector('.aviso.exito')?.textContent).toContain('Decisión registrada');
      expect(el.querySelector('.aviso.exito')?.textContent).toContain('Validada');
      expect(el.querySelector('#motivacion')).toBeNull();
    });

    it('lista los motivos por los que no se puede registrar la decisión', async () => {
      const { el, ctrl, asentar } = await montar();
      el.querySelectorAll<HTMLInputElement>('.opciones-decision input')[0]!.click();
      await asentar();
      el.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
      await asentar();
      el.querySelector<HTMLButtonElement>('dialog[open] .boton:not(.secundario)')!.click();
      ctrl.expectOne(`${URL_CASO}/decision`).flush(
        errorApi('VALIDACION', 'Revise', [
          {
            campo: 'decision',
            mensaje: 'No se puede aprobar: faltan por revisar «SISBÉN IV grupo A, B o C».',
          },
        ]),
        { status: 422, statusText: 'No procesable' },
      );
      await asentar();
      expect(el.querySelector('form .aviso.error')?.textContent).toContain('faltan por revisar');
      expect(el.querySelector('dialog[open]')).toBeNull();
    });

    it('al solicitar subsanación resume lo que se le pedirá corregir', async () => {
      const { el, asentar } = await montar(
        caso({}, [item({ resultado: 'NO_CUMPLE', observacion: 'Cargue el soporte vigente' })]),
      );
      el.querySelectorAll<HTMLInputElement>('.opciones-decision input')[1]!.click();
      await asentar();
      expect(el.querySelector('.resumen-subsanar')?.textContent).toContain(
        'Cargue el soporte vigente',
      );
      expect(el.querySelector('.resumen-subsanar')?.textContent).toContain('0 de 2 ronda(s)');
    });

    it('el caso se puede devolver a la bandeja sin decidir', async () => {
      const { el, ctrl, asentar } = await montar();
      const devolver = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent!.includes('Devolver a la bandeja'),
      )!;
      devolver.click();
      const req = ctrl.expectOne(`${URL_CASO}/liberar`);
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'Sin contenido' });
      await asentar();
    });
  });

  it('muestra la subsanación abierta con su plazo y lo que se pidió', async () => {
    const { el } = await montar(
      caso({
        subsanacion: {
          estado: 'VENCIDA',
          venceAt: '2026-10-10T04:59:59Z',
          vencida: true,
          respondidaAt: null,
          items: [{ nombre: 'SISBÉN IV', observacion: 'Soporte vencido' }],
        },
      }),
    );
    const bloque = el.querySelector('[aria-labelledby="t-subsanacion"]')!;
    expect(bloque.textContent).toContain('Plazo vencido');
    expect(bloque.textContent).toContain('Soporte vencido');
  });

  it('muestra la alerta del cruce cuando la persona o su cuidador aparecen en el archivo (RF-VAL-03)', async () => {
    const { el } = await montar(
      caso(
        {
          alertas: [
            {
              cruceCodigo: 'BENEFICIOS_INCOMPATIBLES',
              nombre: 'Apoyos de transporte incompatibles',
              cargadoAt: '2026-10-05T10:00:00Z',
              coincidencias: [{ persona: 'PCD', detalle: 'ESTE' }],
            },
          ],
        },
        [item({ cruceCodigo: 'BENEFICIOS_INCOMPATIBLES' })],
      ),
    );
    const alerta = el.querySelector('.alerta-cruce');
    expect(alerta?.getAttribute('role')).toBe('alert');
    expect(alerta?.textContent).toContain('Apoyos de transporte incompatibles');
    expect(alerta?.textContent).toContain('la persona con discapacidad: ESTE');
  });

  it('sin coincidencias en el archivo lo dice, sin alerta', async () => {
    const sin = await montar(
      caso(
        {
          alertas: [
            {
              cruceCodigo: 'BENEFICIOS_INCOMPATIBLES',
              nombre: 'Apoyos de transporte incompatibles',
              cargadoAt: '2026-10-05T10:00:00Z',
              coincidencias: [],
            },
          ],
        },
        [item({ cruceCodigo: 'BENEFICIOS_INCOMPATIBLES' })],
      ),
    );
    expect(sin.el.querySelector('.alerta-cruce')).toBeNull();
    expect(sin.el.textContent).toContain('sin coincidencias');
  });

  it('sin archivo cargado del cruce pide verificar la fuente a mano', async () => {
    const nada = await montar(
      caso(
        {
          alertas: [
            {
              cruceCodigo: 'BENEFICIOS_INCOMPATIBLES',
              nombre: null,
              cargadoAt: null,
              coincidencias: [],
            },
          ],
        },
        [item({ cruceCodigo: 'BENEFICIOS_INCOMPATIBLES' })],
      ),
    );
    expect(nada.el.textContent).toContain('todavía no hay archivo cargado');
  });

  it('el validador registra los datos de priorización con la matriz vigente y se guardan al elegirlos', async () => {
    const { el, ctrl, asentar } = await montar(
      caso({
        priorizacion: {
          matrizVersion: 1,
          variables: [
            {
              codigo: 'DEPENDENCIA_FUNCIONAL',
              nombre: 'Dependencia funcional',
              descripcion: 'Según el certificado',
              opciones: [
                { codigo: 'SEVERA', etiqueta: 'Severa' },
                { codigo: 'LEVE', etiqueta: 'Leve' },
              ],
              valor: null,
            },
          ],
          puntaje: null,
        },
      }),
    );
    expect(el.querySelector('#t-prio')?.textContent).toContain('Datos para la priorización');
    expect(el.textContent).toContain('Faltan 1');
    const select = el.querySelector<HTMLSelectElement>('#var-DEPENDENCIA_FUNCIONAL')!;
    select.value = 'SEVERA';
    select.dispatchEvent(new Event('change'));
    const r = ctrl.expectOne(`${URL_CASO}/variables/DEPENDENCIA_FUNCIONAL`);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ valor: 'SEVERA' });
    r.flush({
      matrizVersion: 1,
      variables: [
        {
          codigo: 'DEPENDENCIA_FUNCIONAL',
          nombre: 'Dependencia funcional',
          descripcion: '',
          opciones: [
            { codigo: 'SEVERA', etiqueta: 'Severa' },
            { codigo: 'LEVE', etiqueta: 'Leve' },
          ],
          valor: 'SEVERA',
        },
      ],
      puntaje: null,
    });
    await asentar();
    expect(el.textContent).not.toContain('Faltan 1');
  });

  it('muestra el error al guardar un dato de priorización', async () => {
    const { el, ctrl, asentar } = await montar(
      caso({
        priorizacion: {
          matrizVersion: 1,
          variables: [
            {
              codigo: 'GRUPO_SISBEN',
              nombre: 'Grupo del SISBÉN IV',
              descripcion: '',
              opciones: [{ codigo: 'GRUPO_A', etiqueta: 'Grupo A' }],
              valor: null,
            },
          ],
          puntaje: null,
        },
      }),
    );
    const select = el.querySelector<HTMLSelectElement>('#var-GRUPO_SISBEN')!;
    select.value = 'GRUPO_A';
    select.dispatchEvent(new Event('change'));
    ctrl
      .expectOne(`${URL_CASO}/variables/GRUPO_SISBEN`)
      .flush(
        errorApi('CASO_NO_TOMADO', 'Abra el caso para revisarlo antes de registrar resultados.'),
        { status: 409, statusText: 'Conflicto' },
      );
    await asentar();
    expect(
      el.querySelector('#t-prio')?.parentElement?.querySelector('.aviso.error')?.textContent,
    ).toContain('Abra el caso');
  });

  it('con el caso ya validado muestra el puntaje y no deja cambiar los datos', async () => {
    const { el } = await montar(
      caso({
        validacion: { ...caso().validacion, puedeEditar: false },
        priorizacion: {
          matrizVersion: 1,
          variables: [
            {
              codigo: 'GRUPO_SISBEN',
              nombre: 'Grupo del SISBÉN IV',
              descripcion: '',
              opciones: [{ codigo: 'GRUPO_A', etiqueta: 'Grupo A' }],
              valor: 'GRUPO_A',
            },
          ],
          puntaje: {
            total: 90,
            matrizVersion: 1,
            calculadoAt: '2026-10-05T10:00:00Z',
            detalle: [],
          },
        },
      }),
    );
    expect(el.querySelector('section[aria-labelledby="t-prio"]')?.textContent).toContain(
      'Puntaje: 90',
    );
    expect(el.querySelector<HTMLSelectElement>('#var-GRUPO_SISBEN')!.disabled).toBe(true);
  });
});
