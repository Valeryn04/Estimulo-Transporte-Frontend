import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { Icono } from '../../../../shared/icono/icono';
import { AdminApi } from '../admin-api';
import { EstadoUsuario, Pagina, Rol, Usuario } from '../modelos';
import { Pestanas } from '../../../../shared/pestanas/pestanas';

type Accion = 'ninguna' | 'bloquear' | 'baja' | 'password';

const ETIQUETA_ESTADO: Record<EstadoUsuario, string> = {
  ACTIVO: 'Activo',
  BLOQUEADO: 'Bloqueado',
  BAJA: 'Dado de baja',
};

/**
 * Gestión de usuarios internos (RF-ADM-01): lista con filtros, bloqueo, baja definitiva y contraseña
 * temporal. Bloquear y dar de baja exigen un motivo que queda en la bitácora.
 */
@Component({
  selector: 'app-usuarios-page',
  imports: [
    Icono,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Campo,
    CampoControl,
    Dialogo,
    Pestanas,
  ],
  templateUrl: './usuarios-page.html',
  styleUrl: './usuarios-page.scss',
})
export class UsuariosPage implements OnInit {
  private readonly api = inject(AdminApi);

  protected readonly datos = signal<Pagina<Usuario> | null>(null);
  protected readonly roles = signal<Rol[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly pagina = signal(1);
  protected readonly tamano = 15;
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.datos()?.total ?? 0) / this.tamano)),
  );
  protected readonly etiquetaEstado = ETIQUETA_ESTADO;

  protected readonly filtros = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    estado: new FormControl<EstadoUsuario | ''>('', { nonNullable: true }),
    rolId: new FormControl<number | null>(null),
  });

  // ---- diálogos de acciones sobre un usuario
  protected readonly accion = signal<Accion>('ninguna');
  protected readonly objetivo = signal<Usuario | null>(null);
  protected readonly errorDialogo = signal('');
  protected readonly trabajando = signal(false);
  protected readonly formMotivo = new FormGroup({
    motivo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
  });

  ngOnInit(): void {
    void this.cargarRoles();
    void this.buscar();
  }

  private async cargarRoles(): Promise<void> {
    try {
      this.roles.set(await firstValueFrom(this.api.roles()));
    } catch {
      this.roles.set([]);
    }
  }

  protected async buscar(pagina = 1): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.pagina.set(pagina);
    const f = this.filtros.getRawValue();
    try {
      this.datos.set(
        await firstValueFrom(
          this.api.usuarios({
            q: f.q.trim() || undefined,
            estado: f.estado || undefined,
            rolId: f.rolId ?? undefined,
            pagina,
            tamano: this.tamano,
          }),
        ),
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los usuarios.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected limpiar(): void {
    this.filtros.reset({ q: '', estado: '', rolId: null });
    void this.buscar();
  }

  protected rolTexto(u: Usuario): string {
    return u.rol?.nombre ?? 'Sin rol';
  }

  // ---------------------------------------------------------------- acciones

  protected abrirMotivo(u: Usuario, accion: 'bloquear' | 'baja'): void {
    this.objetivo.set(u);
    this.errorDialogo.set('');
    this.formMotivo.reset({ motivo: '' });
    this.accion.set(accion);
  }

  protected abrirPassword(u: Usuario): void {
    this.objetivo.set(u);
    this.errorDialogo.set('');
    this.accion.set('password');
  }

  protected cerrarDialogo(): void {
    this.accion.set('ninguna');
  }

  protected async confirmarMotivo(): Promise<void> {
    const u = this.objetivo();
    const accion = this.accion();
    this.formMotivo.markAllAsTouched();
    if (!u || this.formMotivo.invalid || (accion !== 'bloquear' && accion !== 'baja')) return;
    this.trabajando.set(true);
    this.errorDialogo.set('');
    const motivo = this.formMotivo.controls.motivo.value.trim();
    try {
      await firstValueFrom(
        accion === 'bloquear'
          ? this.api.bloquearUsuario(u.id, motivo)
          : this.api.darDeBajaUsuario(u.id, motivo),
      );
      this.cerrarDialogo();
      this.mensaje.set(
        accion === 'bloquear'
          ? `Usuario «${u.usuario}» bloqueado. Sus sesiones se cerraron.`
          : `Usuario «${u.usuario}» dado de baja. Su historial se conserva.`,
      );
      await this.buscar(this.pagina());
    } catch (e) {
      this.errorDialogo.set(
        e instanceof ApiError ? e.message : 'No pudimos completar la operación.',
      );
    } finally {
      this.trabajando.set(false);
    }
  }

  protected async desbloquear(u: Usuario): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.desbloquearUsuario(u.id));
      this.mensaje.set(`Usuario «${u.usuario}» desbloqueado.`);
      await this.buscar(this.pagina());
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos desbloquear el usuario.');
    }
  }

  protected async guardarPassword(): Promise<void> {
    const u = this.objetivo();
    if (!u) return;
    this.trabajando.set(true);
    this.errorDialogo.set('');
    try {
      await firstValueFrom(this.api.restablecerPassword(u.id));
      this.cerrarDialogo();
      this.mensaje.set(
        `Enviamos una contraseña temporal al correo de «${u.usuario}» (${u.correo}). Deberá cambiarla al ingresar.`,
      );
      await this.buscar(this.pagina());
    } catch (e) {
      this.errorDialogo.set(
        e instanceof ApiError ? e.message : 'No pudimos restablecer la contraseña.',
      );
    } finally {
      this.trabajando.set(false);
    }
  }
}
