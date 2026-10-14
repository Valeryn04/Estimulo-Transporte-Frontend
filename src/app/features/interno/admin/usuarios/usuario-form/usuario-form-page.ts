import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { Campo } from '../../../../../shared/campo';
import { CampoControl } from '../../../../../shared/campo-control';
import { aplicarErroresApi, valorDe } from '../../../../../shared/forms';
import { AdminApi } from '../../admin-api';
import { Rol } from '../../modelos';

/** Crear o modificar un usuario interno y asignarle su rol (uno solo) (RF-ADM-01). */
@Component({
  selector: 'app-usuario-form-page',
  imports: [ReactiveFormsModule, RouterLink, Campo, CampoControl],
  templateUrl: './usuario-form-page.html',
  styleUrl: './usuario-form-page.scss',
})
export class UsuarioFormPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);

  /** Parámetro de ruta: vacío al crear, número al editar. */
  readonly id = input<string>();
  protected readonly editando = computed(() => !!this.id());

  protected readonly roles = signal<Rol[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  /** Administrador principal: conserva siempre el rol de administrador. */
  protected readonly protegido = signal(false);

  protected readonly form = new FormGroup({
    usuario: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,40}$/)],
    }),
    nombres: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(150)],
    }),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(150)],
    }),
    rolId: new FormControl<number | null>(null, [Validators.required]),
  });
  private readonly rolElegido = valorDe(this.form.controls.rolId);
  /** El rol elegido, para mostrar qué es y qué permisos da. */
  protected readonly rolSeleccionado = computed(
    () => this.roles().find((r) => r.id === this.rolElegido()) ?? null,
  );

  async ngOnInit(): Promise<void> {
    try {
      const roles = await firstValueFrom(this.api.roles());
      this.roles.set(roles);
      if (this.editando()) {
        const u = await firstValueFrom(this.api.usuario(Number(this.id())));
        this.form.patchValue({
          usuario: u.usuario,
          nombres: u.nombres,
          correo: u.correo,
          rolId: u.rol?.id ?? null,
        });
        this.form.controls.usuario.disable();
        this.protegido.set(u.protegido);
        // El administrador principal conserva siempre el rol de administrador: la lista queda fija.
        if (u.protegido) this.form.controls.rolId.disable();
      }
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar la información.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected async guardar(): Promise<void> {
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Revise los campos marcados en rojo.');
      return;
    }
    this.guardando.set(true);
    const v = this.form.getRawValue();
    try {
      if (this.editando()) {
        await firstValueFrom(
          this.api.actualizarUsuario(Number(this.id()), {
            nombres: v.nombres.trim(),
            correo: v.correo.trim(),
            rolId: v.rolId as number,
          }),
        );
      } else {
        await firstValueFrom(
          this.api.crearUsuario({
            usuario: v.usuario.trim().toLowerCase(),
            nombres: v.nombres.trim(),
            correo: v.correo.trim(),
            rolId: v.rolId as number,
          }),
        );
      }
      await this.router.navigate(['/interno/admin/usuarios']);
    } catch (e) {
      if (e instanceof ApiError) {
        const sueltos = aplicarErroresApi(this.form, e.errores);
        this.error.set(
          sueltos.length || e.errores.length === 0
            ? sueltos.join(' ') || e.message
            : 'Revise los campos marcados en rojo.',
        );
      } else {
        this.error.set('No pudimos guardar el usuario.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
