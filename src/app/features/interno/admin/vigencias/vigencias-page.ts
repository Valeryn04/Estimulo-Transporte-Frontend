import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { Icono } from '../../../../shared/icono/icono';
import { aplicarErroresApi } from '../../../../shared/forms';
import { ConfigApi } from '../config/config-api';
import { Vigencia } from '../config/modelos-config';

/**
 * Vigencias y cupos (RF-ADM-02, RF-ASG-03): el año del programa, su rango de fechas y los cupos totales.
 * Solo una vigencia está activa a la vez y es la que recibe las preinscripciones.
 */
@Component({
  selector: 'app-vigencias-page',
  imports: [DecimalPipe, ReactiveFormsModule, Campo, CampoControl, Dialogo, Icono],
  templateUrl: './vigencias-page.html',
  styleUrl: './vigencias-page.scss',
})
export class VigenciasPage implements OnInit {
  private readonly api = inject(ConfigApi);

  protected readonly vigencias = signal<Vigencia[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');

  protected readonly abierto = signal(false);
  protected readonly editando = signal<Vigencia | null>(null);
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly form = new FormGroup({
    anio: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(2020),
      Validators.max(2100),
    ]),
    fechaInicio: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fechaFin: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    cuposTotales: new FormControl<number | null>(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(10_000_000),
    ]),
  });

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.vigencias.set(await firstValueFrom(this.api.vigencias()));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar las vigencias.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrirNueva(): void {
    this.editando.set(null);
    this.errorDialogo.set('');
    const anio = (this.vigencias()[0]?.anio ?? new Date().getFullYear()) + 1;
    this.form.controls.anio.enable();
    this.form.reset({
      anio,
      fechaInicio: `${anio}-01-01`,
      fechaFin: `${anio}-12-31`,
      cuposTotales: 0,
    });
    this.abierto.set(true);
  }

  protected abrirEditar(v: Vigencia): void {
    this.editando.set(v);
    this.errorDialogo.set('');
    this.form.reset({
      anio: v.anio,
      fechaInicio: v.fechaInicio,
      fechaFin: v.fechaFin,
      cuposTotales: v.cuposTotales,
    });
    this.form.controls.anio.disable();
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    if (v.fechaFin < v.fechaInicio) {
      this.form.controls.fechaFin.setErrors({
        servidor: 'Fecha final: no puede ser anterior a la inicial',
      });
      return;
    }
    this.guardando.set(true);
    this.errorDialogo.set('');
    const edicion = this.editando();
    const datos = {
      fechaInicio: v.fechaInicio,
      fechaFin: v.fechaFin,
      cuposTotales: v.cuposTotales as number,
    };
    try {
      if (edicion) await firstValueFrom(this.api.actualizarVigencia(edicion.id, datos));
      else await firstValueFrom(this.api.crearVigencia({ ...datos, anio: v.anio as number }));
      this.cerrar();
      this.mensaje.set(
        edicion ? `Vigencia ${edicion.anio} actualizada.` : `Vigencia ${v.anio} creada.`,
      );
      await this.cargar();
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.form, e.errores);
        if (sueltos.length) this.errorDialogo.set(sueltos.join(' '));
      } else {
        this.errorDialogo.set(e instanceof ApiError ? e.message : 'No pudimos guardar.');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  protected async activar(v: Vigencia): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.activarVigencia(v.id));
      this.mensaje.set(`La vigencia ${v.anio} quedó activa: recibe las nuevas preinscripciones.`);
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos activar la vigencia.');
    }
  }
}
