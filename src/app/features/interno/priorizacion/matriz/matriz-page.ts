import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import {
  DecisionPriorizacion,
  DefinicionMatriz,
  Matriz,
  NOMBRE_ESTADO_MATRIZ,
  NOMBRE_ORIGEN,
  OPCIONES_SUBSIDIOS,
  OrigenVariable,
  ResumenMatriz,
  Simulacion,
  VariableMatriz,
} from '../modelos-priorizacion';
import { PriorizacionApi } from '../priorizacion-api';
import { Ayuda } from '../../../../shared/ayuda/ayuda';
import { Pestanas } from '../../../../shared/pestanas/pestanas';

type Vista = 'ninguna' | 'simulacion' | 'decision';
const MAX_CRITERIOS = 4;

/** «Dependencia funcional» → «DEPENDENCIA_FUNCIONAL». */
export function derivarCodigo(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

const nuevaOpcion = (o: { codigo?: string; etiqueta?: string; puntos?: number } = {}) =>
  new FormGroup({
    codigo: new FormControl(o.codigo ?? '', { nonNullable: true }),
    etiqueta: new FormControl(o.etiqueta ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    puntos: new FormControl<number | null>(o.puntos ?? null, {
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    }),
  });

const nuevaVariable = (v?: VariableMatriz) =>
  new FormGroup({
    codigo: new FormControl(v?.codigo ?? '', { nonNullable: true }),
    nombre: new FormControl(v?.nombre ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(150)],
    }),
    descripcion: new FormControl(v?.descripcion ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    origen: new FormControl<OrigenVariable>(v?.origen ?? 'VALIDADOR', { nonNullable: true }),
    peso: new FormControl<number | null>(v?.peso ?? 1, {
      validators: [Validators.required, Validators.min(0.01), Validators.max(100)],
    }),
    opciones: new FormArray(
      (v?.opciones ?? [{}, {}]).map((o) => nuevaOpcion(o)),
      { validators: [Validators.required] },
    ),
  });

/**
 * Matriz de ponderación (RF-PRI-02): variables, opciones con sus puntos, pesos y criterios de desempate. Cada cambio es
 * una versión nueva que se edita como borrador, se simula contra los casos validados y se activa cuando la aprueba el
 * responsable del proceso (distinto de quien la pidió).
 */
@Component({
  selector: 'app-matriz-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, Dialogo, Ayuda, Pestanas],
  templateUrl: './matriz-page.html',
  styleUrl: './matriz-page.scss',
})
export class MatrizPage implements OnInit {
  private readonly api = inject(PriorizacionApi);
  private readonly sesion = inject(Sesion);

  protected readonly versiones = signal<ResumenMatriz[]>([]);
  protected readonly seleccionada = signal<Matriz | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly erroresForm = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly estados = NOMBRE_ESTADO_MATRIZ;
  protected readonly origenes = NOMBRE_ORIGEN;
  protected readonly origenesLista = Object.keys(NOMBRE_ORIGEN) as OrigenVariable[];

  protected readonly puedeAdministrar = computed(() => this.sesion.tiene(PERMISO.matriz));
  protected readonly puedeAprobar = computed(() => this.sesion.tiene(PERMISO.priorizacionAprobar));
  protected readonly hayAbierta = computed(() =>
    this.versiones().some((v) => v.estado === 'BORRADOR' || v.estado === 'EN_APROBACION'),
  );
  /** Se edita solo un borrador y solo quien administra la matriz. */
  protected readonly editable = computed(
    () => this.puedeAdministrar() && this.seleccionada()?.estado === 'BORRADOR',
  );

  protected readonly form = new FormGroup({
    notas: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    desempate: new FormArray(
      Array.from({ length: MAX_CRITERIOS }, () => new FormControl('', { nonNullable: true })),
    ),
    variables: new FormArray<ReturnType<typeof nuevaVariable>>([]),
  });

  // ---- diálogos
  protected readonly vista = signal<Vista>('ninguna');
  protected readonly simulacion = signal<Simulacion | null>(null);
  protected readonly decision = signal<DecisionPriorizacion>('APROBAR');
  protected readonly motivo = new FormControl('', { nonNullable: true });
  protected readonly errorDialogo = signal('');
  protected readonly cargandoSimulacion = signal(false);

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.versiones.set(await firstValueFrom(this.api.versiones()));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar las versiones.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected get variables(): FormArray<ReturnType<typeof nuevaVariable>> {
    return this.form.controls.variables;
  }

  protected opciones(i: number): FormArray<ReturnType<typeof nuevaOpcion>> {
    return this.variables.at(i).controls.opciones as FormArray<ReturnType<typeof nuevaOpcion>>;
  }

  // ---------------------------------------------------------------- abrir y editar

  protected async abrir(id: number): Promise<void> {
    this.error.set('');
    this.erroresForm.set([]);
    try {
      this.llenar(await firstValueFrom(this.api.version(id)));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos abrir la versión.');
    }
  }

  private llenar(m: Matriz): void {
    this.seleccionada.set(m);
    this.form.controls.notas.setValue(m.notas);
    this.form.controls.desempate.controls.forEach((c, i) => c.setValue(m.desempate[i] ?? ''));
    this.variables.clear();
    for (const v of m.variables) this.variables.push(nuevaVariable(v));
    this.form.markAsPristine();
  }

  protected async nuevaVersion(desdeId?: number): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      const m = await firstValueFrom(this.api.crearBorrador(desdeId));
      this.mensaje.set(
        `Se creó la versión ${m.version} como borrador. Modifíquela, simúlela y pida su aprobación.`,
      );
      await this.cargar();
      this.llenar(m);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos crear la versión.');
    }
  }

  protected agregarVariable(): void {
    this.variables.push(nuevaVariable());
  }

  protected quitarVariable(i: number): void {
    this.variables.removeAt(i);
  }

  protected agregarOpcion(i: number): void {
    this.opciones(i).push(nuevaOpcion());
  }

  protected quitarOpcion(i: number, j: number): void {
    this.opciones(i).removeAt(j);
  }

  /** La variable que sale de la caracterización solo tiene dos opciones fijas. */
  protected cambiarOrigen(i: number): void {
    const v = this.variables.at(i);
    if (v.controls.origen.value === 'SUBSIDIOS') {
      this.opciones(i).clear();
      for (const o of OPCIONES_SUBSIDIOS) this.opciones(i).push(nuevaOpcion({ ...o, puntos: 0 }));
    }
  }

  protected esSubsidios(i: number): boolean {
    return this.variables.at(i).controls.origen.value === 'SUBSIDIOS';
  }

  /** Código de la variable (el que ya tiene o el que saldrá del nombre). */
  private codigoVariable(i: number): string {
    const v = this.variables.at(i).controls;
    return v.codigo.value || derivarCodigo(v.nombre.value);
  }

  /** Criterios de desempate que se pueden elegir con las variables que hay ahora. */
  protected criterios(): { valor: string; nombre: string }[] {
    const lista = [{ valor: 'FECHA_RADICACION', nombre: 'Fecha de radicación más antigua' }];
    this.variables.controls.forEach((v, i) => {
      const codigo = this.codigoVariable(i);
      if (codigo)
        lista.push({ valor: `VARIABLE:${codigo}`, nombre: `Mayor «${v.controls.nombre.value}»` });
    });
    return lista;
  }

  private definicion(): DefinicionMatriz {
    const v = this.form.getRawValue();
    const usados = new Set<string>();
    const variables: VariableMatriz[] = v.variables.map((x, i) => {
      let codigo = this.codigoVariable(i);
      for (let n = 2; usados.has(codigo); n++) codigo = `${codigo.slice(0, 56)}_${n}`;
      usados.add(codigo);
      const opcionesUsadas = new Set<string>();
      return {
        codigo,
        nombre: x.nombre.trim(),
        descripcion: x.descripcion.trim(),
        origen: x.origen,
        peso: Number(x.peso),
        opciones: x.opciones.map((o) => {
          let c = o.codigo || derivarCodigo(o.etiqueta) || 'OPCION';
          for (let n = 2; opcionesUsadas.has(c); n++) c = `${c.slice(0, 56)}_${n}`;
          opcionesUsadas.add(c);
          return { codigo: c, etiqueta: o.etiqueta.trim(), puntos: Number(o.puntos) };
        }),
      };
    });
    const validos = new Set(['FECHA_RADICACION', ...variables.map((x) => `VARIABLE:${x.codigo}`)]);
    return {
      notas: v.notas.trim(),
      desempate: [...new Set(v.desempate.filter((c) => c && validos.has(c)))],
      variables,
    };
  }

  protected async guardar(): Promise<boolean> {
    const m = this.seleccionada();
    if (!m) return false;
    this.form.markAllAsTouched();
    this.erroresForm.set([]);
    this.error.set('');
    if (this.form.invalid) {
      this.erroresForm.set([
        'Revise la matriz: cada variable necesita nombre, peso y opciones con su etiqueta y puntos.',
      ]);
      return false;
    }
    this.guardando.set(true);
    try {
      const guardada = await firstValueFrom(this.api.guardarBorrador(m.id, this.definicion()));
      this.llenar(guardada);
      this.mensaje.set(
        `Versión ${guardada.version} guardada. Puntaje máximo: ${guardada.puntajeMaximo}.`,
      );
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        this.erroresForm.set(e.errores.map((x) => x.mensaje));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos guardar la matriz.');
      }
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  // ---------------------------------------------------------------- simulación, aprobación y decisión

  protected cerrar(): void {
    this.vista.set('ninguna');
  }

  protected async simular(id: number): Promise<void> {
    this.simulacion.set(null);
    this.errorDialogo.set('');
    this.vista.set('simulacion');
    this.cargandoSimulacion.set(true);
    try {
      this.simulacion.set(await firstValueFrom(this.api.simular(id)));
    } catch (e) {
      this.errorDialogo.set(e instanceof ApiError ? e.message : 'No pudimos simular.');
    } finally {
      this.cargandoSimulacion.set(false);
    }
  }

  /** Se simula lo que está en pantalla: primero se guarda el borrador. */
  protected async simularBorrador(): Promise<void> {
    const m = this.seleccionada();
    if (!m) return;
    if (this.editable() && !(await this.guardar())) return;
    await this.simular(m.id);
  }

  protected async pedirAprobacion(): Promise<void> {
    const m = this.seleccionada();
    if (!m) return;
    if (!(await this.guardar())) return;
    this.mensaje.set('');
    try {
      const r = await firstValueFrom(this.api.solicitarAprobacion(m.id));
      this.mensaje.set(
        `La versión ${r.version} quedó pendiente de aprobación del responsable del proceso.`,
      );
      await this.cargar();
      this.llenar(r);
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        this.erroresForm.set(e.errores.map((x) => x.mensaje));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos pedir la aprobación.');
      }
    }
  }

  /** Quien pidió la aprobación no la decide. */
  protected puedeDecidir(m: Matriz): boolean {
    return (
      this.puedeAprobar() &&
      m.estado === 'EN_APROBACION' &&
      m.solicitadaPor !== this.sesion.perfil()?.usuario
    );
  }

  protected abrirDecision(d: DecisionPriorizacion): void {
    this.decision.set(d);
    this.motivo.setValue('');
    this.errorDialogo.set('');
    this.vista.set('decision');
  }

  protected async decidir(): Promise<void> {
    const m = this.seleccionada();
    if (!m) return;
    const motivo = this.motivo.value.trim();
    if (this.decision() === 'RECHAZAR' && motivo.length < 5) {
      this.errorDialogo.set('Explique por qué se rechaza (mínimo 5 caracteres).');
      return;
    }
    this.errorDialogo.set('');
    try {
      const r = await firstValueFrom(this.api.decidirVersion(m.id, this.decision(), motivo));
      this.cerrar();
      this.mensaje.set(
        this.decision() === 'APROBAR'
          ? `La versión ${r.version} quedó vigente. Los casos ya calculados conservan su versión; recalcule en el listado priorizado para aplicarla.`
          : `La versión ${r.version} fue rechazada.`,
      );
      await this.cargar();
      this.llenar(r);
    } catch (e) {
      this.errorDialogo.set(
        e instanceof ApiError ? e.message : 'No pudimos registrar la decisión.',
      );
    }
  }

  protected signo(n: number | null): string {
    if (n === null || n === 0) return '=';
    return n > 0 ? `▲ ${n}` : `▼ ${-n}`;
  }
}
