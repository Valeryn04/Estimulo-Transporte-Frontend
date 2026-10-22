import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Sesion } from '../../../../core/auth/sesion';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { aplicarErroresApi } from '../../../../shared/forms';
import { AsignacionApi } from '../asignacion-api';
import {
  DetalleBeneficio,
  EntregaRegistrada,
  NOMBRE_ESTADO_BENEFICIO,
  NOMBRE_RECEPTOR,
  NOMBRE_ROL,
  RolBeneficiario,
  TipoReceptor,
} from '../modelos-asignacion';
import { Confirmar } from '../../../../shared/alertas/confirmar';

/**
 * Entrega del medio de transporte de un beneficio (RF-ASI-05): lo ya entregado a cada persona y el registro de la
 * entrega que falta (identificador de la tarjeta, tipo de transporte, fecha, quién recibe y acta; el funcionario es quien tiene la sesión). Cuando
 * el beneficio queda pendiente de activación, permite confirmarla.
 */
@Component({
  selector: 'app-entrega-beneficio',
  imports: [Confirmar, DatePipe, ReactiveFormsModule, Campo, CampoControl, Dialogo],
  templateUrl: './entrega-beneficio.html',
  styleUrl: './entrega-beneficio.scss',
})
export class EntregaBeneficio {
  private readonly api = inject(AsignacionApi);
  private readonly sesion = inject(Sesion);

  /** Beneficio que se abre; null mantiene el diálogo cerrado. */
  readonly beneficioId = input.required<number | null>();
  readonly puedeAsignar = input(false);
  readonly cierra = output<void>();
  /** Se emite cuando una entrega o una activación cambió el estado del beneficio. */
  readonly cambio = output<void>();

  protected readonly detalle = signal<DetalleBeneficio | null>(null);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly guardando = signal(false);
  protected readonly acta = signal<File | null>(null);
  protected readonly estados = NOMBRE_ESTADO_BENEFICIO;
  protected readonly nombreRol = NOMBRE_ROL;
  protected readonly nombreReceptor = NOMBRE_RECEPTOR;
  protected readonly receptorTipo = signal<TipoReceptor>('PCD');
  protected readonly nombreRolDe = (r: RolBeneficiario): string => NOMBRE_ROL[r];

  protected readonly puedeRegistrar = computed(
    () => this.puedeAsignar() && (this.detalle()?.pendientes.length ?? 0) > 0,
  );
  protected readonly puedeActivar = computed(
    () => this.puedeAsignar() && this.detalle()?.beneficio.estado === 'PENDIENTE_ACTIVACION',
  );
  /** Opciones de quién recibe: las personas del beneficio y un tercero autorizado. */
  protected readonly receptores = computed<TipoReceptor[]>(() => [
    ...((this.detalle()?.personas.map((p) => p.rol) ?? []) as TipoReceptor[]),
    'TERCERO',
  ]);

  protected readonly form = new FormGroup({
    rol: new FormControl<RolBeneficiario>('PCD', { nonNullable: true }),
    tarjetaId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4), Validators.maxLength(30)],
    }),
    tipoTransporteId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    fechaEntrega: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    receptorTipo: new FormControl<TipoReceptor>('PCD', { nonNullable: true }),
    receptorNombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(150)],
    }),
    receptorTipoIdentificacionId: new FormControl<number | null>(null),
    receptorNumero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(30)],
    }),
    // Solo si recibe un tercero: ¿presentó la autorización firmada de la persona?
    terceroConAutorizacion: new FormControl<boolean | null>(null),
  });

  /** Quien entrega es la persona con la sesión abierta: no se escribe. */
  protected readonly funcionario = computed(() => this.sesion.perfil()?.nombres ?? '');
  protected readonly prefijoTarjeta = computed(
    () => this.detalle()?.sugerencias.prefijoTarjeta ?? '',
  );
  protected readonly observacion = new FormControl('', { nonNullable: true });

  constructor() {
    effect(() => {
      const id = this.beneficioId();
      if (id === null) {
        this.detalle.set(null);
        return;
      }
      void this.cargar(id);
    });
  }

  private async cargar(id: number): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    this.acta.set(null);
    try {
      const d = await firstValueFrom(this.api.beneficio(id));
      this.detalle.set(d);
      this.form.reset({
        rol: d.pendientes[0] ?? 'PCD',
        // Las tarjetas comienzan como lo definió la Gerencia; el transporte es el que la persona dijo usar.
        tarjetaId: d.sugerencias.prefijoTarjeta,
        tipoTransporteId: d.sugerencias.tipoTransporteId,
        fechaEntrega: d.beneficio.hoy,
        receptorTipo: d.pendientes[0] ?? 'PCD',
        receptorNombre: '',
        receptorTipoIdentificacionId: null,
        receptorNumero: '',
        terceroConAutorizacion: null,
      });
      this.receptorTipo.set(d.pendientes[0] ?? 'PCD');
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar el beneficio.');
    }
  }

  protected cambiarRol(): void {
    // Lo más habitual: la tarjeta la recibe la misma persona a la que se entrega.
    const rol = this.form.controls.rol.value;
    this.form.controls.receptorTipo.setValue(rol);
    this.receptorTipo.set(rol);
  }

  protected cambiarReceptor(): void {
    this.receptorTipo.set(this.form.controls.receptorTipo.value);
  }

  protected elegirActa(evento: Event): void {
    this.acta.set((evento.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async registrar(): Promise<void> {
    const d = this.detalle();
    const acta = this.acta();
    if (!d) return;
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;
    if (this.form.controls.receptorTipo.value === 'TERCERO') {
      const aut = this.form.controls.terceroConAutorizacion.value;
      if (aut === null) {
        this.error.set('Indique si quien recibe presentó la autorización firmada de la persona.');
        return;
      }
      if (aut === false) {
        this.error.set(
          'Sin la autorización firmada de la persona no se puede entregar la tarjeta a un tercero.',
        );
        return;
      }
    }
    if (!acta) {
      this.error.set('Adjunte el acta de entrega firmada (PDF, JPG o PNG).');
      return;
    }
    const v = this.form.getRawValue();
    const datos = {
      rol: v.rol,
      tarjetaId: v.tarjetaId.trim(),
      tipoTransporteId: Number(v.tipoTransporteId),
      fechaEntrega: v.fechaEntrega,
      receptorTipo: v.receptorTipo,
      ...(v.receptorTipo === 'TERCERO'
        ? {
            terceroConAutorizacion: v.terceroConAutorizacion === true,
            receptorNombre: v.receptorNombre.trim(),
            receptorTipoIdentificacionId: v.receptorTipoIdentificacionId ?? undefined,
            receptorNumero: v.receptorNumero.trim(),
          }
        : {}),
    };
    this.guardando.set(true);
    try {
      const nuevo = await firstValueFrom(this.api.registrarEntrega(d.beneficio.id, datos, acta));
      const texto = `Entrega registrada. Se notificó por correo a la persona. ${
        nuevo.beneficio.estado === 'PENDIENTE_ENTREGA'
          ? 'Falta la entrega al cuidador.'
          : nuevo.beneficio.estado === 'ACTIVO'
            ? 'El beneficio quedó activo.'
            : 'El beneficio quedó pendiente de activación.'
      }`;
      await this.cargar(d.beneficio.id);
      this.mensaje.set(texto);
      this.cambio.emit();
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.form, e.errores);
        if (sueltos.length) this.error.set(sueltos.join(' '));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos registrar la entrega.');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  protected async activar(): Promise<void> {
    const d = this.detalle();
    if (!d) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.activar(d.beneficio.id, this.observacion.value.trim()));
      await this.cargar(d.beneficio.id);
      this.mensaje.set('El beneficio quedó activo y se notificó a la persona.');
      this.observacion.setValue('');
      this.cambio.emit();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos activar el beneficio.');
    } finally {
      this.guardando.set(false);
    }
  }

  protected async verActa(e: EntregaRegistrada): Promise<void> {
    this.error.set('');
    try {
      const blob = await firstValueFrom(this.api.acta(e.id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'No pudimos abrir el acta.');
    }
  }
}
