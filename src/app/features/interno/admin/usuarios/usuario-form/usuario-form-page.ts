import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { ValidatorFn } from '@angular/forms';
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
    // El correo se escribe dos veces: ahí llega la contraseña temporal, así que un error de digitación la perdería.
    correoConfirmacion: new FormControl('', { nonNullable: true }),
    rolId: new FormControl<number | null>(null, [Validators.required]),
  });
  private readonly rolElegido = valorDe(this.form.controls.rolId);
  private readonly correoEscrito = valorDe(this.form.controls.correo);
  /** Correo que tenía la persona al abrir la edición. */
  private readonly correoOriginal = signal('');
  /** Se pide confirmar el correo al crear, y al editar solo si se cambió. */
  protected readonly pideConfirmacion = computed(
    () =>
      !this.editando() ||
      this.correoEscrito().trim().toLowerCase() !== this.correoOriginal().trim().toLowerCase(),
  );
  /** El rol elegido, para mostrar qué es y qué permisos da. */
  protected readonly rolSeleccionado = computed(
    () => this.roles().find((r) => r.id === this.rolElegido()) ?? null,
  );

  /**
   * Al salir del campo (y otra vez al enviar) pregunta si el usuario o el correo ya los usa otra cuenta, y lo dice
   * con claridad: «este correo ya lo usa la cuenta «ana.gomez»». Al volver a escribir, el aviso se quita solo.
   */
  protected async revisarDisponibilidad(campo: 'usuario' | 'correo'): Promise<void> {
    const control = this.form.controls[campo];
    const valor = control.value.trim();
    // En edición el usuario no se puede cambiar; y un dato mal escrito ya tiene su propio aviso.
    if (!valor || (campo === 'usuario' && this.editando())) return;
    if (control.errors && !control.errors['ocupado']) return;
    const excluirId = this.editando() ? Number(this.id()) : undefined;
    try {
      const r = await firstValueFrom(this.api.disponibilidad({ [campo]: valor, excluirId }));
      const dato = r[campo];
      if (dato && !dato.disponible) {
        // Se dice que ya está registrado, sin revelar a quién pertenece.
        control.setErrors({
          ocupado: `${campo === 'correo' ? 'este correo' : 'este usuario'} ya está registrado`,
        });
        control.markAsTouched();
      }
    } catch {
      // Si no se pudo consultar, el servidor igual lo rechaza al guardar.
    }
  }

  private readonly validarConfirmacion: ValidatorFn = (c) => {
    if (!this.pideConfirmacion()) return null;
    const valor = String(c.value ?? '')
      .trim()
      .toLowerCase();
    if (!valor) return { required: true };
    return valor === this.correoEscrito().trim().toLowerCase() ? null : { correoDiferente: true };
  };

  async ngOnInit(): Promise<void> {
    this.form.controls.correoConfirmacion.setValidators(this.validarConfirmacion);
    this.form.controls.correoConfirmacion.updateValueAndValidity({ emitEvent: false });
    // Al cambiar el correo se vuelve a revisar la confirmación.
    this.form.controls.correo.valueChanges.subscribe(() =>
      this.form.controls.correoConfirmacion.updateValueAndValidity(),
    );
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
        this.correoOriginal.set(u.correo);
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
    await Promise.all([
      this.revisarDisponibilidad('usuario'),
      this.revisarDisponibilidad('correo'),
    ]);
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
