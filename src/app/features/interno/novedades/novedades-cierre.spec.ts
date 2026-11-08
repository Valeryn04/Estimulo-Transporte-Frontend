import { API_BASE } from '../../../core/api/api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { ExpedienteBeneficio } from './expediente/expediente-beneficio';
import { ExpedienteNovedades } from './modelos-novedades';

const URL = `${API_BASE}/admin/novedades`;
const GESTOR = ['novedades.ver', 'novedades.gestionar'];

const expediente = (c: Partial<ExpedienteNovedades> = {}): ExpedienteNovedades => ({
  beneficio: {
    id: 5,
    radicado: 'EST-2026-000005',
    estado: 'ACTIVO',
    pcdNombre: 'María Fernanda Pérez',
    hoy: '2026-10-19',
    asignadoDia: '2026-10-05',
  },
  novedades: [],
  actualizaciones: [],
  revocatorias: [],
  causales: {
    bloqueo: [{ id: 11, nombre: 'Reporte de pérdida de la tarjeta' }],
    revocatoria: [{ id: 21, nombre: 'Uso indebido' }],
    finalizacion: [
      { id: 31, nombre: 'Fallecimiento' },
      { id: 32, nombre: 'Renuncia voluntaria al beneficio' },
    ],
  },
  ...c,
});

const archivo = (el: HTMLElement, id: string) => {
  const input = el.querySelector<HTMLInputElement>(id)!;
  Object.defineProperty(input, 'files', {
    value: [new File(['%PDF-1.4'], 'soporte.pdf', { type: 'application/pdf' })],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
};

describe('finalización y actualización de datos del beneficio (RF-BEN-05)', () => {
  async function montar(d = expediente(), puede = true, accion = '') {
    const p = montarPantalla(
      ExpedienteBeneficio,
      { beneficioId: 5, puedeGestionar: puede },
      GESTOR,
    );
    await p.asentar();
    p.ctrl.expectOne(`${URL}/beneficios/5`).flush(d);
    await p.asentar();
    // Se muestra un solo formulario a la vez: primero se elige qué hacer.
    if (accion) {
      [...p.el.querySelectorAll<HTMLButtonElement>('.elegir button')]
        .find((b) => b.textContent?.includes(accion))!
        .click();
      await p.asentar();
    }
    return p;
  }

  describe('finalizar', () => {
    it('exige causal, justificación y la confirmación antes de enviar (sin soporte)', async () => {
      const p = await montar(undefined, true, 'Finalizar el beneficio');
      p.enviar('app-finalizar-beneficio form');
      await p.asentar();
      p.ctrl.expectNone((r) => r.method === 'POST');
      const causal = p.el.querySelector<HTMLSelectElement>('#fin-causal')!;
      causal.selectedIndex = 2;
      causal.dispatchEvent(new Event('change'));
      p.escribir('#fin-obs', 'La persona renunció por escrito al beneficio.');
      p.enviar('app-finalizar-beneficio form');
      await p.asentar();
      p.ctrl.expectNone((r) => r.method === 'POST');
      expect(
        p.el.querySelector('#fin-confirmo-error, app-finalizar-beneficio .error'),
      ).not.toBeNull();
    });

    it('finaliza el beneficio solo con la justificación y vuelve a cargar el expediente', async () => {
      const p = await montar(undefined, true, 'Finalizar el beneficio');
      const causal = p.el.querySelector<HTMLSelectElement>('#fin-causal')!;
      causal.selectedIndex = 2;
      causal.dispatchEvent(new Event('change'));
      p.escribir('#fin-obs', 'La persona renunció por escrito al beneficio.');
      p.el
        .querySelector<HTMLInputElement>('app-finalizar-beneficio input[type="checkbox"]')!
        .click();
      expect(p.el.querySelector('#fin-archivo')).toBeNull();
      await p.asentar();
      p.enviar('app-finalizar-beneficio form');
      const r = p.ctrl.expectOne(`${URL}/beneficios/5/finalizar`);
      expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
        causalId: 32,
        fechaEfectiva: '2026-10-19',
        observacion: 'La persona renunció por escrito al beneficio.',
      });
      expect((r.request.body as FormData).get('archivo')).toBeNull();
      r.flush(expediente(), { status: 201, statusText: 'Creado' });
      await p.asentar();
      p.ctrl
        .expectOne(`${URL}/beneficios/5`)
        .flush(expediente({ beneficio: { ...expediente().beneficio, estado: 'FINALIZADO' } }));
      await p.asentar();
      expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('Beneficio finalizado');
      // Un beneficio finalizado ya no ofrece finalizar ni actualizar datos.
      expect(p.el.querySelector('app-finalizar-beneficio')).toBeNull();
      expect(p.el.querySelector('app-actualizar-datos')).toBeNull();
    });

    it('muestra el error de la API', async () => {
      const p = await montar(undefined, true, 'Finalizar el beneficio');
      const causal = p.el.querySelector<HTMLSelectElement>('#fin-causal')!;
      causal.selectedIndex = 1;
      causal.dispatchEvent(new Event('change'));
      p.escribir('#fin-obs', 'Falleció el 10 de octubre de 2026.');
      p.el
        .querySelector<HTMLInputElement>('app-finalizar-beneficio input[type="checkbox"]')!
        .click();
      await p.asentar();
      p.enviar('app-finalizar-beneficio form');
      p.ctrl
        .expectOne(`${URL}/beneficios/5/finalizar`)
        .flush(errorApi('REVOCATORIA_ABIERTA', 'Este beneficio tiene una revocatoria en curso.'), {
          status: 409,
          statusText: 'Conflicto',
        });
      await p.asentar();
      expect(p.el.querySelector('app-finalizar-beneficio .aviso.error')?.textContent).toContain(
        'revocatoria en curso',
      );
    });
  });

  describe('actualizar datos', () => {
    it('cambia el correo con justificación y soporte', async () => {
      const p = await montar(undefined, true, 'Actualizar datos de la persona');
      p.escribir('#dat-dato', 'CORREO');
      await p.asentar();
      p.escribir('#dat-correo', 'nuevo@correo.com');
      p.escribir('#dat-just', 'La persona cambió de correo electrónico.');
      archivo(p.el, '#dat-archivo');
      await p.asentar();
      p.enviar('app-actualizar-datos form');
      const r = p.ctrl.expectOne(`${URL}/beneficios/5/datos`);
      expect(JSON.parse((r.request.body as FormData).get('datos') as string)).toEqual({
        dato: 'CORREO',
        justificacion: 'La persona cambió de correo electrónico.',
        correo: 'nuevo@correo.com',
      });
      r.flush(expediente(), { status: 201, statusText: 'Creado' });
      await p.asentar();
      p.ctrl.expectOne(`${URL}/beneficios/5`).flush(expediente());
      await p.asentar();
      expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('Dato actualizado');
    });

    it('para el cuidador pide su identificación y avisa que falta su tarjeta', async () => {
      const p = await montar(undefined, true, 'Actualizar datos de la persona');
      p.escribir('#dat-dato', 'CUIDADOR');
      await p.asentar();
      expect(p.el.querySelector('#dat-numero')).not.toBeNull();
      expect(p.el.querySelector('#dat-correo')).toBeNull();
    });

    it('sin soporte no envía', async () => {
      const p = await montar(undefined, true, 'Actualizar datos de la persona');
      p.escribir('#dat-dato', 'CORREO');
      await p.asentar();
      p.escribir('#dat-correo', 'nuevo@correo.com');
      p.escribir('#dat-just', 'La persona cambió de correo electrónico.');
      p.enviar('app-actualizar-datos form');
      await p.asentar();
      p.ctrl.expectNone((r) => r.method === 'POST');
      expect(p.el.querySelector('app-actualizar-datos .aviso.error')?.textContent).toContain(
        'soporte',
      );
    });

    it('muestra el historial de actualizaciones con el valor anterior y el nuevo', async () => {
      const p = await montar(
        expediente({
          actualizaciones: [
            {
              id: 1,
              dato: 'CORREO',
              anterior: { correo: 'viejo@correo.com' },
              nuevo: { correo: 'nuevo@correo.com' },
              justificacion: 'Cambió de correo.',
              evidencia: { nombre: 'soporte.pdf', tamanoBytes: 100 },
              responsable: 'gestor',
              creadaAt: '2026-10-19T10:00:00Z',
            },
          ],
        }),
      );
      const texto = p.el.textContent ?? '';
      expect(texto).toContain('Actualizaciones de datos');
      expect(texto).toContain('viejo@correo.com');
      expect(texto).toContain('nuevo@correo.com');
    });

    it('quien no gestiona no ve las acciones', async () => {
      const p = await montar(expediente(), false);
      expect(p.el.querySelector('app-finalizar-beneficio')).toBeNull();
      expect(p.el.querySelector('app-actualizar-datos')).toBeNull();
    });
  });
});
