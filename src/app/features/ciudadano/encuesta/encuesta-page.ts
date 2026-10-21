import { Component, OnInit, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { EncuestaApi, EncuestaPublica, PreguntaPublica } from '../../../core/publico/encuesta-api';
import { ocultarTokenEnLaUrl } from '../../../shared/enlace';
import { Ayuda } from '../../../shared/ayuda/ayuda';

type Paso =
  'cargando' | 'responder' | 'gracias' | 'ya-respondida' | 'cerrada' | 'invalida' | 'error';

/**
 * Encuesta de satisfacción (RF-NOV-04). Se entra con el enlace personal del correo; se responde una sola vez y las
 * respuestas se analizan sin identificar a la persona.
 */
@Component({
  selector: 'app-encuesta-page',
  imports: [RouterLink, Ayuda],
  templateUrl: './encuesta-page.html',
  styleUrl: './encuesta-page.scss',
})
export class EncuestaPage implements OnInit {
  private readonly api = inject(EncuestaApi);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  /** Parámetro de consulta `?token=` (enlazado por el enrutador). */
  readonly token = input<string>();

  protected readonly paso = signal<Paso>('cargando');
  protected readonly encuesta = signal<EncuestaPublica | null>(null);
  protected readonly respuestas = signal<Record<string, string | number>>({});
  protected readonly faltan = signal<ReadonlySet<number>>(new Set());
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  private enlace = '';

  async ngOnInit(): Promise<void> {
    this.enlace = this.token() ?? '';
    if (!this.enlace) {
      this.paso.set('invalida');
      return;
    }
    ocultarTokenEnLaUrl(this.router, this.ruta);
    try {
      this.encuesta.set(await firstValueFrom(this.api.obtener(this.enlace)));
      this.paso.set('responder');
    } catch (e) {
      this.paso.set(this.pasoDeError(e));
    }
  }

  private pasoDeError(e: unknown): Paso {
    if (e instanceof ApiError) {
      if (e.codigo === 'ENCUESTA_YA_RESPONDIDA') return 'ya-respondida';
      if (e.codigo === 'ENCUESTA_CERRADA') return 'cerrada';
      if (e.codigo === 'ENCUESTA_ENLACE_INVALIDO' || e.estado === 422 || e.estado === 404)
        return 'invalida';
      this.error.set(e.message);
    } else {
      this.error.set('No pudimos abrir la encuesta. Intente de nuevo.');
    }
    return 'error';
  }

  protected valor(p: PreguntaPublica): string | number | undefined {
    return this.respuestas()[String(p.id)];
  }

  protected escala(p: PreguntaPublica): number[] {
    return Array.from({ length: p.escalaMax ?? 5 }, (_, i) => i + 1);
  }

  protected elegir(p: PreguntaPublica, valor: string | number): void {
    const nuevo = { ...this.respuestas() };
    if (valor === '') delete nuevo[String(p.id)];
    else nuevo[String(p.id)] = valor;
    this.respuestas.set(nuevo);
    const f = new Set(this.faltan());
    f.delete(p.id);
    this.faltan.set(f);
  }

  protected async enviar(): Promise<void> {
    const e = this.encuesta();
    if (!e) return;
    const faltan = new Set(
      e.preguntas.filter((p) => p.obligatoria && this.valor(p) === undefined).map((p) => p.id),
    );
    this.faltan.set(faltan);
    this.error.set('');
    if (faltan.size > 0) {
      this.error.set('Responda las preguntas obligatorias marcadas.');
      return;
    }
    this.enviando.set(true);
    try {
      await firstValueFrom(this.api.responder(this.enlace, this.respuestas()));
      this.paso.set('gracias');
    } catch (err) {
      if (err instanceof ApiError && err.errores.length > 0) {
        this.faltan.set(new Set(err.errores.map((x) => Number(x.campo))));
        this.error.set(err.errores.map((x) => x.mensaje).join(' '));
      } else {
        const paso = this.pasoDeError(err);
        if (paso !== 'error') this.paso.set(paso);
        else
          this.error.set(
            err instanceof ApiError ? err.message : 'No pudimos enviar sus respuestas.',
          );
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
