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
import { Pestanas } from '../../../../shared/pestanas/pestanas';
import { Alertas } from '../../../../shared/alertas/alertas';
import { valorDe } from '../../../../shared/forms';

const filaDistribucion = (itemId: number | null = null, cupos: number | null = null) =>
  new FormGroup({
    itemId: new FormControl<number | null>(itemId, { validators: [Validators.required] }),
    cupos: new FormControl<number | null>(cupos, {
      validators: [Validators.required, Validators.min(0)],
    }),
  });

type Distribucion = FormArray<ReturnType<typeof filaDistribucion>>;

/**
 * Cupos y presupuesto de la vigencia (RF-ASI-01): control en línea de lo ocupado, liberado y disponible, valor
 * estándar del estímulo por persona y distribución por localidad o transporte. Se escriben los cupos y el valor: el
 * presupuesto sale solo (cupos × valor × 2 personas por cupo). Cada modificación exige solo su motivo.
 */
@Component({
  selector: 'app-cupos-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    Campo,
    CampoControl,
    Pestanas,
  ],
  templateUrl: './cupos-page.html',
  styleUrl: './cupos-page.scss',
})
export class CuposPage implements OnInit {
  private readonly api = inject(AsignacionApi);
  private readonly sesion = inject(Sesion);
  private readonly alertas = inject(Alertas);

  protected readonly datos = signal<CuposConCatalogos | null>(null);
  protected readonly ajustes = signal<AjusteCupos[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly erroresForm = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly nombreAjuste = NOMBRE_AJUSTE;

  protected readonly form = new FormGroup({
    cuposTotales: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    valorEstimulo: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    motivo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(1000)],
    }),
    localidades: new FormArray<ReturnType<typeof filaDistribucion>>([]),
    transportes: new FormArray<ReturnType<typeof filaDistribucion>>([]),
  });

  /** Personas que puede tener un cupo (la persona con discapacidad y su cuidador). */
  protected readonly PERSONAS_POR_CUPO = 2;
  private readonly cuposEscritos = valorDe(this.form.controls.cuposTotales);
  private readonly valorEscrito = valorDe(this.form.controls.valorEstimulo);
  /** El presupuesto no se escribe: sale de los cupos y del valor estándar por persona. */
  protected readonly presupuestoCalculado = computed(() =>
    Math.round(
      Number(this.cuposEscritos() ?? 0) * Number(this.valorEscrito() ?? 0) * this.PERSONAS_POR_CUPO,
    ),
  );

  protected readonly puedeAdministrar = computed(() => this.sesion.tiene(PERMISO.cupos));
  protected readonly pctCupos = computed(() => {
    const c = this.datos()?.cupos;
    return c && c.totales > 0 ? Math.min(100, Math.round((c.ocupados / c.totales) * 100)) : 0;
  });
  protected readonly pctPresupuesto = computed(() => {
    const p = this.datos()?.presupuesto;
    return p && p.total > 0 ? Math.min(100, Math.round((p.comprometido / p.total) * 100)) : 0;
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
      motivo: '',
    });
    for (const [lista, items] of [
      [this.form.controls.localidades, d.distribucion.localidades],
      [this.form.controls.transportes, d.distribucion.transportes],
    ] as const) {
      lista.clear();
      for (const i of items) lista.push(filaDistribucion(i.itemId, i.cupos));
    }
    // Los datos recién guardados no deben mostrarse como errores del envío anterior.
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  /** Reparte los cupos en partes iguales entre todos los elementos del catálogo (el resto, a los primeros). Se puede editar. */
  protected repartirParejo(lista: Distribucion, items: { id: number }[]): void {
    const total = Number(this.form.controls.cuposTotales.value ?? 0);
    if (items.length === 0 || total <= 0) return;
    const base = Math.floor(total / items.length);
    const resto = total - base * items.length;
    lista.clear();
    items.forEach((it, i) => lista.push(filaDistribucion(it.id, base + (i < resto ? 1 : 0))));
    lista.markAsDirty();
  }

  protected agregar(lista: Distribucion): void {
    lista.push(filaDistribucion());
  }

  protected quitar(lista: Distribucion, i: number): void {
    lista.removeAt(i);
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

  /** Revisa lo escrito con las mismas reglas del servidor, para decir qué corregir antes de enviar. */
  private problemas(d: CuposConCatalogos): string[] {
    const v = this.form.getRawValue();
    const p: string[] = [];
    const cupos = v.cuposTotales;
    if (cupos === null || !Number.isInteger(cupos) || cupos < 0) {
      p.push('Cupos totales: escriba un número entero, cero o mayor.');
    } else if (cupos < d.cupos.ocupados) {
      p.push(
        `Cupos totales: no pueden ser menos que los ${d.cupos.ocupados} que ya están ocupados.`,
      );
    }
    if (v.valorEstimulo === null || v.valorEstimulo < 0) {
      p.push('Valor del estímulo: escriba un valor de cero o mayor.');
    }
    if (this.presupuestoCalculado() < d.presupuesto.comprometido) {
      p.push(
        'El presupuesto que resulta (cupos × valor por persona × 2) no puede ser menor que lo que ya está comprometido.',
      );
    }
    if (v.motivo.trim().length < 10) {
      p.push('Motivo del cambio: explique el cambio con al menos 10 caracteres.');
    }
    const tope = cupos !== null && cupos >= 0 ? cupos : d.cupos.totales;
    for (const [nombre, lista, vigente] of [
      ['localidad', this.form.controls.localidades, d.distribucion.localidades],
      ['tipo de transporte', this.form.controls.transportes, d.distribucion.transportes],
    ] as const) {
      const filas = lista.getRawValue();
      if (filas.some((f) => f.itemId === null || f.cupos === null)) {
        p.push(`Cupos por ${nombre}: complete cada fila o quítela.`);
        continue;
      }
      const ids = filas.map((f) => f.itemId);
      if (new Set(ids).size !== ids.length)
        p.push(`Cupos por ${nombre}: hay un elemento repetido.`);
      if (filas.some((f) => (f.cupos as number) < 0 || !Number.isInteger(f.cupos))) {
        p.push(`Cupos por ${nombre}: los cupos son números enteros, cero o mayores.`);
      }
      if (filas.reduce((t, f) => t + Number(f.cupos), 0) > tope) {
        p.push(`Cupos por ${nombre}: la suma no puede superar los ${tope} cupos de la vigencia.`);
      }
      for (const f of filas) {
        const actual = vigente.find((x) => x.itemId === f.itemId);
        if (actual && Number(f.cupos) < actual.ocupados) {
          p.push(
            `Cupos por ${nombre}: «${actual.nombre}» ya tiene ${actual.ocupados} cupos ocupados y no puede quedar con menos.`,
          );
        }
      }
    }
    return p;
  }

  private descripcion(d: CuposConCatalogos, c: CambioCupos): string {
    const num = (n: number) => n.toLocaleString('es-CO');
    const partes: string[] = [];
    if (c.cuposTotales !== undefined)
      partes.push(`cupos: ${num(d.cupos.totales)} → ${num(c.cuposTotales)}`);
    if (c.valorEstimulo !== undefined)
      partes.push(`valor del estímulo: $${num(d.valorEstimulo)} → $${num(c.valorEstimulo)}`);
    if (c.cuposTotales !== undefined || c.valorEstimulo !== undefined)
      partes.push(
        `presupuesto (automático): $${num(d.presupuesto.total)} → $${num(this.presupuestoCalculado())}`,
      );
    if (c.distribucionLocalidad !== undefined) partes.push('distribución por localidad');
    if (c.distribucionTransporte !== undefined) partes.push('distribución por transporte');
    return `Se modificará: ${partes.join('; ')}.`;
  }

  protected async guardar(): Promise<void> {
    const d = this.datos();
    if (!d || this.guardando()) return;
    this.form.markAllAsTouched();
    this.erroresForm.set([]);
    this.mensaje.set('');
    this.error.set('');
    const problemas = this.problemas(d);
    if (problemas.length > 0) {
      this.erroresForm.set(problemas);
      return;
    }
    const v = this.form.getRawValue();
    // Lo que se tenía cargado: si otra persona lo cambió mientras se editaba, el servidor no pisa su cambio.
    const cambio: CambioCupos = {
      motivo: v.motivo.trim(),
      base: {
        cuposTotales: d.cupos.totales,
        valorEstimulo: d.valorEstimulo,
      },
    };
    if (v.cuposTotales !== d.cupos.totales) cambio.cuposTotales = Number(v.cuposTotales);
    if (v.valorEstimulo !== d.valorEstimulo) cambio.valorEstimulo = Number(v.valorEstimulo);
    const loc = this.filas(this.form.controls.localidades);
    if (!this.mismaDistribucion(loc, d.distribucion.localidades))
      cambio.distribucionLocalidad = loc;
    const tra = this.filas(this.form.controls.transportes);
    if (!this.mismaDistribucion(tra, d.distribucion.transportes))
      cambio.distribucionTransporte = tra;
    if (Object.keys(cambio).length === 2) {
      this.erroresForm.set([
        'No hay ningún cambio: modifique alguno de los valores vigentes antes de registrar.',
      ]);
      return;
    }
    const confirmado = await this.alertas.confirmar({
      titulo: '¿Registrar este cambio?',
      texto: `${this.descripcion(d, cambio)} Quedará en el historial con su motivo.`,
      confirmar: 'Sí, registrar',
    });
    if (!confirmado) return;
    this.guardando.set(true);
    try {
      this.llenar(await firstValueFrom(this.api.ajustarCupos(cambio)));
      this.ajustes.set(await firstValueFrom(this.api.ajustes()));
      this.mensaje.set('Cambio registrado con su motivo. Ya aparece en el historial.');
      this.alertas.exito('Cambio registrado');
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        this.erroresForm.set(e.errores.map((x) => x.mensaje));
      } else {
        this.erroresForm.set([e instanceof ApiError ? e.message : 'No pudimos guardar el cambio.']);
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
