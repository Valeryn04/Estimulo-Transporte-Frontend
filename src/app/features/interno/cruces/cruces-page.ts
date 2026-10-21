import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { Campo } from '../../../shared/campo';
import { CampoControl } from '../../../shared/campo-control';
import { Dialogo } from '../../../shared/dialogo/dialogo';
import { Icono } from '../../../shared/icono/icono';
import { aplicarErroresApi } from '../../../shared/forms';
import { VersionRegistro } from '../admin/config/modelos-config';
import { CrucesApi } from './cruces-api';
import {
  AlertaNovedad,
  AplicaACruce,
  CargaCruce,
  EstructuraCruce,
  NOMBRE_ALERTA_NOVEDAD,
  NOMBRE_APLICA_CRUCE,
} from './modelos-cruces';
import { Pestanas } from '../../../shared/pestanas/pestanas';

type Vista = 'ninguna' | 'formulario' | 'historial' | 'cargas';

/**
 * Archivos de cruce (RF-ADM-05): para cada fuente externa (apoyos incompatibles, Transmetro, defunciones...) se define
 * en qué columna viene la identificación y se cargan los archivos CSV. Las coincidencias salen como alerta al validador.
 */
@Component({
  selector: 'app-cruces-page',
  imports: [DatePipe, ReactiveFormsModule, Campo, CampoControl, Dialogo, Icono, Pestanas],
  templateUrl: './cruces-page.html',
  styleUrl: './cruces-page.scss',
})
export class CrucesPage implements OnInit {
  private readonly api = inject(CrucesApi);

  protected readonly estructuras = signal<EstructuraCruce[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly aplicaA = NOMBRE_APLICA_CRUCE;
  protected readonly opciones = Object.keys(NOMBRE_APLICA_CRUCE) as AplicaACruce[];

  protected readonly alertas = NOMBRE_ALERTA_NOVEDAD;
  protected readonly opcionesAlerta = Object.keys(NOMBRE_ALERTA_NOVEDAD) as AlertaNovedad[];
  protected readonly causales = signal<{ codigo: string; nombre: string }[]>([]);

  protected readonly vista = signal<Vista>('ninguna');
  protected readonly actual = signal<EstructuraCruce | null>(null);
  protected readonly versiones = signal<VersionRegistro[]>([]);
  protected readonly cargas = signal<CargaCruce[]>([]);
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly archivo = signal<File | null>(null);
  protected readonly subiendo = signal(false);

  protected readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(100)],
    }),
    entidad: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    columnaIdentificacion: new FormControl('IDENTIFICACION', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(60)],
    }),
    columnaDetalle: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(60)],
    }),
    aplicaA: new FormControl<AplicaACruce>('AMBOS', { nonNullable: true }),
    alertaNovedad: new FormControl<AlertaNovedad>('NINGUNA', { nonNullable: true }),
    causalCodigo: new FormControl<string | null>(null),
  });

  ngOnInit(): void {
    void this.cargar();
    void this.cargarCausales();
  }

  private async cargarCausales(): Promise<void> {
    try {
      this.causales.set(await firstValueFrom(this.api.causales()));
    } catch {
      this.causales.set([]);
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.estructuras.set(await firstValueFrom(this.api.listar()));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los cruces.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrirNuevo(): void {
    this.actual.set(null);
    this.errorDialogo.set('');
    this.form.reset({
      nombre: '',
      entidad: '',
      descripcion: '',
      columnaIdentificacion: 'IDENTIFICACION',
      columnaDetalle: '',
      aplicaA: 'AMBOS',
      alertaNovedad: 'NINGUNA',
      causalCodigo: null,
    });
    this.vista.set('formulario');
  }

  protected abrirEditar(e: EstructuraCruce): void {
    this.actual.set(e);
    this.errorDialogo.set('');
    this.form.reset({
      nombre: e.nombre,
      entidad: e.entidad,
      descripcion: e.descripcion,
      columnaIdentificacion: e.columnaIdentificacion,
      columnaDetalle: e.columnaDetalle ?? '',
      aplicaA: e.aplicaA,
      alertaNovedad: e.alertaNovedad,
      causalCodigo: e.causalCodigo,
    });
    this.vista.set('formulario');
  }

  protected cerrar(): void {
    this.vista.set('ninguna');
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.errorDialogo.set('');
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre.trim(),
      entidad: v.entidad.trim(),
      descripcion: v.descripcion.trim(),
      columnaIdentificacion: v.columnaIdentificacion.trim(),
      columnaDetalle: v.columnaDetalle.trim() || null,
      aplicaA: v.aplicaA,
      alertaNovedad: v.alertaNovedad,
      causalCodigo: v.alertaNovedad === 'NINGUNA' ? null : v.causalCodigo,
    };
    const edicion = this.actual();
    try {
      if (edicion) await firstValueFrom(this.api.actualizar(edicion.id, datos));
      else await firstValueFrom(this.api.crear(datos));
      this.cerrar();
      this.mensaje.set(`«${datos.nombre}» ${edicion ? 'actualizado' : 'creado'}.`);
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

  protected async cambiarActivo(e: EstructuraCruce): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.cambiarActivo(e.id, !e.activo));
      this.mensaje.set(`«${e.nombre}» ${e.activo ? 'desactivado' : 'activado'}.`);
      await this.cargar();
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'No pudimos cambiar el estado.');
    }
  }

  protected async verHistorial(e: EstructuraCruce): Promise<void> {
    this.actual.set(e);
    this.versiones.set([]);
    this.errorDialogo.set('');
    this.vista.set('historial');
    try {
      this.versiones.set(await firstValueFrom(this.api.versiones(e.id)));
    } catch (err) {
      this.errorDialogo.set(
        err instanceof ApiError ? err.message : 'No pudimos cargar el historial.',
      );
    }
  }

  protected resumenVersion(v: VersionRegistro): string {
    const s = v.snapshot as { nombre?: string; activo?: boolean };
    return `${s.nombre ?? ''} · ${s.activo ? 'activa' : 'inactiva'}`;
  }

  // ---------------------------------------------------------------- cargas

  protected async abrirCargas(e: EstructuraCruce): Promise<void> {
    this.actual.set(e);
    this.cargas.set([]);
    this.archivo.set(null);
    this.errorDialogo.set('');
    this.vista.set('cargas');
    await this.recargarCargas(e);
  }

  private async recargarCargas(e: EstructuraCruce): Promise<void> {
    try {
      this.cargas.set(await firstValueFrom(this.api.cargas(e.id)));
    } catch (err) {
      this.errorDialogo.set(
        err instanceof ApiError ? err.message : 'No pudimos cargar el historial.',
      );
    }
  }

  protected elegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.archivo.set(input.files?.[0] ?? null);
  }

  protected async subir(): Promise<void> {
    const e = this.actual();
    const archivo = this.archivo();
    if (!e) return;
    if (!archivo) {
      this.errorDialogo.set('Seleccione el archivo CSV que desea cargar.');
      return;
    }
    this.subiendo.set(true);
    this.errorDialogo.set('');
    try {
      const carga = await firstValueFrom(this.api.cargar(e.id, archivo));
      this.archivo.set(null);
      this.mensaje.set(
        `Se cargaron ${carga.filasValidas} registro(s) de «${e.nombre}»` +
          (carga.filasError > 0
            ? `; ${carga.filasError} fila(s) tenían errores y no se cargaron.`
            : '.'),
      );
      await this.recargarCargas(e);
      await this.cargar();
    } catch (err) {
      this.errorDialogo.set(
        err instanceof ApiError
          ? err.errores.length > 0
            ? err.errores.map((x) => x.mensaje).join(' ')
            : err.message
          : 'No pudimos cargar el archivo.',
      );
    } finally {
      this.subiendo.set(false);
    }
  }

  protected async descargarErrores(c: CargaCruce): Promise<void> {
    this.errorDialogo.set('');
    try {
      const blob = await firstValueFrom(this.api.errores(c.id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `errores-carga-${c.id}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      this.errorDialogo.set(
        err instanceof ApiError ? err.message : 'No pudimos descargar el reporte.',
      );
    }
  }
}
