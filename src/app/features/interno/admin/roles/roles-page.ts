import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { aplicarErroresApi } from '../../../../shared/forms';
import { Icono } from '../../../../shared/icono/icono';
import { AdminApi } from '../admin-api';
import { Permiso, Rol } from '../modelos';
import { Pestanas } from '../../../../shared/pestanas/pestanas';

/** Código del rol que siempre tiene todos los permisos y no se modifica. */
const ROL_ADMINISTRADOR = 'ADMINISTRADOR';

/**
 * Roles y permisos (RF-ADM-01). Los roles del documento vienen de fábrica; aquí se crean roles propios y se elige qué
 * permisos tiene cada uno. Cada usuario tiene un solo rol, y un cambio en los permisos de un rol rige de inmediato.
 */
@Component({
  selector: 'app-roles-page',
  imports: [ReactiveFormsModule, Campo, CampoControl, Dialogo, Icono, Pestanas],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss',
})
export class RolesPage implements OnInit {
  private readonly api = inject(AdminApi);

  protected readonly roles = signal<Rol[]>([]);
  protected readonly permisos = signal<Permiso[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');

  // ---- crear / editar
  protected readonly abierto = signal(false);
  protected readonly editando = signal<Rol | null>(null);
  protected readonly seleccion = signal<ReadonlySet<string>>(new Set());
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(40)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(150)],
    }),
  });

  // ---- eliminar
  protected readonly aEliminar = signal<Rol | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly errorEliminar = signal('');

  /** El rol de administrador siempre tiene todos los permisos: solo se consulta. */
  protected readonly protegido = computed(() => this.editando()?.codigo === ROL_ADMINISTRADOR);
  /** Los roles del documento conservan su nombre. */
  protected readonly nombreFijo = computed(() => this.editando()?.sistema === true);
  protected readonly soloLectura = computed(() => this.protegido());

  /** Permisos agrupados por módulo, para mostrarlos ordenados. */
  protected readonly grupos = computed(() => {
    const porModulo = new Map<string, Permiso[]>();
    for (const p of this.permisos())
      porModulo.set(p.modulo, [...(porModulo.get(p.modulo) ?? []), p]);
    return [...porModulo].map(([modulo, lista]) => ({ modulo, permisos: lista }));
  });

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [roles, permisos] = await Promise.all([
        firstValueFrom(this.api.roles()),
        firstValueFrom(this.api.permisos()),
      ]);
      this.roles.set(roles);
      this.permisos.set(permisos);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los roles.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected descripcionPermiso(codigo: string): string {
    return this.permisos().find((p) => p.codigo === codigo)?.descripcion ?? codigo;
  }

  /** Áreas del programa en las que el rol puede actuar, para verlas de un vistazo en la tabla. */
  protected modulosDe(r: Rol): string {
    if (r.permisos.length === 0) return 'Sin permisos todavía';
    const modulos = new Set(
      r.permisos.map((p) => this.permisos().find((x) => x.codigo === p)?.modulo ?? 'Otros'),
    );
    return [...modulos].join(' · ');
  }

  protected resumenPermisos(r: Rol): string {
    if (r.permisos.length === 0) return 'Sin permisos todavía';
    return r.permisos.map((p) => this.descripcionPermiso(p)).join(' · ');
  }

  // ---------------------------------------------------------------------------------------------------------

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.errorDialogo.set('');
    this.form.reset({ nombre: '', descripcion: '' });
    this.form.controls.nombre.enable();
    this.seleccion.set(new Set());
    this.abierto.set(true);
  }

  protected abrirEditar(r: Rol): void {
    this.editando.set(r);
    this.errorDialogo.set('');
    this.form.reset({ nombre: r.nombre, descripcion: r.descripcion });
    if (r.sistema) this.form.controls.nombre.disable();
    else this.form.controls.nombre.enable();
    this.seleccion.set(new Set(r.permisos));
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected marcado(codigo: string): boolean {
    return this.seleccion().has(codigo);
  }

  protected alternar(codigo: string, activo: boolean): void {
    const nuevo = new Set(this.seleccion());
    if (activo) nuevo.add(codigo);
    else nuevo.delete(codigo);
    this.seleccion.set(nuevo);
  }

  protected async guardar(): Promise<void> {
    if (this.soloLectura()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.errorDialogo.set('');
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim(),
      permisos: [...this.seleccion()].sort(),
    };
    const edicion = this.editando();
    try {
      if (edicion) await firstValueFrom(this.api.actualizarRol(edicion.id, datos));
      else await firstValueFrom(this.api.crearRol(datos));
      this.cerrar();
      this.mensaje.set(
        edicion
          ? `El rol «${datos.nombre}» se actualizó. Los cambios de permisos rigen de inmediato.`
          : `El rol «${datos.nombre}» se creó. Ya puede asignarlo a un usuario.`,
      );
      await this.cargar();
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.form, e.errores);
        this.errorDialogo.set(sueltos.join(' ') || 'Revise los campos marcados en rojo.');
      } else {
        this.errorDialogo.set(e instanceof ApiError ? e.message : 'No pudimos guardar el rol.');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  // ---------------------------------------------------------------------------------------------------------

  protected pedirEliminar(r: Rol): void {
    this.errorEliminar.set('');
    this.aEliminar.set(r);
  }

  protected cancelarEliminar(): void {
    this.aEliminar.set(null);
  }

  protected async eliminar(): Promise<void> {
    const r = this.aEliminar();
    if (!r) return;
    this.eliminando.set(true);
    this.errorEliminar.set('');
    try {
      await firstValueFrom(this.api.eliminarRol(r.id));
      this.aEliminar.set(null);
      this.mensaje.set(`El rol «${r.nombre}» se eliminó.`);
      await this.cargar();
    } catch (e) {
      this.errorEliminar.set(e instanceof ApiError ? e.message : 'No pudimos eliminar el rol.');
    } finally {
      this.eliminando.set(false);
    }
  }
}
