import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { Parametro } from '../config/modelos-config';
import { ParametrosPage, validarValorParametro } from './parametros-page';

const version = (valor: string, c: object = {}) => ({
  id: 1,
  valor,
  vigenteDesde: '2026-10-01T10:00:00Z',
  aprobadoPor: null,
  justificacion: 'Valor inicial',
  creadoAt: '2026-10-01T10:00:00Z',
  ...c,
});

const param = (c: Partial<Parametro>): Parametro => ({
  clave: 'archivo_max_mb',
  grupo: 'Documentos',
  descripcion: 'Tamaño máximo por documento',
  tipo: 'ENTERO',
  minimo: 1,
  maximo: 25,
  patron: null,
  pendienteDefinicion: false,
  vigente: version('5'),
  programada: null,
  ...c,
});

describe('validación del valor de un parámetro', () => {
  it('replica las reglas de la API: tipo, rango y formato', () => {
    expect(validarValorParametro(param({}), '5')).toBeNull();
    expect(validarValorParametro(param({}), 'cinco')).toContain('entero');
    expect(validarValorParametro(param({}), '0')).toContain('mínimo');
    expect(validarValorParametro(param({}), '26')).toContain('máximo');
    const formatos = param({ tipo: 'TEXTO', patron: '^(pdf|jpg|png)(,(pdf|jpg|png))*$' });
    expect(validarValorParametro(formatos, 'pdf,png')).toBeNull();
    expect(validarValorParametro(formatos, 'exe')).toContain('formato');
    expect(validarValorParametro(param({ tipo: 'BOOLEANO' }), 'si')).toContain('true');
  });
});

describe('ParametrosPage', () => {
  async function montar(items: Parametro[]) {
    const p = montarPantalla(ParametrosPage);
    p.ctrl.expectOne(`${API_BASE}/admin/parametros`).flush({ items });
    await p.asentar();
    return p;
  }

  it('agrupa los parámetros, muestra su valor vigente, el aprobador y los pendientes de confirmar', async () => {
    const { el } = await montar([
      param({}),
      param({
        clave: 'plazo_subsanacion_dias',
        grupo: 'Verificación',
        descripcion: 'Plazo de subsanación',
        pendienteDefinicion: true,
        vigente: version('10', { aprobadoPor: 'admin' }),
        programada: version('15', { vigenteDesde: '2027-01-01T05:00:00Z' }),
      }),
    ]);
    expect([...el.querySelectorAll(':scope > h2')].map((h) => h.textContent)).toEqual([
      'Documentos',
      'Verificación',
    ]);
    const texto = el.textContent!;
    expect(texto).toContain('Por confirmar');
    expect(texto).toContain('Aprobó: admin');
    expect(texto).toContain('Programado: 15');
    expect(texto).toContain('Aprobó: Sistema (valor inicial)');
  });

  it('no envía un valor fuera de rango y lo explica en el campo', async () => {
    const { el, ctrl, asentar, escribir, enviar } = await montar([param({})]);
    el.querySelector<HTMLButtonElement>(
      'button[title="Cambiar el valor de archivo_max_mb"]',
    )!.click();
    await asentar();
    escribir('#par-valor', '500');
    escribir('#par-motivo', 'Ajuste de prueba');
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('#par-valor-error')?.textContent).toContain('máximo permitido es 25');
  });

  it('crea una versión nueva con el motivo y avisa que rige desde ahora', async () => {
    const { el, ctrl, asentar, escribir, enviar } = await montar([param({})]);
    el.querySelector<HTMLButtonElement>(
      'button[title="Cambiar el valor de archivo_max_mb"]',
    )!.click();
    await asentar();
    escribir('#par-valor', '8');
    escribir('#par-motivo', 'Ajuste del manual operativo');
    enviar();
    const req = ctrl.expectOne(`${API_BASE}/admin/parametros/archivo_max_mb/versiones`);
    expect(req.request.body).toEqual({
      valor: '8',
      vigenteDesde: null,
      justificacion: 'Ajuste del manual operativo',
    });
    req.flush(param({ vigente: version('8', { aprobadoPor: 'admin' }) }), {
      status: 201,
      statusText: 'Creado',
    });
    await asentar();
    ctrl
      .expectOne(`${API_BASE}/admin/parametros`)
      .flush({ items: [param({ vigente: version('8') })] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('rige desde ahora');
  });

  it('muestra el error de la API (valor igual al vigente) dentro del diálogo', async () => {
    const { el, ctrl, asentar, escribir, enviar } = await montar([param({})]);
    el.querySelector<HTMLButtonElement>(
      'button[title="Cambiar el valor de archivo_max_mb"]',
    )!.click();
    await asentar();
    escribir('#par-valor', '6');
    escribir('#par-motivo', 'Motivo de prueba');
    enviar();
    ctrl
      .expectOne(`${API_BASE}/admin/parametros/archivo_max_mb/versiones`)
      .flush(errorApi('SIN_CAMBIO', 'El valor es igual al que está vigente'), {
        status: 409,
        statusText: 'Conflicto',
      });
    await asentar();
    expect(el.querySelector('dialog .aviso.error')?.textContent).toContain(
      'igual al que está vigente',
    );
  });

  it('muestra el historial de versiones con el aprobador', async () => {
    const { el, ctrl, asentar } = await montar([param({})]);
    el.querySelector<HTMLButtonElement>('button[title="Historial de archivo_max_mb"]')!.click();
    ctrl.expectOne(`${API_BASE}/admin/parametros/archivo_max_mb/historial`).flush({
      items: [version('8', { id: 2, aprobadoPor: 'admin', justificacion: 'Ajuste' }), version('5')],
    });
    await asentar();
    const items = el.querySelectorAll('dialog .historial li');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('admin');
    expect(items[1]?.textContent).toContain('Sistema');
  });
});
