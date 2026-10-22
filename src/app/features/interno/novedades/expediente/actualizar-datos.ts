import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { FormularioPreinscripcion, PublicoApi } from '../../../../core/publico/publico-api';
import { Ayuda } from '../../../../shared/ayuda/ayuda';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Direccion } from '../../../../shared/direccion/direccion';
import { aplicarErroresApi, valorDe } from '../../../../shared/forms';
import { DatoActualizable, DatosActualizacion } from '../modelos-novedades';
import { NovedadesApi } from '../novedades-api';
import { Confirmar } from '../../../../shared/alertas/confirmar';

/**
 * Actualización de datos del beneficiario: dirección, correo o cuidador (RF-BEN-05). Cada cambio exige soporte y
 * justificación y conserva el valor anterior.
 */
@Component({
  selector: 'app-actualizar-datos',
  imports: [Confirmar, ReactiveFormsModule, Campo, CampoControl, Direccion, Ayuda],
  templateUrl: './actualizar-datos.html',
})
export class ActualizarDatos implements OnInit {
  private readonly api = inject(NovedadesApi);
  private readonly publico = inject(PublicoApi);

  readonly beneficioId = input.required<number>();
  /** Si el beneficio incluye a un cuidador, se puede cambiar. */
  readonly conCuidador = input(true);
  readonly hecho = output<string>();

  protected readonly catalogos = signal<FormularioPreinscripcion | null>(null);
  protected readonly error = signal('');
  protected readonly guardando = signal(false);
  protected readonly archivo = signal<File | null>(null);

  protected readonly form = new FormGroup({
    dato: new FormControl<DatoActualizable>('DIRECCION', { nonNullable: true }),
    justificacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(1000)],
    }),
    direccion: new FormControl('', { nonNullable: true }),
    localidadId: new FormControl<number | null>(null),
    barrioId: new FormControl<number | null>(null),
    correo: new FormControl('', { nonNullable: true }),
    tipoIdentificacionId: new FormControl<number | null>(null),
    numeroIdentificacion: new FormControl('', { nonNullable: true }),
    nombre: new FormControl('', { nonNullable: true }),
  });
  protected readonly dato = valorDe(this.form.controls.dato);
  private readonly localidad = valorDe(this.form.controls.localidadId);
  protected readonly barrios = computed(() =>
    (this.catalogos()?.barrios ?? []).filter((b) => b.localidadId === this.localidad()),
  );

  ngOnInit(): void {
    void this.cargarCatalogos();
    this.ajustar();
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      this.catalogos.set(await firstValueFrom(this.publico.formulario()));
    } catch {
      this.catalogos.set(null);
    }
  }

  /** Cada dato exige solo sus campos. */
  protected ajustar(): void {
    const c = this.form.controls;
    const todos = [
      c.direccion,
      c.localidadId,
      c.barrioId,
      c.correo,
      c.tipoIdentificacionId,
      c.numeroIdentificacion,
      c.nombre,
    ];
    for (const x of todos) {
      x.clearValidators();
      x.updateValueAndValidity({ emitEvent: false });
    }
    const dato = c.dato.value;
    if (dato === 'DIRECCION') {
      c.direccion.setValidators([Validators.required]);
      c.localidadId.setValidators([Validators.required]);
      c.barrioId.setValidators([Validators.required]);
    } else if (dato === 'CORREO') {
      c.correo.setValidators([Validators.required, Validators.email, Validators.maxLength(150)]);
    } else {
      c.tipoIdentificacionId.setValidators([Validators.required]);
      c.numeroIdentificacion.setValidators([Validators.required, Validators.maxLength(25)]);
      c.nombre.setValidators([
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(150),
      ]);
    }
    for (const x of todos) x.updateValueAndValidity({ emitEvent: false });
    this.error.set('');
  }

  protected elegirArchivo(e: Event): void {
    this.archivo.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;
    const archivo = this.archivo();
    if (!archivo) {
      this.error.set('Adjunte el soporte del cambio (PDF, JPG o PNG).');
      return;
    }
    const v = this.form.getRawValue();
    const justificacion = v.justificacion.trim();
    let datos: DatosActualizacion;
    if (v.dato === 'DIRECCION') {
      datos = {
        dato: 'DIRECCION',
        justificacion,
        direccion: v.direccion,
        localidadId: Number(v.localidadId),
        barrioId: Number(v.barrioId),
      };
    } else if (v.dato === 'CORREO') {
      datos = { dato: 'CORREO', justificacion, correo: v.correo.trim() };
    } else {
      datos = {
        dato: 'CUIDADOR',
        justificacion,
        tipoIdentificacionId: Number(v.tipoIdentificacionId),
        numeroIdentificacion: v.numeroIdentificacion.trim(),
        nombre: v.nombre.trim(),
      };
    }
    this.guardando.set(true);
    try {
      await firstValueFrom(this.api.actualizarDatos(this.beneficioId(), datos, archivo));
      this.hecho.emit(
        v.dato === 'CUIDADOR'
          ? 'Cuidador actualizado. Registre la entrega de la tarjeta al nuevo cuidador.'
          : 'Dato actualizado.',
      );
      this.form.reset({ dato: v.dato });
      this.archivo.set(null);
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.form, e.errores);
        if (sueltos.length) this.error.set(sueltos.join(' '));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos actualizar el dato.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
