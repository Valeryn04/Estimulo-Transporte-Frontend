import { montarPantalla } from '../../../testing/config';
import { AyudaPage } from './ayuda-page';

describe('AyudaPage', () => {
  it('explica los cinco pasos y enlaza a las pantallas del portal', async () => {
    const { el, asentar } = montarPantalla(AyudaPage);
    await asentar();
    const pasos = [...el.querySelectorAll('.pasos-guia h2')].map((h) => h.textContent!.trim());
    expect(pasos).toEqual([
      '1. Preinscríbase',
      '2. Verifique su correo',
      '3. Complete la caracterización',
      '4. Cargue los documentos',
      '5. Envíe la solicitud',
    ]);
    expect(el.querySelector('a[href="/preinscripcion"]')).not.toBeNull();
    expect(el.querySelector('a[href="/consulta"]')).not.toBeNull();
    expect(el.textContent).toContain('no equivale a la aprobación del beneficio');
    // La guía explica cómo activar el lector de pantalla (VoiceOver, TalkBack, NVDA).
    const lector = el.querySelector('#lector')!;
    expect(lector.textContent).toContain('VoiceOver');
    expect(lector.textContent).toContain('TalkBack');
    expect(lector.textContent).toContain('NVDA');
    expect(lector.textContent).toContain('formato del documento');
  });

  it('las preguntas frecuentes se pueden abrir con el teclado (elementos details)', async () => {
    const { el, asentar } = montarPantalla(AyudaPage);
    await asentar();
    expect(el.querySelectorAll('details summary').length).toBeGreaterThanOrEqual(4);
  });
});
