import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { API_BASE } from '../api/api';

interface ApiTurnstile {
  render(
    el: HTMLElement,
    opciones: {
      sitekey: string;
      language?: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): string;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Acciones que exigen la verificación anti-automatización (deben coincidir con las del backend). */
const PROTEGIDAS =
  /\/(publico\/preinscripciones|publico\/preinscripciones\/reenviar-verificacion|publico\/consulta\/solicitar-codigo|auth\/login)$/;

/**
 * Verificación anti-automatización de Cloudflare Turnstile. La llave del sitio la entrega el backend: si no hay,
 * la verificación está desactivada y no se muestra nada.
 */
@Injectable({ providedIn: 'root' })
export class Turnstile {
  private readonly http = inject(HttpClient);
  private cargaScript: Promise<void> | null = null;
  private widgetId: string | null = null;

  /** undefined = aún no se sabe; null = desactivado. */
  readonly siteKey = signal<string | null | undefined>(undefined);
  token: string | null = null;

  async cargarConfig(): Promise<string | null> {
    if (this.siteKey() !== undefined) return this.siteKey()!;
    try {
      const r = await new Promise<{ turnstileSiteKey: string | null }>((ok, error) => {
        this.http.get<{ turnstileSiteKey: string | null }>(`${API_BASE}/publico/config`).subscribe({
          next: ok,
          error,
        });
      });
      this.siteKey.set(r.turnstileSiteKey);
    } catch {
      this.siteKey.set(null);
    }
    return this.siteKey()!;
  }

  private cargarScript(): Promise<void> {
    this.cargaScript ??= new Promise((ok, error) => {
      if (window.turnstile) return ok();
      const s = document.createElement('script');
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => error(new Error('No se pudo cargar la verificación'));
      document.head.appendChild(s);
    });
    return this.cargaScript;
  }

  async mostrar(contenedor: HTMLElement): Promise<void> {
    const sitekey = await this.cargarConfig();
    if (!sitekey) return;
    try {
      await this.cargarScript();
    } catch {
      this.cargaScript = null;
      return;
    }
    this.token = null;
    this.widgetId = window.turnstile!.render(contenedor, {
      sitekey,
      language: 'es',
      callback: (t) => (this.token = t),
      'expired-callback': () => (this.token = null),
      'error-callback': () => (this.token = null),
    });
  }

  quitar(): void {
    if (this.widgetId && window.turnstile) window.turnstile.remove(this.widgetId);
    this.widgetId = null;
    this.token = null;
  }

  /** Cada token sirve una sola vez: tras cada intento se pide uno nuevo. */
  reiniciar(): void {
    this.token = null;
    if (this.widgetId && window.turnstile) window.turnstile.reset(this.widgetId);
  }
}

/** Agrega el token del widget a las peticiones protegidas y lo renueva al terminar. */
export const turnstileInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'POST' || !PROTEGIDAS.test(req.url)) return next(req);
  const t = inject(Turnstile);
  const token = t.token;
  return next(token ? req.clone({ setHeaders: { 'X-Turnstile-Token': token } }) : req).pipe(
    finalize(() => t.reiniciar()),
  );
};
