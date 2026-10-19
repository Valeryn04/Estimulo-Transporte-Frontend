import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { Matriz, ResumenMatriz, VariableMatriz } from '../modelos-priorizacion';
import { derivarCodigo, MatrizPage } from './matriz-page';

const URL = `${API_BASE}/admin/matriz`;

const VARIABLES: VariableMatriz[] = [
  {
    codigo: 'DEPENDENCIA_FUNCIONAL',
    nombre: 'Dependencia funcional',
    descripcion: 'Según el certificado',
    origen: 'VALIDADOR',
    peso: 1,
    opciones: [
      { codigo: 'SEVERA', etiqueta: 'Severa', puntos: 25 },
      { codigo: 'LEVE', etiqueta: 'Leve', puntos: 5 },
    ],
  },
  {
    codigo: 'AUSENCIA_SUBSIDIOS',
    nombre: 'Ausencia de otros subsidios',
    descripcion: '',
    origen: 'SUBSIDIOS',
    peso: 1,
    opciones: [
      { codigo: 'SIN_SUBSIDIOS', etiqueta: 'No recibe otros subsidios', puntos: 5 },
      { codigo: 'CON_SUBSIDIOS', etiqueta: 'Recibe otros subsidios', puntos: 0 },
    ],
  },
];

const resumen = (c: Partial<ResumenMatriz> = {}): ResumenMatriz => ({
  id: 1,
  version: 1,
  estado: 'VIGENTE',
  notas: '',
  creadaPor: null,
  creadaAt: '2026-10-01T10:00:00Z',
  solicitadaPor: null,
  decididaPor: null,
  decididaAt: null,
  motivoDecision: null,
  vigenteDesde: '2026-10-01T10:00:00Z',
  vigenteHasta: null,
  ...c,
});

const matriz = (c: Partial<Matriz> = {}): Matriz => ({
  ...resumen(),
  desempate: ['VARIABLE:DEPENDENCIA_FUNCIONAL', 'FECHA_RADICACION'],
  desempateTexto: ['Mayor puntaje en «Dependencia funcional»', 'Fecha de radicación más antigua'],
  puntajeMaximo: 30,
  variables: VARIABLES,
  solicitadaAt: null,
  ...c,
});

const ADMIN = ['matriz.administrar'];
const RESPONSABLE = ['priorizacion.aprobar'];

describe('derivarCodigo', () => {
  it('convierte un nombre en un código estable', () => {
    expect(derivarCodigo('Dependencia funcional')).toBe('DEPENDENCIA_FUNCIONAL');
    expect(derivarCodigo('  ¿Víctima del desplazamiento? ')).toBe('VICTIMA_DEL_DESPLAZAMIENTO');
  });
});

describe('MatrizPage', () => {
  async function montar(versiones: ResumenMatriz[] = [resumen()], permisos = ADMIN) {
    const p = montarPantalla(MatrizPage, {}, permisos);
    p.ctrl.expectOne(URL).flush({ items: versiones });
    await p.asentar();
    return p;
  }

  async function abrir(p: Awaited<ReturnType<typeof montar>>, texto: string, m: Matriz) {
    [...p.el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.replace(/\s+/g, ' ').includes(texto))!
      .click();
    p.ctrl.expectOne(`${URL}/${m.id}`).flush(m);
    await p.asentar();
  }

  it('lista las versiones con su estado y no deja crear otra si hay una abierta', async () => {
    const p = await montar([
      resumen({
        id: 2,
        version: 2,
        estado: 'EN_APROBACION',
        vigenteDesde: null,
        solicitadaPor: 'admin',
      }),
      resumen(),
    ]);
    const filas = p.el.querySelectorAll('tbody tr');
    expect(filas[0]?.textContent).toContain('Pendiente de aprobación');
    expect(filas[1]?.textContent).toContain('Vigente');
    expect(p.el.querySelector('.encabezado .boton')).toBeNull();
  });

  it('deja crear una versión nueva cuando no hay ninguna abierta', async () => {
    const p = await montar();
    expect(p.el.querySelector('.encabezado .boton')?.textContent).toContain('Nueva versión');
  });

  it('muestra la versión vigente solo de lectura, con las opciones y el puntaje máximo', async () => {
    const p = await montar();
    await abrir(p, 'Ver la versión 1', matriz());
    // Editar solo aplica al borrador: la vigente se ve, no se edita.
    expect(p.el.querySelector('form')).toBeNull();
    const detalle = p.el.querySelector('section.detalle')!;
    expect(detalle.textContent).toContain('Puntaje máximo posible: 30');
    expect(detalle.textContent).toContain('Dependencia funcional');
    expect(detalle.textContent).toContain('Severa: 25');
    expect(detalle.textContent).toContain('Sale de la caracterización');
    expect(detalle.textContent).toContain('Fecha de radicación más antigua');
  });

  it('crea un borrador copia de la vigente y lo deja listo para editar', async () => {
    const p = await montar();
    p.el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    const r = p.ctrl.expectOne(URL);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({});
    r.flush(matriz({ id: 2, version: 2, estado: 'BORRADOR', creadaPor: 'admin' }), {
      status: 201,
      statusText: 'Creado',
    });
    await p.asentar();
    p.ctrl
      .expectOne(URL)
      .flush({ items: [resumen({ id: 2, version: 2, estado: 'BORRADOR' }), resumen()] });
    await p.asentar();
    expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('versión 2');
    expect(p.el.querySelectorAll('fieldset.variable')).toHaveLength(2);
    expect(p.el.querySelector('#v-peso-0')).not.toBeNull();
  });

  it('guarda el borrador con el peso cambiado y una variable nueva (con sus códigos derivados)', async () => {
    const borrador = matriz({ id: 2, version: 2, estado: 'BORRADOR' });
    const p = await montar([resumen({ id: 2, version: 2, estado: 'BORRADOR' }), resumen()]);
    await abrir(p, 'Editar la versión 2', borrador);
    p.escribir('#v-peso-0', '2');
    [...p.el.querySelectorAll<HTMLButtonElement>('form button')]
      .find((b) => b.textContent?.trim() === 'Agregar variable')!
      .click();
    await p.asentar();
    expect(p.el.querySelectorAll('fieldset.variable')).toHaveLength(3);
    p.escribir('#v-nombre-2', 'Hogar monoparental');
    p.escribir('#o-etiqueta-2-0', 'Sí');
    p.escribir('#o-puntos-2-0', '10');
    p.escribir('#o-etiqueta-2-1', 'No');
    p.escribir('#o-puntos-2-1', '0');
    await p.asentar();
    p.escribir('#d-0', 'VARIABLE:HOGAR_MONOPARENTAL');
    await p.asentar();
    p.enviar('section form');
    const r = p.ctrl.expectOne(`${URL}/2`);
    expect(r.request.method).toBe('PUT');
    const cuerpo = r.request.body;
    expect(cuerpo.variables).toHaveLength(3);
    expect(cuerpo.variables[0]).toMatchObject({ codigo: 'DEPENDENCIA_FUNCIONAL', peso: 2 });
    expect(cuerpo.variables[2]).toMatchObject({
      codigo: 'HOGAR_MONOPARENTAL',
      nombre: 'Hogar monoparental',
      origen: 'VALIDADOR',
      peso: 1,
    });
    expect(cuerpo.variables[2].opciones).toEqual([
      { codigo: 'SI', etiqueta: 'Sí', puntos: 10 },
      { codigo: 'NO', etiqueta: 'No', puntos: 0 },
    ]);
    expect(cuerpo.desempate[0]).toBe('VARIABLE:HOGAR_MONOPARENTAL');
    r.flush(matriz({ ...borrador, puntajeMaximo: 55 }));
    await p.asentar();
    expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('Puntaje máximo: 55');
  });

  it('muestra los errores de la matriz que devuelve la API', async () => {
    const borrador = matriz({ id: 2, version: 2, estado: 'BORRADOR' });
    const p = await montar([resumen({ id: 2, version: 2, estado: 'BORRADOR' }), resumen()]);
    await abrir(p, 'Editar la versión 2', borrador);
    p.enviar('section form');
    p.ctrl
      .expectOne(`${URL}/2`)
      .flush(
        errorApi('VALIDACION', 'Revise', [
          { campo: 'desempate', mensaje: 'Desempate: el criterio VARIABLE:X no existe' },
        ]),
        { status: 422, statusText: 'No procesable' },
      );
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('no existe');
  });

  it('una variable que sale de la caracterización solo tiene sus dos opciones fijas', async () => {
    const borrador = matriz({ id: 2, version: 2, estado: 'BORRADOR' });
    const p = await montar([resumen({ id: 2, version: 2, estado: 'BORRADOR' }), resumen()]);
    await abrir(p, 'Editar la versión 2', borrador);
    p.escribir('#v-origen-0', 'SUBSIDIOS');
    await p.asentar();
    const filas = p.el.querySelectorAll('fieldset.variable')[0]!.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(p.el.querySelector<HTMLInputElement>('#o-etiqueta-0-0')!.readOnly).toBe(true);
    expect(p.el.querySelectorAll('fieldset.variable')[0]!.textContent).not.toContain(
      'Agregar opción',
    );
  });

  it('simula la versión y muestra cuántos casos cambian de posición', async () => {
    const p = await montar();
    [...p.el.querySelectorAll<HTMLButtonElement>('tbody .enlace')]
      .find((b) => b.textContent?.includes('Simular'))!
      .click();
    p.ctrl.expectOne(`${URL}/1/simulacion`).flush({
      matriz: { id: 1, version: 1, puntajeMaximo: 30 },
      vigenteVersion: 1,
      resumen: {
        casos: 3,
        conPuntajeActual: 3,
        cambianPosicion: 2,
        suben: 1,
        bajan: 1,
        sinDatos: 0,
      },
      items: [
        {
          solicitudId: 7,
          radicado: 'EST-2026-000007',
          pcdNombre: 'María',
          puntajeActual: 35,
          puntajeSimulado: 50,
          posicionActual: 2,
          posicionSimulada: 1,
          cambio: 1,
          faltantes: [],
        },
      ],
      truncado: false,
    });
    await p.asentar();
    const d = p.el.querySelector('dialog[open]')!;
    expect(d.textContent).toContain('2 cambian de posición');
    expect(d.textContent).toContain('EST-2026-000007');
    expect(d.textContent).toContain('▲ 1');
    expect(d.textContent).toContain('era 2');
  });

  it('pide la aprobación del responsable: guarda el borrador y la solicita', async () => {
    const borrador = matriz({ id: 2, version: 2, estado: 'BORRADOR' });
    const p = await montar([resumen({ id: 2, version: 2, estado: 'BORRADOR' }), resumen()]);
    await abrir(p, 'Editar la versión 2', borrador);
    [...p.el.querySelectorAll<HTMLButtonElement>('form .boton')]
      .find((b) => b.textContent?.includes('Pedir aprobación'))!
      .click();
    p.ctrl.expectOne(`${URL}/2`).flush(borrador);
    await p.asentar();
    p.ctrl
      .expectOne(`${URL}/2/solicitar-aprobacion`)
      .flush({ ...borrador, estado: 'EN_APROBACION', solicitadaPor: 'prueba' });
    await p.asentar();
    p.ctrl
      .expectOne(URL)
      .flush({ items: [resumen({ id: 2, version: 2, estado: 'EN_APROBACION' }), resumen()] });
    await p.asentar();
    expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('pendiente de aprobación');
    expect(p.el.querySelector('form')).toBeNull();
  });

  it('el responsable aprueba una versión que pidió otra persona', async () => {
    const pendiente = matriz({
      id: 2,
      version: 2,
      estado: 'EN_APROBACION',
      solicitadaPor: 'admin',
    });
    const p = await montar(
      [resumen({ id: 2, version: 2, estado: 'EN_APROBACION', solicitadaPor: 'admin' }), resumen()],
      RESPONSABLE,
    );
    await abrir(p, 'Ver la versión 2', pendiente);
    [...p.el.querySelectorAll<HTMLButtonElement>('section .boton')]
      .find((b) => b.textContent?.includes('Aprobar y activar'))!
      .click();
    await p.asentar();
    [...p.el.querySelectorAll<HTMLButtonElement>('dialog[open] .boton')]
      .find((b) => b.textContent?.trim() === 'Aprobar y activar')!
      .click();
    const r = p.ctrl.expectOne(`${URL}/2/decision`);
    expect(r.request.body).toEqual({ decision: 'APROBAR', motivo: '' });
    r.flush({ ...pendiente, estado: 'VIGENTE' });
    await p.asentar();
    p.ctrl.expectOne(URL).flush({ items: [resumen({ id: 2, version: 2 })] });
    await p.asentar();
    expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('quedó vigente');
  });

  it('quien pidió la aprobación no puede aprobarla, y rechazar exige motivo', async () => {
    const propia = matriz({ id: 2, version: 2, estado: 'EN_APROBACION', solicitadaPor: 'prueba' });
    const p = await montar(
      [resumen({ id: 2, version: 2, estado: 'EN_APROBACION', solicitadaPor: 'prueba' }), resumen()],
      RESPONSABLE,
    );
    await abrir(p, 'Ver la versión 2', propia);
    expect(p.el.querySelector('section')?.textContent).not.toContain('Aprobar y activar');
    expect(p.el.querySelector('section')?.textContent).toContain('no puede ser quien la pidió');
  });

  it('rechazar una versión exige un motivo', async () => {
    const otra = matriz({ id: 2, version: 2, estado: 'EN_APROBACION', solicitadaPor: 'admin' });
    const q = await montar(
      [resumen({ id: 2, version: 2, estado: 'EN_APROBACION', solicitadaPor: 'admin' }), resumen()],
      RESPONSABLE,
    );
    await abrir(q, 'Ver la versión 2', otra);
    [...q.el.querySelectorAll<HTMLButtonElement>('section .boton')]
      .find((b) => b.textContent?.trim() === 'Rechazar')!
      .click();
    await q.asentar();
    [...q.el.querySelectorAll<HTMLButtonElement>('dialog[open] .boton')]
      .find((b) => b.textContent?.trim() === 'Rechazar')!
      .click();
    await q.asentar();
    q.ctrl.expectNone((r) => r.method === 'POST');
    expect(q.el.querySelector('dialog[open] .aviso.error')?.textContent).toContain('Explique');
  });
});
