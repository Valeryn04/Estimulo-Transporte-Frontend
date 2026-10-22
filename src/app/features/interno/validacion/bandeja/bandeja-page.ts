import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Bandeja, EstadoCaso, FiltroBandeja, Validador } from '../modelos-validacion';
import { ValidacionApi } from '../validacion-api';
import { Confirmar } from '../../../../shared/alertas/confirmar';

type Orden = FiltroBandeja['orden'];

/**
 * Bandeja de trabajo de validación (RF-VAL-01): casos pendientes con radicado, fecha, nombre, estado y días
 * transcurridos; se filtra y ordena, resalta los que superan el tiempo máximo de atención y permite al responsable
 * del proceso asignar y reasignar casos entre validadores.
 */
@Component({
  selector: 'app-bandeja-page',
  imports: [Confirmar, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './bandeja-page.html',
  styleUrl: './bandeja-page.scss',
})
export class BandejaPage implements OnInit {
  private readonly api = inject(ValidacionApi);
  protected readonly sesion = inject(Sesion);

  protected readonly datos = signal<Bandeja | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly pagina = signal(1);
  protected readonly tamano = 20;
  protected readonly orden = signal<Orden>('fecha');
  protected readonly direccion = signal<'asc' | 'desc'>('asc');
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.datos()?.total ?? 0) / this.tamano)),
  );

  protected readonly puedeAsignar = computed(() => this.sesion.tiene('validacion.asignar'));
  protected readonly puedeValidar = computed(() => this.sesion.tiene('validacion.validar'));
  protected readonly validadores = signal<Validador[]>([]);
  protected readonly seleccion = signal<ReadonlySet<number>>(new Set());
  protected readonly asignando = signal(false);
  protected readonly PERMISO = PERMISO;

  protected readonly estados: { valor: EstadoCaso; nombre: string }[] = [
    { valor: 'RADICADA', nombre: 'Radicada (nueva)' },
    { valor: 'SUBSANADA', nombre: 'Subsanada' },
    { valor: 'EN_REVISION', nombre: 'En revisión' },
    { valor: 'EN_SUBSANACION', nombre: 'Por subsanar (plazo vencido)' },
  ];

  protected readonly filtros = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    estado: new FormControl<EstadoCaso | ''>('', { nonNullable: true }),
    asignado: new FormControl('', { nonNullable: true }),
    vencidas: new FormControl(false, { nonNullable: true }),
  });
  protected readonly validadorElegido = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    if (this.puedeAsignar()) void this.cargarValidadores();
    void this.buscar();
  }

  private async cargarValidadores(): Promise<void> {
    try {
      this.validadores.set(await firstValueFrom(this.api.validadores()));
    } catch {
      this.validadores.set([]);
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
          this.api.bandeja({
            q: f.q.trim() || undefined,
            estado: f.estado || undefined,
            asignado: f.asignado || undefined,
            vencidas: f.vencidas || undefined,
            orden: this.orden(),
            direccion: this.direccion(),
            pagina,
            tamano: this.tamano,
          }),
        ),
      );
      this.seleccion.set(new Set());
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar la bandeja.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected limpiar(): void {
    this.filtros.reset({ q: '', estado: '', asignado: '', vencidas: false });
    void this.buscar();
  }

  protected ordenarPor(columna: Orden): void {
    if (this.orden() === columna) {
      this.direccion.set(this.direccion() === 'asc' ? 'desc' : 'asc');
    } else {
      this.orden.set(columna);
      this.direccion.set('asc');
    }
    void this.buscar();
  }

  protected ariaSort(columna: Orden): 'ascending' | 'descending' | 'none' {
    if (this.orden() !== columna) return 'none';
    return this.direccion() === 'asc' ? 'ascending' : 'descending';
  }

  // ---------------------------------------------------------------- asignación

  protected marcado(id: number): boolean {
    return this.seleccion().has(id);
  }

  protected alternar(id: number, activo: boolean): void {
    const nuevo = new Set(this.seleccion());
    if (activo) nuevo.add(id);
    else nuevo.delete(id);
    this.seleccion.set(nuevo);
  }

  protected alternarTodos(activo: boolean): void {
    this.seleccion.set(
      new Set(activo ? (this.datos()?.items ?? []).map((x) => x.solicitudId) : []),
    );
  }

  protected todosMarcados(): boolean {
    const items = this.datos()?.items ?? [];
    return items.length > 0 && items.every((x) => this.seleccion().has(x.solicitudId));
  }

  protected async asignar(sinAsignar = false): Promise<void> {
    const ids = [...this.seleccion()];
    const elegido = this.validadorElegido.value;
    if (ids.length === 0 || (!sinAsignar && !elegido)) return;
    this.asignando.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.asignar(ids, sinAsignar ? null : Number(elegido)));
      this.mensaje.set(
        sinAsignar
          ? `${ids.length} caso(s) quedaron sin asignar.`
          : `${ids.length} caso(s) asignado(s).`,
      );
      await this.buscar(this.pagina());
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos asignar los casos.');
    } finally {
      this.asignando.set(false);
    }
  }
}
