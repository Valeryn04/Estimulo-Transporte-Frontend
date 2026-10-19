import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Sesion } from '../../../../core/auth/sesion';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import {
  AlertaCruce,
  Caso,
  DecisionValidacion,
  DocumentoCaso,
  ItemCaso,
  NOMBRE_RESULTADO,
  RESULTADOS,
  ResultadoDecision,
} from '../modelos-validacion';
import { ValidacionApi } from '../validacion-api';
import { SECCIONES_DATOS, valorLegible } from './datos-caso';

const NOMBRE_DECISION: Record<DecisionValidacion, string> = {
  APROBAR: 'Aprobar la validación',
  SUBSANAR: 'Solicitar subsanación',
  RECHAZAR: 'Rechazar la solicitud',
};

type FormItem = FormGroup<{
  resultado: FormControl<string>;
  fuente: FormControl<string>;
  observacion: FormControl<string>;
  evidencia: FormControl<string>;
}>;

/**
 * Revisión de un caso (RF-VAL-02): datos y documentos de la persona, lista de chequeo requisito por requisito
 * (resultado, fuente, observación y evidencia) y decisión motivada: aprobar, solicitar subsanación o rechazar.
 */
@Component({
  selector: 'app-caso-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Dialogo],
  templateUrl: './caso-page.html',
  styleUrl: './caso-page.scss',
})
export class CasoPage implements OnInit {
  private readonly api = inject(ValidacionApi);
  private readonly router = inject(Router);
  protected readonly sesion = inject(Sesion);

  /** Parámetro de la ruta: número de la solicitud. */
  readonly id = input.required<string>();

  protected readonly caso = signal<Caso | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly resultados = RESULTADOS;
  protected readonly nombreResultado = NOMBRE_RESULTADO;
  protected readonly secciones = SECCIONES_DATOS;
  protected readonly nombreDecision = NOMBRE_DECISION;
  protected readonly decisiones: DecisionValidacion[] = ['APROBAR', 'SUBSANAR', 'RECHAZAR'];

  /** Un formulario por requisito, para guardar cada uno al cambiarlo. */
  protected readonly formItems = signal<Record<number, FormItem>>({});
  protected readonly guardando = signal<ReadonlySet<number>>(new Set());
  protected readonly guardados = signal<ReadonlySet<number>>(new Set());
  protected readonly errorItem = signal<Record<number, string>>({});

  protected readonly formDecision = new FormGroup({
    decision: new FormControl<DecisionValidacion | ''>('', { nonNullable: true }),
    motivacion: new FormControl('', { nonNullable: true }),
  });
  protected readonly decidiendo = signal(false);
  protected readonly confirmando = signal(false);
  protected readonly erroresDecision = signal<string[]>([]);
  protected readonly resultado = signal<ResultadoDecision | null>(null);

  protected readonly puedeEditar = computed(() => this.caso()?.validacion.puedeEditar === true);
  protected readonly porCorregir = computed(() =>
    (this.caso()?.items ?? []).filter(
      (i) => i.resultado === 'NO_CUMPLE' || i.resultado === 'PENDIENTE',
    ),
  );
  protected readonly resumen = computed(() => {
    const items = this.caso()?.items ?? [];
    const cuenta = (r: string) => items.filter((i) => i.resultado === r).length;
    return {
      total: items.length,
      cumple: cuenta('CUMPLE'),
      noCumple: cuenta('NO_CUMPLE'),
      pendiente: cuenta('PENDIENTE'),
      noAplica: cuenta('NO_APLICA'),
    };
  });
  protected readonly decisionElegida = signal<DecisionValidacion | ''>('');

  async ngOnInit(): Promise<void> {
    const id = Number(this.id());
    try {
      let abierto: Caso;
      if (this.sesion.tiene('validacion.validar')) {
        try {
          // Al abrir el caso queda «en revisión» a nombre de quien lo abre (RF-VAL-01).
          abierto = await firstValueFrom(this.api.tomar(id));
        } catch (e) {
          if (e instanceof ApiError && e.estado === 409) {
            this.aviso.set(e.message);
            abierto = await firstValueFrom(this.api.caso(id));
          } else {
            throw e;
          }
        }
      } else {
        abierto = await firstValueFrom(this.api.caso(id));
      }
      this.asignarCaso(abierto);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar el caso.');
    } finally {
      this.cargando.set(false);
    }
  }

  private asignarCaso(c: Caso): void {
    this.caso.set(c);
    const forms: Record<number, FormItem> = {};
    for (const i of c.items) forms[i.id] = this.crearFormItem(i);
    this.formItems.set(forms);
  }

  private crearFormItem(i: ItemCaso): FormItem {
    return new FormGroup({
      resultado: new FormControl<string>(i.resultado, { nonNullable: true }),
      fuente: new FormControl(i.fuente, { nonNullable: true }),
      observacion: new FormControl(i.observacion, { nonNullable: true }),
      evidencia: new FormControl(i.evidencia, { nonNullable: true }),
    });
  }

  protected valor(campo: string): string {
    const c = this.caso();
    return c ? valorLegible(campo, c.datos, c.catalogos, c.sensiblesOcultos) : '';
  }

  protected formDe(i: ItemCaso): FormItem {
    return this.formItems()[i.id] as FormItem;
  }

  protected documentoDe(i: ItemCaso): DocumentoCaso | undefined {
    return this.caso()?.documentos.find((d) => d.id === i.documentoId);
  }

  // ---------------------------------------------------------------- lista de chequeo

  /** Guarda el requisito con lo que hay en pantalla. */
  protected async guardarItem(i: ItemCaso): Promise<void> {
    const c = this.caso();
    if (!c || !this.puedeEditar()) return;
    const v = this.formDe(i).getRawValue();
    const marcar = (conjunto: ReadonlySet<number>, activo: boolean) => {
      const nuevo = new Set(conjunto);
      if (activo) nuevo.add(i.id);
      else nuevo.delete(i.id);
      return nuevo;
    };
    this.guardando.update((s) => marcar(s, true));
    this.guardados.update((s) => marcar(s, false));
    this.errorItem.update((e) => ({ ...e, [i.id]: '' }));
    try {
      const nuevo = await firstValueFrom(
        this.api.registrarItem(c.solicitud.id, i.id, {
          resultado: v.resultado as ItemCaso['resultado'],
          fuente: v.fuente,
          observacion: v.observacion,
          evidencia: v.evidencia,
        }),
      );
      this.caso.set({ ...c, items: c.items.map((x) => (x.id === i.id ? nuevo : x)) });
      this.guardados.update((s) => marcar(s, true));
    } catch (e) {
      this.errorItem.update((m) => ({
        ...m,
        [i.id]:
          e instanceof ApiError
            ? e.errores.length > 0
              ? e.errores.map((x) => x.mensaje).join(' ')
              : e.message
            : 'No pudimos guardar este requisito.',
      }));
    } finally {
      this.guardando.update((s) => marcar(s, false));
    }
  }

  protected usarFuenteSugerida(i: ItemCaso): void {
    const control = this.formDe(i).controls.fuente;
    if (!control.value.trim()) {
      control.setValue(i.fuenteSugerida);
      void this.guardarItem(i);
    }
  }

  // ---------------------------------------------------------------- documentos

  /** La alerta del cruce con el que se contrasta el requisito, si el cruce existe. */
  protected alertaDe(i: ItemCaso): AlertaCruce | null {
    if (!i.cruceCodigo) return null;
    return this.caso()?.alertas.find((a) => a.cruceCodigo === i.cruceCodigo) ?? null;
  }

  protected nombrePersona(p: 'PCD' | 'CUIDADOR'): string {
    return p === 'PCD' ? 'la persona con discapacidad' : 'el cuidador';
  }

  protected async verDocumento(d: DocumentoCaso): Promise<void> {
    const c = this.caso();
    if (!c) return;
    this.error.set('');
    try {
      const archivo = await firstValueFrom(this.api.archivo(c.solicitud.id, d.id));
      const url = URL.createObjectURL(archivo);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos abrir el documento.');
    }
  }

  // ---------------------------------------------------------------- decisión

  protected elegirDecision(d: DecisionValidacion): void {
    this.formDecision.controls.decision.setValue(d);
    this.decisionElegida.set(d);
    this.erroresDecision.set([]);
  }

  protected pedirConfirmacion(): void {
    this.erroresDecision.set([]);
    if (!this.formDecision.controls.decision.value) {
      this.erroresDecision.set(['Elija una decisión: aprobar, solicitar subsanación o rechazar.']);
      return;
    }
    this.confirmando.set(true);
  }

  protected async decidir(): Promise<void> {
    const c = this.caso();
    const d = this.formDecision.getRawValue();
    if (!c || !d.decision) return;
    this.decidiendo.set(true);
    this.erroresDecision.set([]);
    try {
      this.resultado.set(
        await firstValueFrom(this.api.decidir(c.solicitud.id, d.decision, d.motivacion)),
      );
      this.confirmando.set(false);
    } catch (e) {
      this.confirmando.set(false);
      if (e instanceof ApiError) {
        this.erroresDecision.set(
          e.errores.length > 0 ? e.errores.map((x) => x.mensaje) : [e.message],
        );
      } else {
        this.erroresDecision.set(['No pudimos registrar la decisión.']);
      }
    } finally {
      this.decidiendo.set(false);
    }
  }

  protected async devolver(): Promise<void> {
    const c = this.caso();
    if (!c) return;
    try {
      await firstValueFrom(this.api.liberar(c.solicitud.id));
      await this.router.navigate(['/interno/validacion']);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos devolver el caso.');
    }
  }
}
