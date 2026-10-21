import { DatePipe, DecimalPipe, Location } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { CoincidenciaExpediente, Expediente } from '../modelos-seguimiento';
import { SeguimientoApi } from '../seguimiento-api';

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
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule],
  templateUrl: './expediente-page.html',
  styleUrl: './expediente-page.scss',
})
export class ExpedientePage implements OnInit {
  private readonly api = inject(SeguimientoApi);
  private readonly ubicacion = inject(Location);

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

  protected volver(): void {
    this.expediente.set(null);
    this.ubicacion.replaceState('/interno/expedientes');
  }

  protected imprimir(): void {
    window.print();
  }
}
