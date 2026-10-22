import { DatePipe, DecimalPipe, Location } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Ayuda } from '../../../../shared/ayuda/ayuda';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { aplicarErroresApi } from '../../../../shared/forms';
import { Comunicacion, CoincidenciaExpediente, Expediente } from '../modelos-seguimiento';
import { SeguimientoApi } from '../seguimiento-api';
import { Pestanas } from '../../../../shared/pestanas/pestanas';
import { Confirmar } from '../../../../shared/alertas/confirmar';

/** Nombre legible de cada acción de la bitácora que aparece en la cronología. */
const ACCIONES: Record<string, string> = {
  PREINSCRIPCION_CREADA: 'Preinscripción registrada',
  CORREO_VERIFICADO: 'Correo verificado',
  CARACTERIZACION_RADICADA: 'Caracterización radicada',
  VALIDACION_DECIDIDA: 'Decisión de validación',
  PRIORIZACION_CALCULADA: 'Puntaje calculado',
  EXCEPCION_PROPUESTA: 'Excepción propuesta',
  EXCEPCION_APROBADA: 'Excepción aprobada',
  EXCEPCION_RECHAZADA: 'Excepción rechazada',
  BENEFICIO_ASIGNADO: 'Beneficio asignado',
  CASO_EN_LISTA_ESPERA: 'Caso en lista de espera',
  ENTREGA_REGISTRADA: 'Entrega de tarjeta registrada',
  BENEFICIO_ACTIVADO: 'Beneficio activado',
  NOVEDAD_REGISTRADA: 'Novedad registrada',
  REVOCATORIA_INICIADA: 'Revocatoria iniciada',
  REVOCATORIA_TRASLADO: 'Traslado al beneficiario',
  REVOCATORIA_DESCARGOS: 'Descargos recibidos',
  REVOCATORIA_DECIDIDA: 'Revocatoria decidida',
  CUPO_LIBERADO: 'Cupo liberado',
};

/**
 * Expediente integral (RF-SEG-03): busca un caso por radicado, documento o nombre y muestra en un solo lugar su
 * cronología, documentos, decisiones, entrega, novedades y comunicaciones. Se puede imprimir.
 */
@Component({
  selector: 'app-expediente-page',
  imports: [
    Confirmar,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    Campo,
    CampoControl,
    Ayuda,
    Pestanas,
  ],
  templateUrl: './expediente-page.html',
  styleUrl: './expediente-page.scss',
})
export class ExpedientePage implements OnInit {
  private readonly api = inject(SeguimientoApi);
  private readonly ubicacion = inject(Location);
  private readonly sesion = inject(Sesion);

  /** Parámetros de la ruta: `solicitudId` abre un expediente y `q` repite una búsqueda. */
  readonly solicitudId = input<string>();
  readonly q = input<string>();

  protected readonly busqueda = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });
  protected readonly coincidencias = signal<CoincidenciaExpediente[] | null>(null);
  protected readonly expediente = signal<Expediente | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly hayExpediente = computed(() => this.expediente() !== null);
  protected readonly puedeCorregirCorreo = computed(() =>
    this.sesion.tiene(PERMISO.novedadesGestionar),
  );
  protected readonly mensaje = signal('');
  protected readonly guardando = signal(false);
  protected readonly soporte = signal<File | null>(null);
  protected readonly formCorreo = new FormGroup({
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(150)],
    }),
    justificacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(1000)],
    }),
  });
  protected readonly nombreEstadoCorreo: Record<Comunicacion['estado'], string> = {
    PENDIENTE: 'Pendiente de envío',
    ENVIADO: 'Enviado',
    ENTREGADO: 'Entregado',
    REBOTADO: 'Rebotado',
    FALLIDO: 'Falló el envío',
  };

  ngOnInit(): void {
    const id = Number(this.solicitudId());
    if (id) void this.abrir(id);
    else if (this.q()) {
      this.busqueda.setValue(this.q()!);
      void this.buscar();
    }
  }

  protected accion(codigo: string): string {
    return ACCIONES[codigo] ?? codigo;
  }

  protected async buscar(): Promise<void> {
    if (this.busqueda.invalid) {
      this.busqueda.markAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.expediente.set(null);
    try {
      const r = await firstValueFrom(this.api.buscarExpedientes(this.busqueda.value.trim()));
      this.coincidencias.set(r);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos hacer la búsqueda.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected async abrir(id: number): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.expediente.set(await firstValueFrom(this.api.expediente(id)));
      // La dirección queda con el expediente abierto sin volver a cargar la pantalla.
      this.ubicacion.replaceState(`/interno/expedientes/${id}`);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar el expediente.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected elegirSoporte(e: Event): void {
    this.soporte.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  /** Corrige el correo con su soporte y reenvía lo que rebotó (RF-COM-03). */
  protected async corregirCorreo(): Promise<void> {
    const x = this.expediente();
    if (!x) return;
    this.formCorreo.markAllAsTouched();
    this.error.set('');
    this.mensaje.set('');
    if (this.formCorreo.invalid) return;
    const soporte = this.soporte();
    if (!soporte) {
      this.error.set('Adjunte el soporte del cambio de correo (PDF, JPG o PNG).');
      return;
    }
    this.guardando.set(true);
    try {
      const v = this.formCorreo.getRawValue();
      const r = await firstValueFrom(
        this.api.corregirCorreo(
          x.solicitudId,
          { correo: v.correo.trim(), justificacion: v.justificacion.trim() },
          soporte,
        ),
      );
      this.formCorreo.reset();
      this.soporte.set(null);
      this.expediente.set(await firstValueFrom(this.api.expediente(x.solicitudId)));
      this.mensaje.set(
        r.reenviados > 0
          ? `Correo actualizado y ${r.reenviados} comunicación(es) reenviada(s).`
          : 'Correo actualizado.',
      );
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.formCorreo, e.errores);
        if (sueltos.length) this.error.set(sueltos.join(' '));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos actualizar el correo.');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  protected async reenviar(c: Comunicacion): Promise<void> {
    const x = this.expediente();
    if (!x) return;
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.reenviarComunicacion(x.solicitudId, c.id));
      this.expediente.set(await firstValueFrom(this.api.expediente(x.solicitudId)));
      this.mensaje.set('La comunicación quedó en la cola de envío.');
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos reenviar la comunicación.');
    }
  }

  protected volver(): void {
    this.expediente.set(null);
    this.ubicacion.replaceState('/interno/expedientes');
  }

  protected imprimir(): void {
    window.print();
  }
}
