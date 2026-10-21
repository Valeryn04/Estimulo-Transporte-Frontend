import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { DetalleBeneficio } from '../modelos-asignacion';
import { EntregaBeneficio } from './entrega-beneficio';

const URL = `${API_BASE}/admin/asignacion/beneficiarios/5`;

const detalle = (c: Partial<DetalleBeneficio> = {}): DetalleBeneficio => ({
  beneficio: {
    id: 5,
    solicitudId: 9,
    radicado: 'EST-2026-000009',
    estado: 'PENDIENTE_ENTREGA',
    personas: 2,
    pcdNombre: 'María Fernanda Pérez',
    asignadoAt: '2026-10-05T10:00:00Z',
    activadoAt: null,
    hoy: '2026-10-19',
    asignadoDia: '2026-10-05',
  },
  personas: [
    {
      rol: 'PCD',
      nombre: 'María Fernanda Pérez',
      tipoIdentificacion: 'Cédula',
      numero: '1045678901',
    },
    { rol: 'CUIDADOR', nombre: 'Carlos López', tipoIdentificacion: 'Cédula', numero: '1045678902' },
  ],
  pendientes: ['PCD', 'CUIDADOR'],
  entregas: [],
  opciones: {
    tiposTransporte: [{ id: 8, nombre: 'Transmetro' }],
    tiposIdentificacion: [{ id: 1, nombre: 'Cédula' }],
  },
  ...c,
});

describe('EntregaBeneficio', () => {
  async function montar(d: DetalleBeneficio = detalle(), puedeAsignar = true) {
    const p = montarPantalla(EntregaBeneficio, { beneficioId: 5, puedeAsignar }, [
      'asignacion.ver',
    ]);
    await p.asentar();
    p.ctrl.expectOne(URL).flush(d);
    await p.asentar();
    return p;
  }

  const acta = (el: HTMLElement) => {
    const input = el.querySelector<HTMLInputElement>('#ent-acta')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['%PDF-1.4'], 'acta.pdf', { type: 'application/pdf' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
  };

  it('muestra lo que falta entregar y las tarjetas ya entregadas con el identificador enmascarado', async () => {
    const { el } = await montar(
      detalle({
        pendientes: ['CUIDADOR'],
        entregas: [
          {
            id: 1,
            rol: 'PCD',
            tarjeta: '******1234',
            tipoTransporte: 'Transmetro',
            fechaEntrega: '2026-10-10',
            receptorTipo: 'TERCERO',
            receptorNombre: 'Ana Gómez',
            receptorTipoIdentificacion: 'Cédula',
            receptorNumero: '123456',
            funcionarioEntrega: 'Funcionaria',
            soporte: { nombre: 'acta.pdf', tamanoBytes: 100 },
            vigente: true,
            registradoPor: 'asignador',
            registradoAt: '2026-10-10T10:00:00Z',
          },
        ],
      }),
    );
    expect(el.textContent).toContain('Falta entregar: Cuidador');
    const fila = el.querySelector('tbody tr')!;
    expect(fila.textContent).toContain('******1234');
    expect(fila.textContent).toContain('Ana Gómez');
    expect(fila.textContent).toContain('Un tercero autorizado');
    expect(fila.textContent).toContain('acta.pdf');
    // Solo se puede elegir a quien falta.
    const roles = [...el.querySelectorAll<HTMLOptionElement>('#ent-rol option')].map(
      (o) => o.value,
    );
    expect(roles).toEqual(['CUIDADOR']);
  });

  it('exige los datos y el acta antes de llamar a la API', async () => {
    const { el, ctrl, enviar, asentar } = await montar();
    enviar('dialog form');
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('#ent-tarjeta-error')?.textContent).toBeTruthy();
  });

  it('registra la entrega a la persona con quien la recibe y envía los datos con el acta', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    escribir('#ent-tarjeta', 'TM00001234');
    const t = el.querySelector<HTMLSelectElement>('#ent-transporte')!;
    t.selectedIndex = 1;
    t.dispatchEvent(new Event('change'));
    await asentar();
    expect(el.querySelector<HTMLInputElement>('#ent-fecha')!.value).toBe('2026-10-19');
    expect(el.querySelector<HTMLInputElement>('#ent-fecha')!.min).toBe('2026-10-05');
    escribir('#ent-funcionario', 'Funcionaria de entrega');
    enviar('dialog form');
    await asentar();
    // Falta el acta.
    ctrl.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('.aviso.error')?.textContent).toContain('acta');
    acta(el);
    enviar('dialog form');
    const r = ctrl.expectOne(`${URL}/entregas`);
    const form = r.request.body as FormData;
    expect(JSON.parse(form.get('datos') as string)).toEqual({
      rol: 'PCD',
      tarjetaId: 'TM00001234',
      tipoTransporteId: 8,
      fechaEntrega: '2026-10-19',
      receptorTipo: 'PCD',
      funcionarioEntrega: 'Funcionaria de entrega',
    });
    expect(form.get('archivo')).toBeInstanceOf(File);
    r.flush(detalle());
    await asentar();
    ctrl.expectOne(URL).flush(detalle({ pendientes: ['CUIDADOR'] }));
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('Falta la entrega al cuidador');
  });

  it('si recibe un tercero pide su nombre y su documento', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    escribir('#ent-tarjeta', 'TM00005678');
    const t = el.querySelector<HTMLSelectElement>('#ent-transporte')!;
    t.selectedIndex = 1;
    t.dispatchEvent(new Event('change'));
    escribir('#ent-funcionario', 'Funcionaria de entrega');
    const rec = el.querySelector<HTMLSelectElement>('#ent-receptor')!;
    rec.value = 'TERCERO';
    rec.dispatchEvent(new Event('change'));
    await asentar();
    expect(el.querySelector('#ent-tercero')).not.toBeNull();
    escribir('#ent-tercero', 'Ana Gómez Vargas');
    const tipo = el.querySelector<HTMLSelectElement>('#ent-tercero-tipo')!;
    tipo.selectedIndex = 1;
    tipo.dispatchEvent(new Event('change'));
    escribir('#ent-tercero-numero', '1234567');
    acta(el);
    enviar('dialog form');
    const r = ctrl.expectOne(`${URL}/entregas`);
    expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toMatchObject({
      receptorTipo: 'TERCERO',
      receptorNombre: 'Ana Gómez Vargas',
      receptorTipoIdentificacionId: 1,
      receptorNumero: '1234567',
    });
    r.flush(
      errorApi(
        'TARJETA_EN_USO',
        'Ese identificador de tarjeta ya está asignado a otro beneficiario activo.',
      ),
      {
        status: 409,
        statusText: 'Conflicto',
      },
    );
    await asentar();
    expect(el.querySelector('.aviso.error')?.textContent).toContain('ya está asignado');
  });

  it('con las tarjetas entregadas se confirma la activación', async () => {
    const pend = detalle({
      beneficio: { ...detalle().beneficio, estado: 'PENDIENTE_ACTIVACION' },
      pendientes: [],
    });
    const { el, ctrl, asentar } = await montar(pend);
    expect(el.querySelector('#ent-tarjeta')).toBeNull();
    [...el.querySelectorAll<HTMLButtonElement>('dialog .boton')]
      .find((b) => b.textContent?.includes('Confirmar la activación'))!
      .click();
    const r = ctrl.expectOne(`${URL}/activar`);
    expect(r.request.body).toEqual({ observacion: '' });
    r.flush(
      detalle({
        beneficio: { ...detalle().beneficio, estado: 'ACTIVO', activadoAt: '2026-10-19T10:00:00Z' },
      }),
    );
    await asentar();
    ctrl.expectOne(URL).flush(
      detalle({
        beneficio: { ...detalle().beneficio, estado: 'ACTIVO', activadoAt: '2026-10-19T10:00:00Z' },
        pendientes: [],
      }),
    );
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('quedó activo');
    expect(el.textContent).toContain('Activo desde');
  });

  it('sin permiso de asignar solo se consulta', async () => {
    const { el } = await montar(detalle(), false);
    expect(el.querySelector('#ent-tarjeta')).toBeNull();
    expect(el.textContent).toContain('Todavía no se ha entregado ninguna tarjeta');
  });
});
