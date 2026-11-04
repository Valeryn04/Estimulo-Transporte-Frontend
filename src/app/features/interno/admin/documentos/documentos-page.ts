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
import { AplicaA, DocumentoRequerido, NOMBRE_APLICA_A } from '../config/modelos-config';
import { Pestanas } from '../../../../shared/pestanas/pestanas';
import { Confirmar } from '../../../../shared/alertas/confirmar';

/**
 * Documentos exigidos al ciudadano (RN-05, RN-06, RF-CAR-03): los de la persona con discapacidad, los del
 * cuidador y la carta común. Son parametrizables y cada cambio queda versionado.
 */
@Component({
  selector: 'app-documentos-page',
  imports: [Confirmar, ReactiveFormsModule, Campo, CampoControl, Dialogo, Icono, Pestanas],
  templateUrl: './documentos-page.html',
  styleUrl: './documentos-page.scss',
})
export class DocumentosPage implements OnInit {
  private readonly api = inject(ConfigApi);

  protected readonly aplicaA = NOMBRE_APLICA_A;
  protected readonly opciones = Object.keys(NOMBRE_APLICA_A) as AplicaA[];
  protected readonly documentos = signal<DocumentoRequerido[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');

  protected readonly abierto = signal(false);
  protected readonly editando = signal<DocumentoRequerido | null>(null);
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(150)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    aplicaA: new FormControl<AplicaA>('PCD', { nonNullable: true }),
    obligatorio: new FormControl(true, { nonNullable: true }),
    hojasMinimas: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(10)],
    }),
  });

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.documentos.set(await firstValueFrom(this.api.documentos()));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los documentos.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** La Gerencia publica el modelo (PDF, DOCX u ODT) que la persona descarga al cargar sus documentos. */
  protected async cargarModelo(d: DocumentoRequerido, evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.subirModelo(d.id, archivo));
      this.mensaje.set(
        `Se publicó el modelo de «${d.nombre}». Ya se puede descargar desde el formulario.`,
      );
      await this.cargar();
    } catch (e) {
      this.error.set(
        e instanceof ApiError
          ? e.errores.length > 0
            ? e.errores.map((x) => x.mensaje).join(' ')
            : e.message
          : 'No pudimos cargar el modelo.',
      );
    }
  }

  protected tamano(bytes: number): string {
    return bytes < 1_048_576
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB`;
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.errorDialogo.set('');
    this.form.reset({
      nombre: '',
      descripcion: '',
      aplicaA: 'PCD',
      obligatorio: true,
      hojasMinimas: 1,
    });
    this.abierto.set(true);
  }

  protected abrirEditar(d: DocumentoRequerido): void {
    this.editando.set(d);
    this.errorDialogo.set('');
    this.form.reset({
      nombre: d.nombre,
      descripcion: d.descripcion,
      aplicaA: d.aplicaA,
      obligatorio: d.obligatorio,
      hojasMinimas: d.hojasMinimas,
    });
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.errorDialogo.set('');
    const v = this.form.getRawValue();
    const datos = { ...v, nombre: v.nombre.trim(), descripcion: v.descripcion.trim() };
    const edicion = this.editando();
    try {
      if (edicion) await firstValueFrom(this.api.actualizarDocumento(edicion.id, datos));
      else await firstValueFrom(this.api.crearDocumento(datos));
      this.cerrar();
      this.mensaje.set(edicion ? `«${datos.nombre}» actualizado.` : `«${datos.nombre}» agregado.`);
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

  protected async cambiarActivo(d: DocumentoRequerido): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.cambiarActivoDocumento(d.id, !d.activo));
      this.mensaje.set(`«${d.nombre}» ${d.activo ? 'desactivado' : 'activado'}.`);
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cambiar el estado.');
    }
  }
}
