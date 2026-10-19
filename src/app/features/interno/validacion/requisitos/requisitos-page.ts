import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { Icono } from '../../../../shared/icono/icono';
import { aplicarErroresApi } from '../../../../shared/forms';
import { ConfigApi } from '../../admin/config/config-api';
import { DocumentoRequerido, VersionRegistro } from '../../admin/config/modelos-config';
import { SECCIONES_DATOS } from '../caso/datos-caso';
import { AplicaARequisito, NOMBRE_APLICA_REQUISITO, Requisito } from '../modelos-validacion';
import { ValidacionApi } from '../validacion-api';

type Vista = 'ninguna' | 'formulario' | 'historial';

/**
 * Lista de chequeo de requisitos (RN-05, RF-ADM-04): los requisitos que el validador revisa en cada caso. Cada uno
 * puede apoyarse en un documento y en datos del formulario, que son lo único que la persona puede corregir si se le
 * pide subsanar. Los cambios quedan versionados; los casos ya iniciados conservan su copia.
 */
@Component({
  selector: 'app-requisitos-page',
  imports: [DatePipe, ReactiveFormsModule, Campo, CampoControl, Dialogo, Icono],
  templateUrl: './requisitos-page.html',
  styleUrl: './requisitos-page.scss',
})
export class RequisitosPage implements OnInit {
  private readonly api = inject(ValidacionApi);
  private readonly config = inject(ConfigApi);

  protected readonly requisitos = signal<Requisito[]>([]);
  protected readonly documentos = signal<DocumentoRequerido[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly aplicaA = NOMBRE_APLICA_REQUISITO;
  protected readonly opciones = Object.keys(NOMBRE_APLICA_REQUISITO) as AplicaARequisito[];
  protected readonly secciones = SECCIONES_DATOS;
  protected readonly cruces = signal<{ codigo: string; nombre: string }[]>([]);

  protected readonly vista = signal<Vista>('ninguna');
  protected readonly editando = signal<Requisito | null>(null);
  protected readonly versiones = signal<VersionRegistro[]>([]);
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly camposElegidos = signal<ReadonlySet<string>>(new Set());

  protected readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(150)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    aplicaA: new FormControl<AplicaARequisito>('PCD', { nonNullable: true }),
    fuenteSugerida: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    documentoId: new FormControl<number | null>(null),
    cruceCodigo: new FormControl<string | null>(null),
  });

  ngOnInit(): void {
    void this.cargar();
    void this.cargarDocumentos();
    void this.cargarCruces();
  }

  private async cargarCruces(): Promise<void> {
    try {
      this.cruces.set(await firstValueFrom(this.api.crucesDisponibles()));
    } catch {
      this.cruces.set([]);
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.requisitos.set(await firstValueFrom(this.api.requisitos()));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los requisitos.');
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarDocumentos(): Promise<void> {
    try {
      this.documentos.set(await firstValueFrom(this.config.documentos()));
    } catch {
      this.documentos.set([]);
    }
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.errorDialogo.set('');
    this.form.reset({
      nombre: '',
      descripcion: '',
      aplicaA: 'PCD',
      fuenteSugerida: '',
      documentoId: null,
      cruceCodigo: null,
    });
    this.camposElegidos.set(new Set());
    this.vista.set('formulario');
  }

  protected abrirEditar(r: Requisito): void {
    this.editando.set(r);
    this.errorDialogo.set('');
    this.form.reset({
      nombre: r.nombre,
      descripcion: r.descripcion,
      aplicaA: r.aplicaA,
      fuenteSugerida: r.fuenteSugerida,
      documentoId: r.documentoId,
      cruceCodigo: r.cruceCodigo,
    });
    this.camposElegidos.set(new Set(r.campos));
    this.vista.set('formulario');
  }

  protected cerrar(): void {
    this.vista.set('ninguna');
  }

  protected marcado(campo: string): boolean {
    return this.camposElegidos().has(campo);
  }

  protected alternarCampo(campo: string, activo: boolean): void {
    const nuevo = new Set(this.camposElegidos());
    if (activo) nuevo.add(campo);
    else nuevo.delete(campo);
    this.camposElegidos.set(nuevo);
  }

  protected resumenCorreccion(r: Requisito): string {
    const partes: string[] = [];
    if (r.documentoNombre) partes.push(`Documento: ${r.documentoNombre}`);
    if (r.campos.length > 0) partes.push(`${r.campos.length} dato(s) del formulario`);
    return partes.join(' · ') || 'No se puede pedir subsanación';
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.errorDialogo.set('');
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim(),
      aplicaA: v.aplicaA,
      fuenteSugerida: v.fuenteSugerida.trim(),
      documentoId: v.documentoId,
      campos: [...this.camposElegidos()],
      cruceCodigo: v.cruceCodigo,
    };
    const edicion = this.editando();
    try {
      if (edicion) await firstValueFrom(this.api.actualizarRequisito(edicion.id, datos));
      else await firstValueFrom(this.api.crearRequisito(datos));
      this.cerrar();
      this.mensaje.set(
        edicion
          ? `«${datos.nombre}» actualizado. Los casos que ya empezaron conservan su lista.`
          : `«${datos.nombre}» agregado. Se pedirá a los casos que empiecen su revisión desde ahora.`,
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

  protected async cambiarActivo(r: Requisito): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.cambiarActivoRequisito(r.id, !r.activo));
      this.mensaje.set(`«${r.nombre}» ${r.activo ? 'desactivado' : 'activado'}.`);
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cambiar el estado.');
    }
  }

  protected async verHistorial(r: Requisito): Promise<void> {
    this.editando.set(r);
    this.versiones.set([]);
    this.errorDialogo.set('');
    this.vista.set('historial');
    try {
      this.versiones.set(await firstValueFrom(this.api.versionesRequisito(r.id)));
    } catch (e) {
      this.errorDialogo.set(e instanceof ApiError ? e.message : 'No pudimos cargar el historial.');
    }
  }

  protected resumenVersion(v: VersionRegistro): string {
    const s = v.snapshot as { nombre?: string; activo?: boolean };
    return `${s.nombre ?? ''} · ${s.activo ? 'activo' : 'inactivo'}`;
  }
}
