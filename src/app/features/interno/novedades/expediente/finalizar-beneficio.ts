import { Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Ayuda } from '../../../../shared/ayuda/ayuda';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { aplicarErroresApi } from '../../../../shared/forms';
import { NovedadesApi } from '../novedades-api';
import { Confirmar } from '../../../../shared/alertas/confirmar';

/**
 * Finalización del beneficio por fallecimiento, renuncia, fin de vigencia o pérdida de requisitos (RF-BEN-05). Exige
 * causal, justificación y soporte; libera el cupo y avisa a la persona.
 */
@Component({
  selector: 'app-finalizar-beneficio',
  imports: [Confirmar, ReactiveFormsModule, Campo, CampoControl, Ayuda],
  templateUrl: './finalizar-beneficio.html',
})
export class FinalizarBeneficio {
  private readonly api = inject(NovedadesApi);

  readonly beneficioId = input.required<number>();
  readonly causales = input.required<{ id: number; nombre: string }[]>();
  readonly hoy = input.required<string>();
  readonly desde = input.required<string>();
  readonly hecho = output<void>();

  protected readonly error = signal('');
  protected readonly guardando = signal(false);

  protected readonly form = new FormGroup({
    causalId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    fechaEfectiva: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    observacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(1000)],
    }),
    confirmo: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  protected async finalizar(): Promise<void> {
    if (!this.form.value.fechaEfectiva) this.form.controls.fechaEfectiva.setValue(this.hoy());
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.guardando.set(true);
    try {
      await firstValueFrom(
        this.api.finalizar(this.beneficioId(), {
          causalId: Number(v.causalId),
          fechaEfectiva: v.fechaEfectiva,
          observacion: v.observacion.trim(),
        }),
      );
      this.hecho.emit();
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.form, e.errores);
        if (sueltos.length) this.error.set(sueltos.join(' '));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos finalizar el beneficio.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
