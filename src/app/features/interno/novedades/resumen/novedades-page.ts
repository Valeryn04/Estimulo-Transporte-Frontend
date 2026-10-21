import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { EstadoBeneficio, NOMBRE_ESTADO_BENEFICIO } from '../../asignacion/modelos-asignacion';
import { ExpedienteBeneficio } from '../expediente/expediente-beneficio';
import { ResumenBeneficio } from '../modelos-novedades';
import { NovedadesApi } from '../novedades-api';

/**
 * Novedades de los beneficios (RF-NOV-01): bloqueos, suspensiones y reactivaciones, y el inicio de las revocatorias.
 * Primero los beneficios detenidos, que son los que piden atención.
 */
@Component({
  selector: 'app-novedades-page',
  imports: [ReactiveFormsModule, RouterLink, ExpedienteBeneficio],
  templateUrl: './novedades-page.html',
  styleUrl: './novedades-page.scss',
})
export class NovedadesPage implements OnInit {
  private readonly api = inject(NovedadesApi);
  private readonly sesion = inject(Sesion);

  protected readonly datos = signal<{ items: ResumenBeneficio[]; total: number } | null>(null);
  protected readonly pagina = signal(1);
  protected readonly tamano = 25;
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly abierto = signal<number | null>(null);
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.datos()?.total ?? 0) / this.tamano)),
  );
  protected readonly puedeGestionar = computed(() => this.sesion.tiene(PERMISO.novedadesGestionar));
  protected readonly estados = NOMBRE_ESTADO_BENEFICIO;
  protected readonly opcionesEstado = Object.keys(NOMBRE_ESTADO_BENEFICIO) as EstadoBeneficio[];
  protected readonly filtros = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    estado: new FormControl<'' | EstadoBeneficio>('', { nonNullable: true }),
  });

  ngOnInit(): void {
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
          this.api.resumen(f.estado || undefined, f.q.trim() || undefined, pagina, this.tamano),
        ),
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los beneficios.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected limpiar(): void {
    this.filtros.reset({ q: '', estado: '' });
    void this.buscar();
  }
}
