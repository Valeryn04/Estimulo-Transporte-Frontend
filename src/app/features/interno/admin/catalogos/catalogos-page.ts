import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { Icono } from '../../../../shared/icono/icono';
import { aplicarErroresApi } from '../../../../shared/forms';
import { Pagina } from '../modelos';
import { ConfigApi } from '../config/config-api';
import {
  Catalogo,
  ItemCatalogo,
  NOMBRE_CATALOGO,
  ResumenCatalogo,
  VersionRegistro,
} from '../config/modelos-config';

type Dialogo_ = 'ninguno' | 'formulario' | 'historial';

/**
 * Catálogos del programa (RF-ADM-02): tipos de identificación, localidades, barrios, EPS, tipos de
 * transporte y causales. Los elementos no se borran: se desactivan, y cada cambio queda versionado.
 */
@Component({
  selector: 'app-catalogos-page',
  imports: [DatePipe, ReactiveFormsModule, Campo, CampoControl, Dialogo, Icono],
  templateUrl: './catalogos-page.html',
  styleUrl: './catalogos-page.scss',
})
export class CatalogosPage implements OnInit {
  private readonly api = inject(ConfigApi);

  protected readonly nombres = NOMBRE_CATALOGO;
  protected readonly listas = Object.keys(NOMBRE_CATALOGO) as Catalogo[];
  protected readonly resumen = signal<ResumenCatalogo[]>([]);
  protected readonly catalogo = signal<Catalogo>('TIPO_IDENTIFICACION');
  protected readonly datos = signal<Pagina<ItemCatalogo> | null>(null);
  protected readonly localidades = signal<ItemCatalogo[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly pagina = signal(1);
  protected readonly tamano = 20;
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.datos()?.total ?? 0) / this.tamano)),
  );
  protected readonly esBarrio = computed(() => this.catalogo() === 'BARRIO');
  protected readonly pideCodigo = computed(() => this.catalogo() === 'TIPO_IDENTIFICACION');

  protected readonly filtros = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    estado: new FormControl<'' | 'true' | 'false'>('', { nonNullable: true }),
    padreId: new FormControl<number | null>(null),
  });

  // ---- diálogos
  protected readonly dialogo = signal<Dialogo_>('ninguno');
  protected readonly editando = signal<ItemCatalogo | null>(null);
  protected readonly versiones = signal<VersionRegistro[]>([]);
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(150)],
    }),
    codigo: new FormControl('', { nonNullable: true }),
    padreId: new FormControl<number | null>(null),
    orden: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100000)],
    }),
  });

  ngOnInit(): void {
    void this.cargarResumen();
    void this.cargarLocalidades();
    void this.buscar();
  }

  private async cargarResumen(): Promise<void> {
    try {
      this.resumen.set(await firstValueFrom(this.api.resumenCatalogos()));
    } catch {
      this.resumen.set([]);
    }
  }

  private async cargarLocalidades(): Promise<void> {
    try {
      const r = await firstValueFrom(
        this.api.items('LOCALIDAD', { activo: true, pagina: 1, tamano: 100 }),
      );
      this.localidades.set(r.items);
    } catch {
      this.localidades.set([]);
    }
  }

  protected totalDe(c: Catalogo): ResumenCatalogo | undefined {
    return this.resumen().find((r) => r.catalogo === c);
  }

  protected cambiarCatalogo(c: string): void {
    this.catalogo.set(c as Catalogo);
    this.filtros.reset({ q: '', estado: '', padreId: null });
    this.mensaje.set('');
    void this.buscar();
  }

  protected async buscar(pagina = 1): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.pagina.set(pagina);
    const f = this.filtros.getRawValue();
    try {
      this.datos.set(
        await firstValueFrom(
          this.api.items(this.catalogo(), {
            q: f.q.trim() || undefined,
            activo: f.estado === '' ? undefined : f.estado === 'true',
            padreId: this.esBarrio() ? (f.padreId ?? undefined) : undefined,
            pagina,
            tamano: this.tamano,
          }),
        ),
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar la lista.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected limpiar(): void {
    this.filtros.reset({ q: '', estado: '', padreId: null });
    void this.buscar();
  }

  // ---------------------------------------------------------------- crear / editar

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.errorDialogo.set('');
    this.form.reset({ nombre: '', codigo: '', padreId: null, orden: 0 });
    this.form.controls.codigo.enable();
    this.form.controls.codigo.setValidators(
      this.pideCodigo() ? [Validators.required, Validators.pattern(/^[A-Za-z0-9_]{1,10}$/)] : [],
    );
    this.form.controls.padreId.setValidators(this.esBarrio() ? [Validators.required] : []);
    this.form.controls.codigo.updateValueAndValidity();
    this.form.controls.padreId.updateValueAndValidity();
    this.dialogo.set('formulario');
  }

  protected abrirEditar(i: ItemCatalogo): void {
    this.editando.set(i);
    this.errorDialogo.set('');
    this.form.reset({ nombre: i.nombre, codigo: i.codigo, padreId: i.padreId, orden: i.orden });
    this.form.controls.codigo.disable();
    this.form.controls.codigo.setValidators([]);
    this.form.controls.padreId.setValidators(this.esBarrio() ? [Validators.required] : []);
    this.form.controls.padreId.updateValueAndValidity();
    this.dialogo.set('formulario');
  }

  protected cerrar(): void {
    this.dialogo.set('ninguno');
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.errorDialogo.set('');
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre.trim(),
      codigo: this.pideCodigo() && v.codigo ? v.codigo.trim().toUpperCase() : undefined,
      padreId: this.esBarrio() ? v.padreId : null,
      orden: v.orden,
    };
    const edicion = this.editando();
    try {
      if (edicion) await firstValueFrom(this.api.actualizarItem(edicion.id, datos));
      else await firstValueFrom(this.api.crearItem(this.catalogo(), datos));
      this.cerrar();
      this.mensaje.set(edicion ? `«${datos.nombre}» actualizado.` : `«${datos.nombre}» agregado.`);
      void this.cargarResumen();
      if (this.catalogo() === 'LOCALIDAD') void this.cargarLocalidades();
      await this.buscar(this.pagina());
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

  // ---------------------------------------------------------------- activar / historial

  protected async cambiarActivo(i: ItemCatalogo): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.cambiarActivoItem(i.id, !i.activo));
      this.mensaje.set(`«${i.nombre}» ${i.activo ? 'desactivado' : 'activado'}.`);
      void this.cargarResumen();
      if (this.catalogo() === 'LOCALIDAD') void this.cargarLocalidades();
      await this.buscar(this.pagina());
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cambiar el estado.');
    }
  }

  protected async verHistorial(i: ItemCatalogo): Promise<void> {
    this.editando.set(i);
    this.versiones.set([]);
    this.errorDialogo.set('');
    this.dialogo.set('historial');
    try {
      this.versiones.set(await firstValueFrom(this.api.versionesItem(i.id)));
    } catch (e) {
      this.errorDialogo.set(e instanceof ApiError ? e.message : 'No pudimos cargar el historial.');
    }
  }

  protected resumenVersion(v: VersionRegistro): string {
    const s = v.snapshot as { nombre?: string; orden?: number; activo?: boolean };
    return `${s.nombre ?? ''} · orden ${s.orden ?? 0} · ${s.activo ? 'activo' : 'inactivo'}`;
  }
}
