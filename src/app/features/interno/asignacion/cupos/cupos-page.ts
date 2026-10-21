import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { AsignacionApi } from '../asignacion-api';
import {
  AjusteCupos,
  CambioCupos,
  CuposConCatalogos,
  ItemDistribucion,
  NOMBRE_AJUSTE,
} from '../modelos-asignacion';
import { Ayuda } from '../../../../shared/ayuda/ayuda';

const filaDistribucion = (itemId: number | null = null, cupos: number | null = null) =>
  new FormGroup({
    itemId: new FormControl<number | null>(itemId, { validators: [Validators.required] }),
    cupos: new FormControl<number | null>(cupos, {
      validators: [Validators.required, Validators.min(0)],
    }),
  });

type Distribucion = FormArray<ReturnType<typeof filaDistribucion>>;

/**
 * Cupos y presupuesto de la vigencia (RF-ASI-01): control en línea de lo ocupado, liberado y disponible, valor del
 * estímulo y distribución por localidad o transporte. Cada modificación exige su motivo y, para cupos y presupuesto,
 * el soporte (por ejemplo, el acto de adición presupuestal).
 */
@Component({
  selector: 'app-cupos-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule, Campo, CampoControl, Ayuda],
  templateUrl: './cupos-page.html',
  styleUrl: './cupos-page.scss',
})
export class CuposPage implements OnInit {
  private readonly api = inject(AsignacionApi);
  private readonly sesion = inject(Sesion);

  protected readonly datos = signal<CuposConCatalogos | null>(null);
  protected readonly ajustes = signal<AjusteCupos[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly erroresForm = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly soporte = signal<File | null>(null);
  protected readonly nombreAjuste = NOMBRE_AJUSTE;

  protected readonly puedeAdministrar = computed(() => this.sesion.tiene(PERMISO.cupos));
  protected readonly pctCupos = computed(() => {
    const c = this.datos()?.cupos;
    return c && c.totales > 0 ? Math.min(100, Math.round((c.ocupados / c.totales) * 100)) : 0;
  });
  protected readonly pctPresupuesto = computed(() => {
    const p = this.datos()?.presupuesto;
    return p && p.total > 0 ? Math.min(100, Math.round((p.comprometido / p.total) * 100)) : 0;
  });

  protected readonly form = new FormGroup({
    cuposTotales: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    valorEstimulo: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    presupuestoTotal: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    motivo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(1000)],
    }),
    localidades: new FormArray<ReturnType<typeof filaDistribucion>>([]),
    transportes: new FormArray<ReturnType<typeof filaDistribucion>>([]),
  });

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [datos, ajustes] = await Promise.all([
        firstValueFrom(this.api.cupos()),
        firstValueFrom(this.api.ajustes()),
      ]);
      this.llenar(datos);
      this.ajustes.set(ajustes);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los cupos.');
    } finally {
      this.cargando.set(false);
    }
  }

  private llenar(d: CuposConCatalogos): void {
    this.datos.set(d);
    this.form.patchValue({
      cuposTotales: d.cupos.totales,
      valorEstimulo: d.valorEstimulo,
      presupuestoTotal: d.presupuesto.total,
      motivo: '',
    });
    for (const [lista, items] of [
      [this.form.controls.localidades, d.distribucion.localidades],
      [this.form.controls.transportes, d.distribucion.transportes],
    ] as const) {
      lista.clear();
      for (const i of items) lista.push(filaDistribucion(i.itemId, i.cupos));
    }
    this.soporte.set(null);
  }

  protected agregar(lista: Distribucion): void {
    lista.push(filaDistribucion());
  }

  protected quitar(lista: Distribucion, i: number): void {
    lista.removeAt(i);
  }

  protected elegirSoporte(evento: Event): void {
    this.soporte.set((evento.target as HTMLInputElement).files?.[0] ?? null);
  }

  /** Lo ocupado de un elemento de la distribución actual, para mostrarlo junto a su tope. */
  protected ocupados(items: ItemDistribucion[], itemId: number | null): number | null {
    return items.find((x) => x.itemId === itemId)?.ocupados ?? null;
  }

  private filas(lista: Distribucion): { itemId: number; cupos: number }[] {
    return lista.getRawValue().map((f) => ({ itemId: Number(f.itemId), cupos: Number(f.cupos) }));
  }

  private mismaDistribucion(
    nueva: { itemId: number; cupos: number }[],
    actual: ItemDistribucion[],
  ): boolean {
    return (
      nueva.length === actual.length &&
      nueva.every((n) => actual.some((a) => a.itemId === n.itemId && a.cupos === n.cupos))
    );
  }

  protected async guardar(): Promise<void> {
    const d = this.datos();
    if (!d) return;
    this.form.markAllAsTouched();
    this.erroresForm.set([]);
    this.mensaje.set('');
    this.error.set('');
    if (this.form.invalid) {
      this.erroresForm.set([
        'Revise los datos: todos los campos son obligatorios y el motivo necesita al menos 10 caracteres.',
      ]);
      return;
    }
    const v = this.form.getRawValue();
    const cambio: CambioCupos = { motivo: v.motivo.trim() };
    if (v.cuposTotales !== d.cupos.totales) cambio.cuposTotales = Number(v.cuposTotales);
    if (v.valorEstimulo !== d.valorEstimulo) cambio.valorEstimulo = Number(v.valorEstimulo);
    if (v.presupuestoTotal !== d.presupuesto.total)
      cambio.presupuestoTotal = Number(v.presupuestoTotal);
    const loc = this.filas(this.form.controls.localidades);
    if (!this.mismaDistribucion(loc, d.distribucion.localidades))
      cambio.distribucionLocalidad = loc;
    const tra = this.filas(this.form.controls.transportes);
    if (!this.mismaDistribucion(tra, d.distribucion.transportes))
      cambio.distribucionTransporte = tra;
    if (Object.keys(cambio).length === 1) {
      this.erroresForm.set(['No hay ningún cambio respecto a lo vigente.']);
      return;
    }
    if (
      (cambio.cuposTotales !== undefined || cambio.presupuestoTotal !== undefined) &&
      !this.soporte()
    ) {
      this.erroresForm.set([
        'Adjunte el soporte del cambio de cupos o presupuesto (por ejemplo, el acto de adición).',
      ]);
      return;
    }
    this.guardando.set(true);
    try {
      this.llenar(await firstValueFrom(this.api.ajustarCupos(cambio, this.soporte())));
      this.ajustes.set(await firstValueFrom(this.api.ajustes()));
      this.mensaje.set('Cambio registrado con su motivo y su soporte.');
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        this.erroresForm.set(e.errores.map((x) => x.mensaje));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos guardar el cambio.');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  protected resumenAjuste(a: AjusteCupos): string {
    const f = (v: unknown): string =>
      Array.isArray(v)
        ? v.length === 0
          ? 'sin distribución'
          : v
              .map(
                (x: { nombre?: string; itemId: number; cupos: number }) =>
                  `${x.nombre ?? '#' + x.itemId}: ${x.cupos}`,
              )
              .join(', ')
        : String(v);
    return `${f(a.valorAnterior)} → ${f(a.valorNuevo)}`;
  }

  protected async verSoporte(a: AjusteCupos): Promise<void> {
    this.error.set('');
    try {
      const blob = await firstValueFrom(this.api.soporte(a.id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos abrir el soporte.');
    }
  }
}
