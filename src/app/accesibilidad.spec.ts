import axe from 'axe-core';
import { vi } from 'vitest';
import { API_BASE } from './core/api/api';
import { AyudaPage } from './features/ciudadano/ayuda/ayuda-page';
import { ConsultaPage } from './features/ciudadano/consulta/consulta-page';
import { InicioPage } from './features/ciudadano/inicio/inicio-page';
import { PreinscripcionPage } from './features/ciudadano/preinscripcion/preinscripcion-page';
import { ReenviarVerificacionPage } from './features/ciudadano/reenviar-verificacion/reenviar-verificacion-page';
import { montarPantalla } from './testing/config';

const FORMULARIO = {
  abierta: true,
  anio: 2026,
  tiposIdentificacion: [
    { id: 1, codigo: 'CC', nombre: 'Cédula de Ciudadanía' },
    { id: 4, codigo: 'CE', nombre: 'Cédula de Extranjería' },
  ],
  localidades: [{ id: 10, nombre: 'Riomar' }],
  barrios: [{ id: 100, nombre: 'Altamira', localidadId: 10 }],
  autorizacion: { version: 1, contenido: 'AUTORIZACIÓN. Ley 1581 de 2012.' },
  formularioToken: 'token',
};

/**
 * Revisión automática de accesibilidad (WCAG 2.1 A y AA) de las pantallas del portal ciudadano. Es lo que los lectores de
 * pantalla (VoiceOver, TalkBack, NVDA…) necesitan de la página: nombres, etiquetas, roles y estructura. El contraste de
 * colores no se puede medir en este entorno: se revisa aparte.
 */
async function revisar(el: HTMLElement) {
  document.body.appendChild(el);
  try {
    const r = await axe.run(el, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: {
        'color-contrast': { enabled: false },
        // Una pantalla suelta no trae sus «landmarks» de página: los pone el marco (header/main).
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
      },
    });
    return r.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    );
  } finally {
    el.remove();
  }
}

describe('accesibilidad del portal ciudadano (lectores de pantalla)', () => {
  // Revisar un formulario grande con axe tarda: con toda la suite en paralelo necesita más de los 5 segundos por defecto.
  vi.setConfig({ testTimeout: 30_000 });

  it('inicio: sin errores de accesibilidad', async () => {
    const { el, asentar } = montarPantalla(InicioPage);
    await asentar();
    expect(await revisar(el)).toEqual([]);
  });

  it('guía paso a paso: sin errores de accesibilidad', async () => {
    const { el, asentar } = montarPantalla(AyudaPage);
    await asentar();
    expect(await revisar(el)).toEqual([]);
  });

  it('preinscripción: cada campo con su etiqueta, ayuda y error', async () => {
    const p = montarPantalla(PreinscripcionPage);
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush(FORMULARIO);
    await p.asentar();
    expect(await revisar(p.el)).toEqual([]);
  });

  it('preinscripción con errores a la vista: los errores están ligados a sus campos', async () => {
    const p = montarPantalla(PreinscripcionPage);
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush(FORMULARIO);
    await p.asentar();
    p.enviar('form');
    await p.asentar();
    expect(await revisar(p.el)).toEqual([]);
  });

  it('consulta del estado: sin errores de accesibilidad', async () => {
    const p = montarPantalla(ConsultaPage);
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush(FORMULARIO);
    await p.asentar();
    expect(await revisar(p.el)).toEqual([]);
  });

  it('reenviar la verificación: sin errores de accesibilidad', async () => {
    const p = montarPantalla(ReenviarVerificacionPage);
    await p.asentar();
    expect(await revisar(p.el)).toEqual([]);
  });
});
