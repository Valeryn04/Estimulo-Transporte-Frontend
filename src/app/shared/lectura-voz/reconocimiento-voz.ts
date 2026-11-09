import { Injectable } from '@angular/core';

export type ResultadoEscucha =
  | { ok: true; texto: string }
  | { ok: false; motivo: 'no-soportado' | 'sin-voz' | 'permiso' | 'error' };

interface Reconocedor {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type ConstructorReconocedor = new () => Reconocedor;

/**
 * Reconocimiento de voz del navegador (Web Speech API). Atención: Chrome, Edge y Android envían el audio al servicio de
 * voz del fabricante para convertirlo en texto; por eso el asistente no lo usa para datos sensibles.
 */
@Injectable({ providedIn: 'root' })
export class ReconocimientoVoz {
  private readonly ctor: ConstructorReconocedor | null = (() => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
      SpeechRecognition?: ConstructorReconocedor;
      webkitSpeechRecognition?: ConstructorReconocedor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  })();

  readonly soportado = this.ctor !== null;
  private actual: Reconocedor | null = null;

  /** Un pitido corto: avisa «ya puede hablar» a quien no ve la pantalla. */
  private pitido(): void {
    try {
      const Audio = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
      if (!Audio) return;
      const ctx = new Audio();
      const oscilador = ctx.createOscillator();
      const ganancia = ctx.createGain();
      oscilador.frequency.value = 880;
      ganancia.gain.value = 0.25;
      oscilador.connect(ganancia);
      ganancia.connect(ctx.destination);
      oscilador.start();
      oscilador.stop(ctx.currentTime + 0.15);
      setTimeout(() => void ctx.close(), 400);
    } catch {
      // Sin audio de aviso: la persona igual puede hablar.
    }
  }

  /** Escucha una respuesta. Se corta sola si no oye nada en `tiempoMs`. */
  escuchar(tiempoMs = 10_000): Promise<ResultadoEscucha> {
    const Ctor = this.ctor;
    if (!Ctor) return Promise.resolve({ ok: false, motivo: 'no-soportado' });
    this.cancelar();
    return new Promise((resolver) => {
      const r = new Ctor();
      this.actual = r;
      let resuelto = false;
      const fin = (res: ResultadoEscucha): void => {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(limite);
        if (this.actual === r) this.actual = null;
        resolver(res);
      };
      const limite = setTimeout(() => {
        r.abort();
        fin({ ok: false, motivo: 'sin-voz' });
      }, tiempoMs);
      r.lang = 'es-CO';
      r.interimResults = false;
      r.continuous = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => {
        const texto = e.results[0]?.[0]?.transcript?.trim() ?? '';
        fin(texto ? { ok: true, texto } : { ok: false, motivo: 'sin-voz' });
      };
      r.onerror = (e) => {
        fin({
          ok: false,
          motivo:
            e.error === 'not-allowed' || e.error === 'service-not-allowed'
              ? 'permiso'
              : e.error === 'no-speech' || e.error === 'aborted'
                ? 'sin-voz'
                : 'error',
        });
      };
      r.onend = () => fin({ ok: false, motivo: 'sin-voz' });
      this.pitido();
      try {
        r.start();
      } catch {
        fin({ ok: false, motivo: 'error' });
      }
    });
  }

  cancelar(): void {
    const r = this.actual;
    this.actual = null;
    try {
      r?.abort();
    } catch {
      // Ya estaba detenido.
    }
  }
}
