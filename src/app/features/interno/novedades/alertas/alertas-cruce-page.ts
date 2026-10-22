import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { AlertaCruce, EstadoAlertaCruce } from '../modelos-novedades';
import { NovedadesApi } from '../novedades-api';
import { Pestanas } from '../../../../shared/pestanas/pestanas';
import { Confirmar } from '../../../../shared/alertas/confirmar';

const NOMBRE_ESTADO: Record<EstadoAlertaCruce, string> = {
  PENDIENTE: 'Pendiente de análisis',
  DESCARTADA: 'Descartada',
  EN_TRAMITE: 'Revocatoria en trámite',
};

/**
 * Alertas de los cruces periódicos (RF-NOV-03): coincidencias de los archivos de defunciones, uso de tarjetas y
 * beneficios incompatibles con los beneficios vigentes. El gestor las analiza antes de cualquier actuación: una alerta
 * nunca finaliza ni cambia un beneficio.
 */
@Component({
  selector: 'app-alertas-cruce-page',
  imports: [Confirmar, DatePipe, ReactiveFormsModule, RouterLink, Dialogo, Pestanas],
  templateUrl: './alertas-cruce-page.html',
  styleUrl: './alertas-cruce-page.scss',
})
export class AlertasCrucePage implements OnInit {
  private readonly api = inject(NovedadesApi);
  private readonly sesion = inject(Sesion);

  protected readonly datos = signal<{ items: AlertaCruce[]; total: number } | null>(null);
  protected readonly pagina = signal(1);
  protected readonly tamano = 25;
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.datos()?.total ?? 0) / this.tamano)),
  );
  protected readonly nombres = NOMBRE_ESTADO;
  protected readonly opciones = Object.keys(NOMBRE_ESTADO) as EstadoAlertaCruce[];
  protected readonly estado = new FormControl<'' | EstadoAlertaCruce>('PENDIENTE', {
    nonNullable: true,
  });
  protected readonly puedeGestionar = computed(() => this.sesion.tiene(PERMISO.novedadesGestionar));

  // ---- análisis
  protected readonly analizando = signal<AlertaCruce | null>(null);
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly archivo = signal<File | null>(null);
  protected readonly form = new FormGroup({
    accion: new FormControl<'DESCARTAR' | 'INICIAR_REVOCATORIA'>('DESCARTAR', {
      nonNullable: true,
    }),
    observacion: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    void this.buscar();
  }

  protected async buscar(pagina = 1): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.pagina.set(pagina);
    try {
      this.datos.set(
        await firstValueFrom(
          this.api.alertasCruce(this.estado.value || undefined, pagina, this.tamano),
        ),
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar las alertas.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrir(a: AlertaCruce): void {
    this.analizando.set(a);
    this.errorDialogo.set('');
    this.archivo.set(null);
    this.form.reset({ accion: 'DESCARTAR', observacion: '' });
  }

  protected cerrar(): void {
    this.analizando.set(null);
  }

  protected elegirArchivo(evento: Event): void {
    this.archivo.set((evento.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async analizar(): Promise<void> {
    const a = this.analizando();
    if (!a) return;
    const v = this.form.getRawValue();
    if (v.observacion.trim().length < 10) {
      this.errorDialogo.set('Explique el análisis (mínimo 10 caracteres).');
      return;
    }
    if (v.accion === 'INICIAR_REVOCATORIA' && !this.archivo()) {
      this.errorDialogo.set('Adjunte la evidencia que sustenta la revocatoria.');
      return;
    }
    this.guardando.set(true);
    this.errorDialogo.set('');
    try {
      await firstValueFrom(
        this.api.analizarAlerta(
          a.id,
          { accion: v.accion, observacion: v.observacion.trim() },
          this.archivo(),
        ),
      );
      this.cerrar();
      this.mensaje.set(
        v.accion === 'DESCARTAR'
          ? 'Alerta descartada: el beneficio no cambió.'
          : 'Se inició la revocatoria. Continúe con el traslado en «Revocatorias».',
      );
      await this.buscar(this.pagina());
    } catch (e) {
      this.errorDialogo.set(
        e instanceof ApiError
          ? e.errores.length > 0
            ? e.errores.map((x) => x.mensaje).join(' ')
            : e.message
          : 'No pudimos registrar el análisis.',
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
