import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { Icono } from '../../../../shared/icono/icono';
import { OrdenLista } from '../../../../shared/orden-lista/orden-lista';
import { aplicarErroresApi } from '../../../../shared/forms';
import { ayudaPosicion } from '../../../../shared/posicion';
import { ConfigApi } from '../config/config-api';
import { AplicaA, DocumentoRequerido, NOMBRE_APLICA_A } from '../config/modelos-config';

/**
 * Documentos exigidos al ciudadano (RN-05, RN-06, RF-CAR-03): los de la persona con discapacidad, los del
 * cuidador y la carta común. Son parametrizables y cada cambio queda versionado.
 */
@Component({
  selector: 'app-documentos-page',
  imports: [
    ReactiveFormsModule,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    Campo,
    CampoControl,
    Dialogo,
    Icono,
    OrdenLista,
  ],
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
    orden: new FormControl<number | null>(null, [Validators.min(1), Validators.max(100000)]),
  });

  // Cada documento tiene su posición en la lista y nunca se repite: la pantalla avisa quién la ocupa.
  protected readonly ordenEscrito = signal<number | null>(null);
  protected readonly nombreEscrito = signal('');
  /** Los demás documentos, en su orden, para arrastrar la posición dentro de la lista. */
  protected readonly otros = computed(() =>
    this.documentos()
      .filter((d) => d.id !== this.editando()?.id)
      .sort((a, b) => a.orden - b.orden),
  );
  protected readonly ayudaOrden = computed(() => {
    const posicion = this.ordenEscrito();
    const propio = this.editando();
    return ayudaPosicion({
      posicion,
      total: this.documentos().length,
      esNuevo: !propio,
      ocupante: this.documentos().find((d) => d.orden === posicion) ?? null,
      propioId: propio?.id,
    });
  });

  constructor() {
    this.form.controls.orden.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.ordenEscrito.set(v));
    this.form.controls.nombre.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.nombreEscrito.set(v));
  }

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
    const siguiente = this.documentos().length + 1;
    this.form.reset({
      nombre: '',
      descripcion: '',
      aplicaA: 'PCD',
      obligatorio: true,
      orden: siguiente,
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
      orden: d.orden,
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
    const datos = {
      ...v,
      orden: v.orden ?? undefined,
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim(),
    };
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

  /** Arrastrar una fila: el documento queda en la posición de la fila donde se suelta y los demás se corren. */
  protected async soltar(e: CdkDragDrop<DocumentoRequerido[]>): Promise<void> {
    if (e.previousIndex === e.currentIndex) return;
    const lista = [...this.documentos()];
    const mover = lista[e.previousIndex];
    const destino = lista[e.currentIndex];
    if (!mover || !destino) return;
    moveItemInArray(lista, e.previousIndex, e.currentIndex);
    this.documentos.set(lista);
    await this.mover(mover, destino.orden);
  }

  protected subir(d: DocumentoRequerido): Promise<void> {
    return this.mover(d, d.orden - 1);
  }

  protected bajar(d: DocumentoRequerido): Promise<void> {
    return this.mover(d, d.orden + 1);
  }

  private async mover(d: DocumentoRequerido, orden: number): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.moverDocumento(d.id, orden));
      this.mensaje.set(`«${d.nombre}» quedó en la posición ${orden}.`);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cambiar el orden.');
    }
    await this.cargar();
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
