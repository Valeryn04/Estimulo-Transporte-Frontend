import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MENSAJES_FALLO, PAUSA_ANTES_DE_ESCUCHAR, ReconocimientoVoz } from './reconocimiento-voz';

/** Navegador simulado: el control de cada prueba decide qué «oye» el micrófono. */
class FalsoReconocedor {
  static ultimo: FalsoReconocedor | null = null;
  lang = '';
  interimResults = false;
  maxAlternatives = 1;
  continuous = true;
  onaudiostart: (() => void) | null = null;
  onresult:
    | ((e: {
        resultIndex: number;
        results: { length: number; isFinal: boolean; [i: number]: { transcript: string } }[];
      }) => void)
    | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => {
    FalsoReconocedor.ultimo = this;
  });
  stop = vi.fn();
  abort = vi.fn();

  /** El navegador entrega una interpretación con varias alternativas. */
  decir(alternativas: string[], final = true, indice = 0): void {
    const resultado = Object.assign(
      alternativas.map((transcript) => ({ transcript })),
      { isFinal: final },
    );
    this.onresult?.({ resultIndex: indice, results: [resultado] });
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ReconocimientoVoz', () => {
  beforeEach(() => {
    FalsoReconocedor.ultimo = null;
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: FalsoReconocedor,
      configurable: true,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(window, 'webkitSpeechRecognition');
  });

  const servicio = () => TestBed.inject(ReconocimientoVoz);
  /** Empieza a escuchar y espera a que el micrófono realmente esté abierto (tras la pausa). */
  async function escuchando(tiempo = 12_000) {
    const s = servicio();
    const promesa = s.escuchar(tiempo);
    await espera(PAUSA_ANTES_DE_ESCUCHAR + 60);
    return { s, promesa, r: FalsoReconocedor.ultimo! };
  }

  it('sin reconocimiento de voz en el navegador, lo dice y no falla', async () => {
    Reflect.deleteProperty(window, 'webkitSpeechRecognition');
    TestBed.resetTestingModule();
    const s = servicio();
    expect(s.soportado).toBe(false);
    await expect(s.escuchar()).resolves.toEqual({ ok: false, motivo: 'no-soportado' });
  });

  it('configura español de Colombia, varias alternativas y lo que se va oyendo', async () => {
    const { r, promesa } = await escuchando();
    expect(r.lang).toBe('es-CO');
    expect(r.maxAlternatives).toBeGreaterThan(1);
    expect(r.interimResults).toBe(true);
    expect(r.continuous).toBe(false);
    r.decir(['sí'], true);
    await promesa;
  });

  it('espera un momento antes de abrir el micrófono, para no captar el final de la voz del asistente', async () => {
    const s = servicio();
    const promesa = s.escuchar();
    await espera(PAUSA_ANTES_DE_ESCUCHAR / 2);
    expect(FalsoReconocedor.ultimo).toBeNull();
    await espera(PAUSA_ANTES_DE_ESCUCHAR);
    FalsoReconocedor.ultimo!.decir(['no'], true);
    await promesa;
  });

  it('entrega todas las interpretaciones, la primera como la principal', async () => {
    const { r, promesa } = await escuchando();
    r.decir(['mari a perez', 'maría pérez', 'maria perez']);
    await expect(promesa).resolves.toEqual({
      ok: true,
      texto: 'mari a perez',
      alternativas: ['mari a perez', 'maría pérez', 'maria perez'],
    });
  });

  it('muestra en pantalla lo que va oyendo antes de que termine de hablar', async () => {
    const { s, r, promesa } = await escuchando();
    r.decir(['consul'], false);
    expect(s.parcial()).toBe('consul');
    r.decir(['consultar el estado'], false);
    expect(s.parcial()).toBe('consultar el estado');
    r.decir(['consultar el estado'], true);
    await expect(promesa).resolves.toMatchObject({ ok: true, texto: 'consultar el estado' });
  });

  it('avisa que el micrófono ya está abierto cuando el navegador lo confirma', async () => {
    const { s, r, promesa } = await escuchando();
    expect(s.oyendo()).toBe(false);
    r.onaudiostart?.();
    expect(s.oyendo()).toBe(true);
    r.decir(['sí']);
    await promesa;
    expect(s.oyendo()).toBe(false);
  });

  it('si el navegador avisa el fin un instante antes del resultado, el resultado igual cuenta', async () => {
    const { r, promesa } = await escuchando();
    r.onend?.();
    r.decir(['sí']);
    await expect(promesa).resolves.toMatchObject({ ok: true, texto: 'sí' });
  });

  it('si terminó sin oír nada, o por silencio, dice que no hubo voz', async () => {
    const a = await escuchando();
    a.r.onend?.();
    await expect(a.promesa).resolves.toEqual({ ok: false, motivo: 'sin-voz' });
    const b = await escuchando();
    b.r.onerror?.({ error: 'no-speech' });
    await expect(b.promesa).resolves.toEqual({ ok: false, motivo: 'sin-voz' });
  });

  it('distingue por qué falla el micrófono para poder decírselo a la persona', async () => {
    const casos: [string, string][] = [
      ['not-allowed', 'permiso'],
      ['service-not-allowed', 'permiso'],
      ['audio-capture', 'sin-microfono'],
      ['network', 'red'],
      ['language-not-supported', 'error'],
    ];
    for (const [error, motivo] of casos) {
      const { r, promesa } = await escuchando();
      r.onerror?.({ error });
      await expect(promesa, error).resolves.toEqual({ ok: false, motivo });
    }
    // Cada falla tiene su explicación hablada, que no es «no le entendí».
    for (const motivo of ['permiso', 'sin-microfono', 'red', 'error'] as const) {
      expect(MENSAJES_FALLO[motivo].length).toBeGreaterThan(20);
      expect(MENSAJES_FALLO[motivo]).not.toContain('No le entendí');
    }
    expect(MENSAJES_FALLO.permiso).toContain('Permitir');
  });

  it('si ya oyó algo y el navegador no lo cierra, al acabar el tiempo usa lo oído', async () => {
    const { r, promesa } = await escuchando(300);
    r.decir(['consultar mi estado'], false);
    await expect(promesa).resolves.toMatchObject({ ok: true, texto: 'consultar mi estado' });
    expect(r.abort).toHaveBeenCalled();
  });

  it('cancelar detiene la escucha y cierra el micrófono', async () => {
    const { s, r, promesa } = await escuchando();
    r.onaudiostart?.();
    s.cancelar();
    expect(r.abort).toHaveBeenCalled();
    expect(s.oyendo()).toBe(false);
    r.onend?.();
    await promesa;
  });
});
