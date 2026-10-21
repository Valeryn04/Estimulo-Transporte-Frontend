import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { ConfigApi } from '../config/config-api';
import { EstadoAutorizacion } from '../config/modelos-config';
import { Pestanas } from '../../../../shared/pestanas/pestanas';

/**
 * Texto de autorización de tratamiento de datos personales (RF-PRE-03). Cada cambio genera una versión
 * nueva sin afectar las aceptaciones anteriores, que conservan la versión que aceptaron.
 */
@Component({
  selector: 'app-autorizacion-page',
  imports: [DatePipe, ReactiveFormsModule, Campo, CampoControl, Pestanas],
  templateUrl: './autorizacion-page.html',
  styleUrl: './autorizacion-page.scss',
})
export class AutorizacionPage implements OnInit {
  private readonly api = inject(ConfigApi);

  protected readonly estado = signal<EstadoAutorizacion | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly guardando = signal(false);
  protected readonly verVersion = signal<number | null>(null);
  protected readonly contenido = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(50), Validators.maxLength(20000)],
  });

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const e = await firstValueFrom(this.api.autorizacion());
      this.estado.set(e);
      this.contenido.setValue(e.vigente?.contenido ?? '');
      this.contenido.markAsPristine();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar el texto.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected alternarVersion(v: number): void {
    this.verVersion.update((actual) => (actual === v ? null : v));
  }

  protected async publicar(evento?: Event): Promise<void> {
    evento?.preventDefault(); // sin FormGroup, el formulario nativo recargaría la página
    this.contenido.markAsTouched();
    if (this.contenido.invalid) return;
    this.guardando.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      const r = await firstValueFrom(this.api.publicarAutorizacion(this.contenido.value.trim()));
      this.mensaje.set(
        `Se publicó la versión ${r.version}. Rige para las nuevas preinscripciones.`,
      );
      await this.cargar();
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        this.contenido.setErrors({ servidor: e.errores.map((x) => x.mensaje).join(' ') });
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos publicar el texto.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
