import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { aplicarErroresApi } from '../../../../shared/forms';
import { NOMBRE_ESTADO_BENEFICIO } from '../../asignacion/modelos-asignacion';
import {
  ActualizacionDatos,
  ExpedienteNovedades,
  NOMBRE_DATO,
  NOMBRE_ESTADO_REVOCATORIA,
  Novedad,
  TipoNovedad,
} from '../modelos-novedades';
import { NovedadesApi } from '../novedades-api';
import { Ayuda } from '../../../../shared/ayuda/ayuda';
import { ActualizarDatos } from './actualizar-datos';
import { FinalizarBeneficio } from './finalizar-beneficio';
import { Confirmar } from '../../../../shared/alertas/confirmar';

/**
 * Expediente de novedades de un beneficio: la secuencia completa de bloqueos, suspensiones y reactivaciones con sus
 * causales, fechas y evidencias (RF-NOV-01); desde aquí también se inicia una revocatoria (RF-NOV-02).
 */
@Component({
  selector: 'app-expediente-beneficio',
  imports: [
    Confirmar,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Campo,
    CampoControl,
    Dialogo,
    Ayuda,
    FinalizarBeneficio,
    ActualizarDatos,
  ],
  templateUrl: './expediente-beneficio.html',
  styleUrl: './expediente-beneficio.scss',
})
export class ExpedienteBeneficio {
  private readonly api = inject(NovedadesApi);

  readonly beneficioId = input.required<number | null>();
  readonly puedeGestionar = input(false);
  readonly cierra = output<void>();
  readonly cambio = output<void>();

  protected readonly datos = signal<ExpedienteNovedades | null>(null);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly guardando = signal(false);
  protected readonly evidencia = signal<File | null>(null);
  protected readonly evidenciaRev = signal<File | null>(null);
  protected readonly estados = NOMBRE_ESTADO_BENEFICIO;
  protected readonly estadoRev = NOMBRE_ESTADO_REVOCATORIA;
  protected readonly tipo = signal<TipoNovedad>('BLOQUEO');
  /** Qué se está haciendo: se muestra un solo formulario a la vez. */
  protected readonly accion = signal<'NOVEDAD' | 'DATOS' | 'REVOCATORIA' | 'FINALIZAR' | null>(
    null,
  );
  protected readonly nombreDato = NOMBRE_DATO;
  protected readonly puedeFinalizar = computed(
    () => this.puedeGestionar() && this.datos()?.beneficio.estado !== 'FINALIZADO',
  );

  /** Lo que se puede hacer según el estado: bloquear o suspender un beneficio activo, reactivar uno detenido. */
  protected readonly tiposPosibles = computed<{ valor: TipoNovedad; nombre: string }[]>(() => {
    const estado = this.datos()?.beneficio.estado;
    if (estado === 'ACTIVO') {
      return [
        { valor: 'BLOQUEO', nombre: 'Bloqueo temporal' },
        { valor: 'SUSPENSION', nombre: 'Suspensión' },
      ];
    }
    if (estado === 'BLOQUEADO' || estado === 'SUSPENDIDO') {
      return [{ valor: 'LEVANTAMIENTO', nombre: 'Reactivar el beneficio' }];
    }
    return [];
  });
  /** Nombre del botón de la novedad según el estado: reactivar un beneficio detenido o bloquear/suspender uno activo. */
  protected readonly textoNovedad = computed(() =>
    this.tiposPosibles().some((t) => t.valor === 'LEVANTAMIENTO')
      ? 'Reactivar el beneficio'
      : 'Bloquear o suspender',
  );
  protected readonly hayRevocatoriaAbierta = computed(() =>
    (this.datos()?.revocatorias ?? []).some((r) => r.estado !== 'DECIDIDA'),
  );
  protected readonly puedeRevocar = computed(
    () =>
      this.puedeGestionar() &&
      !this.hayRevocatoriaAbierta() &&
      this.datos()?.beneficio.estado !== 'FINALIZADO',
  );

  protected readonly form = new FormGroup({
    tipo: new FormControl<TipoNovedad>('BLOQUEO', { nonNullable: true }),
    causalId: new FormControl<number | null>(null),
    fechaEfectiva: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    observacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
    levantamientoProgramado: new FormControl('', { nonNullable: true }),
  });
  protected readonly formRev = new FormGroup({
    causalId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(2000)],
    }),
  });

  constructor() {
    effect(() => {
      const id = this.beneficioId();
      if (id === null) {
        this.datos.set(null);
        return;
      }
      void this.cargar(id);
    });
  }

  private async cargar(id: number): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    this.evidencia.set(null);
    this.evidenciaRev.set(null);
    this.accion.set(null);
    try {
      const d = await firstValueFrom(this.api.expediente(id));
      this.datos.set(d);
      const primero = this.tiposPosibles()[0]?.valor ?? 'BLOQUEO';
      this.tipo.set(primero);
      this.form.reset({
        tipo: primero,
        causalId: null,
        fechaEfectiva: d.beneficio.hoy,
        observacion: '',
        levantamientoProgramado: '',
      });
      this.formRev.reset({ causalId: null, descripcion: '' });
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar el beneficio.');
    }
  }

  protected cambiarTipo(): void {
    this.tipo.set(this.form.controls.tipo.value);
  }

  protected elegirEvidencia(e: Event): void {
    this.evidencia.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected elegirEvidenciaRev(e: Event): void {
    this.evidenciaRev.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async registrar(): Promise<void> {
    const d = this.datos();
    if (!d) return;
    this.form.markAllAsTouched();
    this.error.set('');
    const v = this.form.getRawValue();
    if (this.form.invalid) return;
    if (v.tipo !== 'LEVANTAMIENTO' && !v.causalId) {
      this.error.set('Elija la causal de la novedad.');
      return;
    }
    const evidencia = this.evidencia();
    if (!evidencia) {
      this.error.set('Adjunte la evidencia que sustenta la novedad (PDF, JPG o PNG).');
      return;
    }
    this.guardando.set(true);
    try {
      await firstValueFrom(
        this.api.registrarNovedad(
          d.beneficio.id,
          {
            tipo: v.tipo,
            ...(v.causalId ? { causalId: v.causalId } : {}),
            fechaEfectiva: v.fechaEfectiva,
            observacion: v.observacion.trim(),
            ...(v.levantamientoProgramado
              ? { levantamientoProgramado: v.levantamientoProgramado }
              : {}),
          },
          evidencia,
        ),
      );
      await this.cargar(d.beneficio.id);
      this.mensaje.set('Novedad registrada y comunicada a la persona.');
      this.cambio.emit();
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.form, e.errores);
        if (sueltos.length) this.error.set(sueltos.join(' '));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos registrar la novedad.');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  protected async iniciarRevocatoria(): Promise<void> {
    const d = this.datos();
    if (!d) return;
    this.formRev.markAllAsTouched();
    this.error.set('');
    if (this.formRev.invalid) return;
    const evidencia = this.evidenciaRev();
    if (!evidencia) {
      this.error.set('Adjunte la evidencia que sustenta la revocatoria.');
      return;
    }
    const v = this.formRev.getRawValue();
    this.guardando.set(true);
    try {
      await firstValueFrom(
        this.api.iniciarRevocatoria(
          d.beneficio.id,
          { causalId: Number(v.causalId), descripcion: v.descripcion.trim() },
          evidencia,
        ),
      );
      await this.cargar(d.beneficio.id);
      this.mensaje.set(
        'Revocatoria iniciada. El siguiente paso es el traslado de las razones a la persona.',
      );
      this.cambio.emit();
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.formRev, e.errores);
        if (sueltos.length) this.error.set(sueltos.join(' '));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos iniciar la revocatoria.');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  /** Se vuelve a cargar el beneficio después de finalizarlo o de actualizar un dato. */
  protected async alHacer(mensaje: string): Promise<void> {
    const d = this.datos();
    if (!d) return;
    await this.cargar(d.beneficio.id);
    this.mensaje.set(mensaje);
    this.cambio.emit();
  }

  protected valoresDe(v: Record<string, string | null>): string {
    return Object.values(v)
      .filter((x) => x)
      .join(' · ');
  }

  protected async verEvidenciaDatos(a: ActualizacionDatos): Promise<void> {
    this.error.set('');
    try {
      const blob = await firstValueFrom(this.api.evidenciaDatos(a.id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos abrir el soporte.');
    }
  }

  protected async verEvidencia(n: Novedad): Promise<void> {
    this.error.set('');
    try {
      const blob = await firstValueFrom(this.api.evidenciaNovedad(n.id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos abrir la evidencia.');
    }
  }
}
