import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { PublicoApi, RevocatoriaPersona } from '../../../core/publico/publico-api';
import { Campo } from '../../../shared/campo';
import { CampoControl } from '../../../shared/campo-control';
import { aplicarErroresApi } from '../../../shared/forms';
import { Confirmar } from '../../../shared/alertas/confirmar';

/**
 * Cuando el beneficio está en un trámite de revocatoria, la persona ve las razones que se le trasladaron y, dentro del
 * plazo, presenta sus descargos desde el portal (RF-BEN-04). Si no hay trámite, no muestra nada.
 */
@Component({
  selector: 'app-descargos',
  imports: [Confirmar, DatePipe, ReactiveFormsModule, Campo, CampoControl],
  templateUrl: './descargos.html',
})
export class Descargos {
  private readonly api = inject(PublicoApi);

  readonly token = input.required<string>();

  protected readonly revocatoria = signal<RevocatoriaPersona | null>(null);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly enviando = signal(false);
  protected readonly archivo = signal<File | null>(null);

  protected readonly form = new FormGroup({
    texto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(4000)],
    }),
  });

  constructor() {
    effect(() => {
      const t = this.token();
      if (t) void this.cargar(t);
    });
  }

  private async cargar(token: string): Promise<void> {
    try {
      this.revocatoria.set((await firstValueFrom(this.api.revocatoria(token))).revocatoria);
    } catch {
      this.revocatoria.set(null);
    }
  }

  protected elegirArchivo(e: Event): void {
    this.archivo.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async enviar(): Promise<void> {
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;
    this.enviando.set(true);
    try {
      const r = await firstValueFrom(
        this.api.presentarDescargos(
          this.token(),
          this.form.controls.texto.value.trim(),
          this.archivo(),
        ),
      );
      this.mensaje.set(r.mensaje);
      await this.cargar(this.token());
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.form, e.errores);
        if (sueltos.length) this.error.set(sueltos.join(' '));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos enviar sus descargos.');
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
