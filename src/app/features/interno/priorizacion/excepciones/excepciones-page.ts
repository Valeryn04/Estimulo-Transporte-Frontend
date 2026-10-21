import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import {
  DecisionPriorizacion,
  EstadoExcepcion,
  Excepcion,
  NOMBRE_ESTADO_EXCEPCION,
} from '../modelos-priorizacion';
import { PriorizacionApi } from '../priorizacion-api';
import { Pestanas } from '../../../../shared/pestanas/pestanas';

/**
 * Excepciones de priorización (RF-PRI-03): los ajustes propuestos con su justificación y evidencia. El responsable del
 * proceso los aprueba o rechaza; nunca quien los propuso. El puntaje calculado se conserva siempre.
 */
@Component({
  selector: 'app-excepciones-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, Dialogo, Pestanas],
  templateUrl: './excepciones-page.html',
  styleUrl: './excepciones-page.scss',
})
export class ExcepcionesPage implements OnInit {
  private readonly api = inject(PriorizacionApi);
  private readonly sesion = inject(Sesion);

  protected readonly items = signal<Excepcion[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly pagina = signal(1);
  protected readonly tamano = 20;
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.tamano)),
  );
  protected readonly estados = NOMBRE_ESTADO_EXCEPCION;
  protected readonly opciones = Object.keys(NOMBRE_ESTADO_EXCEPCION) as EstadoExcepcion[];
  protected readonly estado = new FormControl<'' | EstadoExcepcion>('PROPUESTA', {
    nonNullable: true,
  });
  protected readonly puedeDecidir = computed(() => this.sesion.tiene(PERMISO.priorizacionAprobar));

  // ---- decisión
  protected readonly decidiendo = signal<{ e: Excepcion; decision: DecisionPriorizacion } | null>(
    null,
  );
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly formDecision = new FormGroup({
    motivo: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(pagina = 1): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.pagina.set(pagina);
    try {
      const r = await firstValueFrom(
        this.api.excepciones(this.estado.value || undefined, pagina, this.tamano),
      );
      this.items.set(r.items);
      this.total.set(r.total);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar las excepciones.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Quien propuso la excepción no la decide. */
  protected puedeDecidirEsta(e: Excepcion): boolean {
    return (
      this.puedeDecidir() &&
      e.estado === 'PROPUESTA' &&
      e.propuestaPor !== this.sesion.perfil()?.usuario
    );
  }

  protected signo(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }

  protected async verEvidencia(e: Excepcion): Promise<void> {
    this.error.set('');
    try {
      const blob = await firstValueFrom(this.api.evidencia(e.id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'No pudimos abrir la evidencia.');
    }
  }

  protected abrirDecision(e: Excepcion, decision: DecisionPriorizacion): void {
    this.decidiendo.set({ e, decision });
    this.errorDialogo.set('');
    this.formDecision.reset({ motivo: '' });
  }

  protected cerrar(): void {
    this.decidiendo.set(null);
  }

  protected async decidir(): Promise<void> {
    const d = this.decidiendo();
    if (!d) return;
    const motivo = this.formDecision.controls.motivo.value.trim();
    if (d.decision === 'RECHAZAR' && motivo.length < 5) {
      this.errorDialogo.set('Explique por qué se rechaza (mínimo 5 caracteres).');
      return;
    }
    this.guardando.set(true);
    this.errorDialogo.set('');
    try {
      await firstValueFrom(this.api.decidirExcepcion(d.e.id, d.decision, motivo));
      this.cerrar();
      this.mensaje.set(
        `Excepción de ${d.e.radicado} ${d.decision === 'APROBAR' ? 'aprobada: el ajuste ya cuenta en el listado' : 'rechazada'}.`,
      );
      await this.cargar(this.pagina());
    } catch (e) {
      this.errorDialogo.set(
        e instanceof ApiError ? e.message : 'No pudimos registrar la decisión.',
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
