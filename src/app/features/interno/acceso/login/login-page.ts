import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthApi } from '../../../../core/auth/auth-api';
import { Sesion } from '../../../../core/auth/sesion';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { TurnstileCasilla } from '../../../../shared/turnstile/turnstile';

/** Ingreso de funcionarios con usuario y contraseña (RF-ADM-01, RNF-05). */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Campo, CampoControl, TurnstileCasilla],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  protected readonly sesion = inject(Sesion);

  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(NonNullableFormBuilder).group({
    usuario: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128)],
    }),
  });

  protected async ingresar(): Promise<void> {
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.cargando.set(true);
    try {
      const { usuario, password } = this.form.getRawValue();
      const r = await firstValueFrom(this.api.login(usuario.trim(), password));
      this.sesion.iniciar(r.token, r.perfil, r.inactividadMinutos);
      await this.router.navigate([
        r.perfil.debeCambiarPassword ? '/interno/cambiar-password' : '/interno',
      ]);
    } catch (e) {
      this.error.set(
        e instanceof ApiError ? e.message : 'No pudimos iniciar su sesión. Intente de nuevo.',
      );
      this.form.controls.password.reset('');
    } finally {
      this.cargando.set(false);
    }
  }
}
