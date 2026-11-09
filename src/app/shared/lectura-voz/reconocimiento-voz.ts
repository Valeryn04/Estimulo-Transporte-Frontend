import { Injectable, signal } from '@angular/core';

export type MotivoFallo =
  'no-soportado' | 'sin-voz' | 'permiso' | 'sin-microfono' | 'red' | 'error';

export type ResultadoEscucha =
  | {
      ok: true;
      /** Lo que más probablemente se dijo. */
      texto: string;
      /** Todas las interpretaciones que dio el navegador (la primera es `texto`). */
      alternativas: string[];
    }
  | { ok: false; motivo: MotivoFallo };

interface Alternativa {
  transcript: string;
}
interface Resultado {
  length: number;
  isFinal: boolean;
  [i: number]: Alternativa;
}
interface Reconocedor {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Resultado> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type ConstructorReconocedor = new () => Reconocedor;

/** Lo que se le dice a la persona cuando el micrófono no sirve, para que sepa qué hacer (no «no le entendí»). */
export const MENSAJES_FALLO: Record<Exclude<MotivoFallo, 'sin-voz'>, string> = {
  'no-soportado':
    'Este navegador no permite responder hablando. Use los botones grandes o escriba la respuesta.',
  permiso:
    'No tengo permiso para usar el micrófono. Cuando el navegador pregunte, toque Permitir. Si ya lo negó, active el micrófono en la configuración del sitio. Mientras tanto, use los botones grandes.',
  'sin-microfono':
    'No encuentro un micrófono en este equipo. Use los botones grandes o escriba la respuesta.',
  red: 'El reconocimiento de voz necesita conexión a internet y no la encuentro. Use los botones grandes o escriba la respuesta.',
  error: 'No pude usar el micrófono. Use los botones grandes o escriba la respuesta.',
};

/** Espera tras terminar de hablar el asistente, para que el micrófono no capte el final de su propia voz. */
export const PAUSA_ANTES_DE_ESCUCHAR = 350;

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
  /** El micrófono está abierto ahora mismo. */
  readonly oyendo = signal(false);
  /** Lo que se va oyendo mientras la persona habla (para mostrarlo en pantalla). */
  readonly parcial = signal('');
  private actual: Reconocedor | null = null;

  /** Un pitido corto: avisa «ya puede hablar» a quien no ve la pantalla. Suena cuando el micrófono ya está abierto. */
  private pitido(): void {
    try {
      const Audio = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
      if (!Audio) return;
      const ctx = new Audio();
      const oscilador = ctx.createOscillator();
      const ganancia = ctx.createGain();
      oscilador.frequency.value = 880;
      ganancia.gain.value = 0.2;
      oscilador.connect(ganancia);
      ganancia.connect(ctx.destination);
      oscilador.start();
      oscilador.stop(ctx.currentTime + 0.12);
      setTimeout(() => void ctx.close(), 400);
    } catch {
      // Sin audio de aviso: la persona igual puede hablar.
    }
  }

  /** Escucha una respuesta. Se corta sola si no oye nada en `tiempoMs`. */
  async escuchar(tiempoMs = 12_000): Promise<ResultadoEscucha> {
    const Ctor = this.ctor;
    if (!Ctor) return { ok: false, motivo: 'no-soportado' };
    this.cancelar();
    // Se espera un momento: así el micrófono no capta el final de la voz del asistente.
    await new Promise((r) => setTimeout(r, PAUSA_ANTES_DE_ESCUCHAR));
    return new Promise((resolver) => {
      const r = new Ctor();
      this.actual = r;
      let resuelto = false;
      let ultimoFinal: string[] | null = null;
      let ultimoParcial = '';
      const fin = (res: ResultadoEscucha): void => {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(limite);
        this.oyendo.set(false);
        if (this.actual === r) this.actual = null;
        resolver(res);
      };
      const limite = setTimeout(() => {
        // Si ya se oyó algo pero el navegador no lo cerró, se usa lo oído.
        const oido = ultimoFinal ?? (ultimoParcial ? [ultimoParcial] : null);
        r.abort();
        fin(
          oido
            ? { ok: true, texto: oido[0]!, alternativas: oido }
            : { ok: false, motivo: 'sin-voz' },
        );
      }, tiempoMs);
      r.lang = 'es-CO';
      // Se muestra lo que se va oyendo y se piden varias interpretaciones: la correcta no siempre es la primera.
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 4;
      r.onaudiostart = () => {
        // El micrófono ya está abierto: ahora sí el aviso de «hable».
        this.oyendo.set(true);
        this.pitido();
      };
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]!;
          const alternativas = Array.from({ length: res.length }, (_, k) =>
            res[k]!.transcript.trim(),
          ).filter(Boolean);
          if (alternativas.length === 0) continue;
          if (res.isFinal) {
            ultimoFinal = alternativas;
            this.parcial.set(alternativas[0]!);
            fin({ ok: true, texto: alternativas[0]!, alternativas });
            return;
          }
          ultimoParcial = alternativas[0]!;
          this.parcial.set(ultimoParcial);
        }
      };
      r.onerror = (e) => {
        const motivo: MotivoFallo =
          e.error === 'not-allowed' || e.error === 'service-not-allowed'
            ? 'permiso'
            : e.error === 'no-speech' || e.error === 'aborted'
              ? 'sin-voz'
              : e.error === 'audio-capture'
                ? 'sin-microfono'
                : e.error === 'network'
                  ? 'red'
                  : 'error';
        fin({ ok: false, motivo });
      };
      // Algunos navegadores avisan el fin un instante antes del resultado: se le da un respiro.
      r.onend = () =>
        setTimeout(() => {
          const oido = ultimoFinal ?? (ultimoParcial ? [ultimoParcial] : null);
          fin(
            oido
              ? { ok: true, texto: oido[0]!, alternativas: oido }
              : { ok: false, motivo: 'sin-voz' },
          );
        }, 200);
      this.parcial.set('');
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
    this.oyendo.set(false);
    try {
      r?.abort();
    } catch {
      // Ya estaba detenido.
    }
  }
}
