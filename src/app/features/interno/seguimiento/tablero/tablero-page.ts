import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Ayuda } from '../../../../shared/ayuda/ayuda';
import { ListasFiltro, Tablero } from '../modelos-seguimiento';
import { SeguimientoApi } from '../seguimiento-api';

/**
 * Tablero de control (RF-SEG-04): cuántos casos hay en cada etapa, el avance contra la meta de beneficiarios, la
 * ejecución del presupuesto, los tiempos promedio entre etapas y la satisfacción.
 */
@Component({
  selector: 'app-tablero-page',
  imports: [CurrencyPipe, DecimalPipe, ReactiveFormsModule, Ayuda],
  templateUrl: './tablero-page.html',
  styleUrl: './tablero-page.scss',
})
export class TableroPage implements OnInit {
  private readonly api = inject(SeguimientoApi);

  protected readonly datos = signal<Tablero | null>(null);
  protected readonly listas = signal<ListasFiltro | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');

  protected readonly filtros = new FormGroup({
    vigenciaId: new FormControl('', { nonNullable: true }),
    localidadId: new FormControl('', { nonNullable: true }),
    poblacion: new FormControl<'' | 'CON_CUIDADOR' | 'SIN_CUIDADOR'>('', { nonNullable: true }),
  });

  /** Etapas del flujo principal; la barra compara cada una con las preinscripciones. */
  protected readonly etapas = computed(() => {
    const e = this.datos()?.embudo;
    if (!e) return [];
    const base = Math.max(e.preinscritos, 1);
    return [
      { clave: 'preinscritos', nombre: 'Preinscritos', valor: e.preinscritos },
      { clave: 'caracterizados', nombre: 'Caracterizados', valor: e.caracterizados },
      { clave: 'enVerificacion', nombre: 'En verificación', valor: e.enVerificacion },
      { clave: 'validados', nombre: 'Validados', valor: e.validados },
      { clave: 'priorizados', nombre: 'Priorizados', valor: e.priorizados },
      { clave: 'asignados', nombre: 'Asignados', valor: e.asignados },
      { clave: 'entregas', nombre: 'Tarjetas entregadas', valor: e.entregas },
      { clave: 'activos', nombre: 'Activos', valor: e.activos },
    ].map((x) => ({ ...x, ancho: Math.min((x.valor / base) * 100, 100) }));
  });

  /** Casos fuera del camino principal: esperan una corrección, un cupo o no cumplieron. */
  protected readonly fuera = computed(() => {
    const e = this.datos()?.embudo;
    if (!e) return [];
    return [
      { clave: 'porSubsanar', nombre: 'Por subsanar', valor: e.porSubsanar },
      { clave: 'listaEspera', nombre: 'En lista de espera', valor: e.listaEspera },
      { clave: 'rechazados', nombre: 'No cumplen', valor: e.rechazados },
    ];
  });

  /** Ancho de una localidad frente a la que más solicitudes tiene. */
  protected ancho(solicitudes: number): number {
    const mayor = Math.max(...(this.datos()?.porLocalidad.map((l) => l.solicitudes) ?? [1]), 1);
    return (solicitudes / mayor) * 100;
  }

  protected readonly tiempos = computed(() => {
    const t = this.datos()?.tiemposPromedioDias;
    if (!t) return [];
    return [
      { nombre: 'Radicación → primera decisión de validación', dias: t.validacion },
      { nombre: 'Aprobación → puntaje', dias: t.priorizacion },
      { nombre: 'Puntaje → asignación', dias: t.asignacion },
      { nombre: 'Asignación → entrega de la tarjeta', dias: t.entrega },
    ];
  });

  ngOnInit(): void {
    void this.cargarListas();
    void this.consultar();
  }

  private async cargarListas(): Promise<void> {
    try {
      this.listas.set(await firstValueFrom(this.api.listas()));
    } catch {
      this.listas.set(null);
    }
  }

  protected async consultar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    const f = this.filtros.getRawValue();
    try {
      this.datos.set(
        await firstValueFrom(
          this.api.tablero({
            vigenciaId: f.vigenciaId ? Number(f.vigenciaId) : undefined,
            localidadId: f.localidadId ? Number(f.localidadId) : undefined,
            poblacion: f.poblacion || undefined,
          }),
        ),
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar el tablero.');
    } finally {
      this.cargando.set(false);
    }
  }
}
