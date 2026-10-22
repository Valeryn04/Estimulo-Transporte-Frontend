import { vi } from 'vitest';
import { API_BASE } from '../../../../core/api/api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { Expediente } from '../modelos-seguimiento';
import { ExpedientePage } from './expediente-page';
import { esperarTareas } from '../../../../testing/asentar';

const URL = `${API_BASE}/admin/expedientes`;

const expediente = (extra: Partial<Expediente> = {}): Expediente => ({
  solicitudId: 5,
  radicado: 'EST-2026-000005',
  estado: 'ASIGNADA',
  vigencia: 2026,
  localidad: 'Norte-Centro Histórico',
  barrio: 'El Prado',
  correo: null,
  creadaAt: '2026-10-01T10:00:00Z',
  correoVerificadoAt: '2026-10-01T10:05:00Z',
  radicadaAt: '2026-10-02T09:00:00Z',
  pcd: { nombre: 'Ana Pérez', tipoIdentificacion: 'CC', numeroIdentificacion: '***345' },
  cuidador: { nombre: 'Luis Gómez', tipoIdentificacion: 'CC', numeroIdentificacion: '***678' },
  puntaje: { total: 72.5, matrizVersion: 1 },
  beneficio: { id: 1, estado: 'PENDIENTE_ENTREGA', asignadoAt: '2026-10-10T12:00:00Z' },
  documentos: [
    {
      documento: 'Documento de identidad',
      estado: 'CARGADO',
      version: 2,
      archivo: 'cedula.pdf',
      origen: 'CIUDADANO',
      cargadoAt: '2026-10-02T08:00:00Z',
    },
  ],
  otrasVigencias: [
    { solicitudId: 2, radicado: 'EST-2025-000002', estado: 'NO_CUMPLE', anio: 2025 },
  ],
  cronologia: [
    {
      fecha: '2026-10-02T09:00:00Z',
      origen: 'bitacora',
      modulo: 'radicacion',
      accion: 'CARACTERIZACION_RADICADA',
      usuario: null,
      justificacion: null,
      anterior: null,
      nuevo: null,
    },
    {
      fecha: '2026-10-02T09:01:00Z',
      origen: 'correo',
      modulo: 'comunicaciones',
      accion: 'CARACTERIZACION_RADICADA',
      usuario: null,
      justificacion: 'Solicitud radicada',
      anterior: null,
      nuevo: { estado: 'ENVIADO' },
    },
    {
      fecha: '2026-10-10T12:00:00Z',
      origen: 'bitacora',
      modulo: 'asignacion',
      accion: 'BENEFICIO_ASIGNADO',
      usuario: 'asignador',
      justificacion: null,
      anterior: null,
      nuevo: null,
    },
  ],
  decisiones: [
    {
      ronda: 1,
      decision: 'APROBAR',
      motivacion: 'Cumple todos los requisitos.',
      listaDeChequeo: [
        { requisito: 'Documento de identidad', resultado: 'CUMPLE', observacion: '' },
      ],
      fecha: '2026-10-03T10:00:00Z',
      usuario: 'validador',
    },
  ],
  subsanaciones: [],
  novedades: [],
  entregas: [],
  comunicaciones: [
    {
      id: 7,
      tipo: 'CARACTERIZACION_RADICADA',
      asunto: 'Solicitud radicada',
      cuerpo: 'Recibimos su caracterización.',
      destinatario: 'a***@correo.com',
      estado: 'REBOTADO',
      fecha: '2026-10-02T09:01:00Z',
      entregadoAt: null,
      reboteMotivo: 'Buzón inexistente',
      reenvioDe: null,
      reenviado: false,
    },
  ],
  alertaRebote: true,
  sensiblesOcultos: true,
  ...extra,
});

describe('ExpedientePage', () => {
  it('abre el expediente de la ruta y muestra su cronología en orden', async () => {
    const p = montarPantalla(ExpedientePage, { solicitudId: '5' }, ['expediente.ver']);
    p.ctrl.expectOne(`${URL}/5`).flush(expediente());
    await p.asentar();
    const { el } = p;
    expect(el.querySelector('h1')?.textContent).toContain('EST-2026-000005');
    expect(el.textContent).toContain('Ana Pérez');
    expect(el.textContent).toContain('***345');
    expect(el.textContent).toContain('72,5');
    const eventos = [...el.querySelectorAll('.cronologia li strong')].map((e) => e.textContent);
    expect(eventos).toEqual([
      'Caracterización radicada',
      'Correo: Caracterización radicada',
      'Beneficio asignado',
    ]);
    expect(el.textContent).toContain('Documento de identidad');
    expect(el.textContent).toContain('EST-2025-000002');
  });

  it('avisa que los datos sensibles están ocultos', async () => {
    const p = montarPantalla(ExpedientePage, { solicitudId: '5' }, ['expediente.ver']);
    p.ctrl.expectOne(`${URL}/5`).flush(expediente());
    await p.asentar();
    expect(p.el.querySelector('.aviso')?.textContent).toContain('permiso sobre datos sensibles');
    expect([...p.el.querySelectorAll('dt')].map((d) => d.textContent)).not.toContain('Correo');
  });

  it('busca por radicado, documento o nombre y abre uno de los resultados', async () => {
    const p = montarPantalla(ExpedientePage, {}, ['expediente.ver']);
    p.escribir('#busqueda', 'Ana');
    p.enviar('form[role="search"]');
    const b = p.ctrl.expectOne((r) => r.url === URL);
    expect(b.request.params.get('q')).toBe('Ana');
    b.flush({
      items: [
        {
          solicitudId: 5,
          radicado: 'EST-2026-000005',
          estado: 'ASIGNADA',
          anio: 2026,
          pcdNombre: 'Ana Pérez',
        },
      ],
    });
    await p.asentar();
    expect(p.el.querySelector('tbody')?.textContent).toContain('Ana Pérez');
    p.el.querySelector<HTMLButtonElement>('tbody .enlace')!.click();
    await esperarTareas();
    p.ctrl.expectOne(`${URL}/5`).flush(expediente());
    await p.asentar();
    expect(p.el.querySelector('h1')?.textContent).toContain('EST-2026-000005');
  });

  it('no busca con menos de tres caracteres', async () => {
    const p = montarPantalla(ExpedientePage, {}, ['expediente.ver']);
    p.escribir('#busqueda', 'ab');
    p.enviar('form[role="search"]');
    await p.asentar();
    p.ctrl.expectNone((r) => r.url === URL);
    expect(p.el.querySelector('.error-campo')?.textContent).toContain('al menos 3');
  });

  it('repite la búsqueda que viene en la dirección', async () => {
    const p = montarPantalla(ExpedientePage, { q: 'EST-2026-000005' }, ['expediente.ver']);
    const b = p.ctrl.expectOne((r) => r.url === URL);
    expect(b.request.params.get('q')).toBe('EST-2026-000005');
    b.flush({ items: [] });
    await p.asentar();
    expect(p.el.textContent).toContain('No encontramos expedientes');
  });

  describe('comunicaciones y correos rebotados (RF-COM-03)', () => {
    async function abrir(permisos: string[]) {
      const p = montarPantalla(ExpedientePage, { solicitudId: '5' }, permisos);
      p.ctrl.expectOne(`${URL}/5`).flush(expediente());
      await p.asentar();
      return p;
    }
    const archivo = (el: HTMLElement) => {
      const input = el.querySelector<HTMLInputElement>('#exp-soporte')!;
      Object.defineProperty(input, 'files', {
        value: [new File(['%PDF-1.4'], 'soporte.pdf', { type: 'application/pdf' })],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
    };

    it('muestra el contenido de cada comunicación, su estado y la alerta de rebote', async () => {
      const p = await abrir(['expediente.ver']);
      expect(p.el.querySelector('.aviso.error')?.textContent).toContain('rebotaron');
      expect(p.el.querySelector('.comunicaciones')?.textContent).toContain('Rebotado');
      expect(p.el.querySelector('.cuerpo-correo')?.textContent).toContain(
        'Recibimos su caracterización',
      );
      expect(p.el.textContent).toContain('Buzón inexistente');
      // Sin permiso de gestión no hay acciones para corregir el correo.
      expect(p.el.querySelector('#exp-correo')).toBeNull();
    });

    it('muestra las decisiones de verificación con su lista de chequeo', async () => {
      const p = await abrir(['expediente.ver']);
      expect(p.el.querySelector('#t-dec')?.textContent).toContain('Verificación de requisitos');
      expect(p.el.querySelector('details')?.textContent).toContain('Documento de identidad');
    });

    it('corrige el correo con soporte, reenvía lo rebotado y recarga el expediente', async () => {
      const p = await abrir(['expediente.ver', 'novedades.gestionar']);
      p.escribir('#exp-correo', 'corregido@correo.com');
      p.escribir('#exp-just', 'La persona confirmó su correo por teléfono.');
      p.enviar('form[aria-label], form.no-imprimir');
      await p.asentar();
      p.ctrl.expectNone((r) => r.method === 'POST');
      expect(
        [...p.el.querySelectorAll('.aviso.error')].some((a) => a.textContent?.includes('soporte')),
      ).toBe(true);
      archivo(p.el);
      p.enviar('form.no-imprimir');
      const r = p.ctrl.expectOne(`${URL}/5/correo`);
      expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
        correo: 'corregido@correo.com',
        justificacion: 'La persona confirmó su correo por teléfono.',
      });
      r.flush({ reenviados: 1 }, { status: 201, statusText: 'Creado' });
      await p.asentar();
      p.ctrl.expectOne(`${URL}/5`).flush(expediente({ alertaRebote: false }));
      await p.asentar();
      expect(p.el.querySelector('.aviso.exito')?.textContent).toContain(
        '1 comunicación(es) reenviada',
      );
      expect(p.el.querySelector('.aviso.error')).toBeNull();
    });

    it('reenvía una comunicación rebotada al correo ya corregido', async () => {
      const p = await abrir(['expediente.ver', 'novedades.gestionar']);
      p.el.querySelector<HTMLButtonElement>('.comunicaciones .enlace')!.click();
      await esperarTareas();
      p.ctrl
        .expectOne(`${URL}/5/comunicaciones/7/reenviar`)
        .flush({ mensaje: 'ok' }, { status: 202, statusText: 'Aceptado' });
      await p.asentar();
      p.ctrl.expectOne(`${URL}/5`).flush(expediente({ alertaRebote: false }));
      await p.asentar();
      expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('cola de envío');
    });
  });

  it('imprime el expediente', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const p = montarPantalla(ExpedientePage, { solicitudId: '5' }, ['expediente.ver']);
    p.ctrl.expectOne(`${URL}/5`).flush(expediente());
    await p.asentar();
    [...p.el.querySelectorAll<HTMLButtonElement>('.encabezado button')]
      .find((b) => b.textContent?.includes('Imprimir'))!
      .click();
    expect(imprimir).toHaveBeenCalledOnce();
    imprimir.mockRestore();
  });

  it('muestra el error cuando el expediente no existe', async () => {
    const p = montarPantalla(ExpedientePage, { solicitudId: '99' }, ['expediente.ver']);
    p.ctrl.expectOne(`${URL}/99`).flush(errorApi('NO_ENCONTRADO', 'Solicitud no encontrada'), {
      status: 404,
      statusText: 'No encontrado',
    });
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('no encontrada');
  });
});
