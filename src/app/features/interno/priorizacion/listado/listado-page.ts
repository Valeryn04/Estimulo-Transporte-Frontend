import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { aplicarErroresApi } from '../../../../shared/forms';
import {
  CasoPuntaje,
  FilaListado,
  Listado,
  NOMBRE_ESTADO_EXCEPCION,
  ResultadoMasivo,
} from '../modelos-priorizacion';
import { PriorizacionApi } from '../priorizacion-api';

type Vista = 'ninguna' | 'puntaje' | 'excepcion' | 'recalcular';

/**
 * Listado priorizado (RF-PRI-04): casos validados de mayor a menor puntaje, con filtros por localidad, transporte y
 * población y el criterio de desempate aplicado. Desde aquí se calcula el puntaje (RF-PRI-01), se consulta cómo se
 * obtuvo y se propone un ajuste justificado (RF-PRI-03).
 */
@Component({
  selector: 'app-listado-priorizado-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, Campo, CampoControl, Dialogo],
  templateUrl: './listado-page.html',
  styleUrl: './listado-page.scss',
})
export class ListadoPriorizadoPage implements OnInit {
  private readonly api = inject(PriorizacionApi);
  protected readonly sesion = inject(Sesion);

  protected readonly datos = signal<Listado | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly omitidos = signal<ResultadoMasivo['omitidos']>([]);
  protected readonly pagina = signal(1);
  protected readonly tamano = 25;
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.datos()?.total ?? 0) / this.tamano)),
  );
  protected readonly localidades = signal<{ id: number; nombre: string }[]>([]);
  protected readonly transportes = signal<{ id: number; nombre: string }[]>([]);
  protected readonly calculando = signal(false);

  protected readonly puedeCalcular = computed(() =>
    this.sesion.tiene(PERMISO.priorizacionCalcular),
  );
  protected readonly puedeProponer = computed(() =>
    this.sesion.tiene(PERMISO.priorizacionProponer),
  );
  protected readonly estadoExcepcion = NOMBRE_ESTADO_EXCEPCION;

  protected readonly filtros = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    localidadId: new FormControl('', { nonNullable: true }),
    transporteId: new FormControl('', { nonNullable: true }),
    poblacion: new FormControl<'' | 'CON_CUIDADOR' | 'SIN_CUIDADOR'>('', { nonNullable: true }),
  });

  // ---- diálogos
  protected readonly vista = signal<Vista>('ninguna');
  protected readonly fila = signal<FilaListado | null>(null);
  protected readonly caso = signal<CasoPuntaje | null>(null);
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly archivo = signal<File | null>(null);
  protected readonly formExcepcion = new FormGroup({
    ajuste: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(-100), Validators.max(100)],
    }),
    justificacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(20), Validators.maxLength(2000)],
    }),
  });

  ngOnInit(): void {
    void this.cargarFiltros();
    void this.buscar();
  }

  private async cargarFiltros(): Promise<void> {
    try {
      const f = await firstValueFrom(this.api.filtros());
      this.localidades.set(f.localidades);
      this.transportes.set(f.tiposTransporte);
    } catch {
      this.localidades.set([]);
      this.transportes.set([]);
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
          this.api.listado({
            q: f.q.trim() || undefined,
            localidadId: f.localidadId ? Number(f.localidadId) : undefined,
            transporteId: f.transporteId ? Number(f.transporteId) : undefined,
            poblacion: f.poblacion || undefined,
            pagina,
            tamano: this.tamano,
          }),
        ),
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar el listado.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected limpiar(): void {
    this.filtros.reset({ q: '', localidadId: '', transporteId: '', poblacion: '' });
    void this.buscar();
  }

  protected cerrar(): void {
    this.vista.set('ninguna');
  }

  // ---------------------------------------------------------------- cálculo (RF-PRI-01)

  protected pedirRecalculo(): void {
    this.vista.set('recalcular');
  }

  protected async calcular(recalcular: boolean): Promise<void> {
    this.calculando.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.omitidos.set([]);
    this.cerrar();
    try {
      const r = await firstValueFrom(this.api.calcularMasivo(recalcular));
      this.mensaje.set(
        `Con la versión ${r.matrizVersion} de la matriz se calcularon ${r.calculados} caso(s)` +
          (r.sinCambio > 0 ? `; ${r.sinCambio} ya estaban al día` : '') +
          (r.omitidos.length > 0 ? `; ${r.omitidos.length} no se pudieron calcular.` : '.'),
      );
      this.omitidos.set(r.omitidos);
      await this.buscar(this.pagina());
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos calcular los puntajes.');
    } finally {
      this.calculando.set(false);
    }
  }

  // ---------------------------------------------------------------- cómo se obtuvo el puntaje

  protected async verPuntaje(f: FilaListado): Promise<void> {
    this.fila.set(f);
    this.caso.set(null);
    this.errorDialogo.set('');
    this.vista.set('puntaje');
    await this.cargarCaso(f.solicitudId);
  }

  private async cargarCaso(id: number): Promise<void> {
    try {
      this.caso.set(await firstValueFrom(this.api.caso(id)));
    } catch (e) {
      this.errorDialogo.set(e instanceof ApiError ? e.message : 'No pudimos cargar el puntaje.');
    }
  }

  protected async recalcularCaso(): Promise<void> {
    const f = this.fila();
    if (!f) return;
    this.errorDialogo.set('');
    try {
      await firstValueFrom(this.api.calcularCaso(f.solicitudId));
      await this.cargarCaso(f.solicitudId);
      await this.buscar(this.pagina());
    } catch (e) {
      this.errorDialogo.set(e instanceof ApiError ? e.message : 'No pudimos calcular el puntaje.');
    }
  }

  // ---------------------------------------------------------------- excepción (RF-PRI-03)

  protected abrirExcepcion(f: FilaListado): void {
    this.fila.set(f);
    this.errorDialogo.set('');
    this.archivo.set(null);
    this.formExcepcion.reset({ ajuste: null, justificacion: '' });
    this.vista.set('excepcion');
  }

  protected elegirArchivo(evento: Event): void {
    this.archivo.set((evento.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async proponer(): Promise<void> {
    const f = this.fila();
    if (!f) return;
    this.formExcepcion.markAllAsTouched();
    const archivo = this.archivo();
    if (this.formExcepcion.invalid) return;
    if (!archivo) {
      this.errorDialogo.set('Adjunte la evidencia que sustenta el ajuste (PDF, JPG o PNG).');
      return;
    }
    const v = this.formExcepcion.getRawValue();
    if (v.ajuste === null || v.ajuste === 0) {
      this.errorDialogo.set('El ajuste no puede ser cero.');
      return;
    }
    this.guardando.set(true);
    this.errorDialogo.set('');
    try {
      await firstValueFrom(
        this.api.proponerExcepcion(
          f.solicitudId,
          { ajuste: v.ajuste, justificacion: v.justificacion.trim() },
          archivo,
        ),
      );
      this.cerrar();
      this.mensaje.set(
        `Propuesta registrada para ${f.radicado}. No cambia el puntaje hasta que la apruebe el responsable del proceso.`,
      );
      await this.buscar(this.pagina());
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const sueltos = aplicarErroresApi(this.formExcepcion, e.errores);
        if (sueltos.length) this.errorDialogo.set(sueltos.join(' '));
      } else {
        this.errorDialogo.set(
          e instanceof ApiError ? e.message : 'No pudimos guardar la propuesta.',
        );
      }
    } finally {
      this.guardando.set(false);
    }
  }

  protected signo(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }
}
