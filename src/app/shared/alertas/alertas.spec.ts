import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alertas } from './alertas';

describe('Alertas · barra de carga', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('no aparece en las respuestas rápidas', () => {
    const a = new Alertas();
    a.iniciarCarga();
    vi.advanceTimersByTime(100);
    a.terminarCarga();
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('.carga-global')).toBeNull();
  });

  it('aparece si tarda y se retira cuando termina la última petición', () => {
    const a = new Alertas();
    a.iniciarCarga();
    a.iniciarCarga();
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.carga-global')).not.toBeNull();
    a.terminarCarga();
    expect(document.querySelector('.carga-global')).not.toBeNull();
    a.terminarCarga();
    expect(document.querySelector('.carga-global')).toBeNull();
  });

  it('se retira sola si algo falla y nunca termina', () => {
    const a = new Alertas();
    a.iniciarCarga();
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.carga-global')).not.toBeNull();
    vi.advanceTimersByTime(91_000);
    expect(document.querySelector('.carga-global')).toBeNull();
  });
});
