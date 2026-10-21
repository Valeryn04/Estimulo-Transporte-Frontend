import { Component, OnInit, Signal, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { PublicoApi, TipoIdentificacion } from '../../../core/publico/publico-api';
import { Campo } from '../../../shared/campo';
import { CampoControl } from '../../../shared/campo-control';
import { valorDe } from '../../../shared/forms';
import { numeroSegunTipo, soloDigitos } from '../../../shared/identificacion';
import { TurnstileCasilla } from '../../../shared/turnstile/turnstile';
import { Ayuda } from '../../../shared/ayuda/ayuda';

/** Reenvío del enlace de verificación del correo cuando venció o no llegó (RF-PRE-04). */
@Component({
  selector: 'app-reenviar-verificacion-page',
  imports: [ReactiveFormsModule, RouterLink, Campo, CampoControl, TurnstileCasilla, Ayuda],
  templateUrl: './reenviar-verificacion-page.html',
  styleUrl: './reenviar-verificacion-page.scss',
})
export class ReenviarVerificacionPage implements OnInit {
  private readonly api = inject(PublicoApi);

  protected readonly tipos = signal<TipoIdentificacion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly respuesta = signal('');

  protected readonly form = new FormGroup({
    tipo: new FormControl<number | null>(null, [Validators.required]),
    numero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, numeroSegunTipo(() => this.codigo())],
    }),
  });
  private readonly tipoElegido: Signal<number | null> = valorDe(this.form.controls.tipo);
  protected readonly codigo: Signal<string | undefined> = computed(
    () => this.tipos().find((t) => t.id === this.tipoElegido())?.codigo,
  );
  protected readonly modo = computed(() => (soloDigitos(this.codigo()) ? 'numeric' : 'text'));

  async ngOnInit(): Promise<void> {
    this.form.controls.tipo.valueChanges.subscribe(() =>
      this.form.controls.numero.updateValueAndValidity(),
    );
    try {
      this.tipos.set((await firstValueFrom(this.api.formulario())).tiposIdentificacion);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar el formulario.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected async enviar(evento?: Event): Promise<void> {
    evento?.preventDefault();
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.enviando.set(true);
    try {
      const v = this.form.getRawValue();
      const r = await firstValueFrom(
        this.api.reenviarVerificacion({
          tipoIdentificacionId: v.tipo as number,
          numero: v.numero.trim(),
        }),
      );
      this.respuesta.set(r.mensaje);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos procesar la solicitud.');
    } finally {
      this.enviando.set(false);
    }
  }
}
