import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthApi } from '../../../../core/auth/auth-api';
import { Sesion } from '../../../../core/auth/sesion';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { igualA, valorDe } from '../../../../shared/forms';
import { passwordValida } from '../../../../shared/requisitos-password/politica-password';
import { RequisitosPassword } from '../../../../shared/requisitos-password/requisitos-password';

/**
 * Cambio de contraseña del funcionario. Es obligatorio en el primer ingreso (contraseña temporal) y
 * cuando la contraseña venció (RF-ADM-01).
 */
@Component({
  selector: 'app-cambiar-password-page',
  imports: [ReactiveFormsModule, Campo, CampoControl, RequisitosPassword],
  templateUrl: './cambiar-password-page.html',
})
export class CambiarPasswordPage {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  protected readonly sesion = inject(Sesion);

  protected readonly cargando = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup({
    actual: new FormControl('', { nonNullable: true }),
    nueva: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        (c) =>
          c.value && !passwordValida(c.value, this.sesion.perfil()?.usuario)
            ? { politica: true }
            : null,
      ],
    }),
    confirmacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, igualA('nueva')],
    }),
  });
  protected readonly passwordNueva = valorDe(this.form.controls.nueva);
  /** Con la contraseña temporal (primer ingreso o vencida) no se pide la actual: acaba de usarla para entrar. */
  protected readonly pideActual = computed(() => !this.sesion.perfil()?.debeCambiarPassword);

  constructor() {
    effect(() => {
      const c = this.form.controls.actual;
      c.setValidators(this.pideActual() ? [Validators.required] : []);
      c.updateValueAndValidity({ emitEvent: false });
    });
    this.form.controls.nueva.valueChanges.subscribe(() =>
      this.form.controls.confirmacion.updateValueAndValidity({ emitEvent: false }),
    );
  }

  protected async guardar(): Promise<void> {
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.cargando.set(true);
    try {
      const { actual, nueva } = this.form.getRawValue();
      const r = await firstValueFrom(
        this.api.cambiarPassword(this.pideActual() ? actual : null, nueva),
      );
      // El cambio cerró todas las sesiones anteriores: la API abrió una nueva (cookie y token nuevos).
      this.sesion.iniciar(r.token, r.perfil, r.inactividadMinutos);
      await this.router.navigate(['/interno']);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cambiar la contraseña.');
    } finally {
      this.cargando.set(false);
    }
  }
}
