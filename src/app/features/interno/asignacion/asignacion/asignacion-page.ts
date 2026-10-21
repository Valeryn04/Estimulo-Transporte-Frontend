import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { AsignacionApi } from '../asignacion-api';
import { EntregaBeneficio } from '../entrega/entrega-beneficio';
import {
  Beneficiario,
  EstadoBeneficio,
  FilaPropuesta,
  NOMBRE_ESTADO_BENEFICIO,
  Propuesta,
} from '../modelos-asignacion';

type Pestana = 'propuesta' | 'beneficiarios';
type Dialogos = 'ninguno' | 'omisiones' | 'espera';

/**
 * Asignación (RF-ASI-02, RF-ASI-03): propone los casos en orden de prioridad según los cupos y el presupuesto, el
 * asignador confirma de forma individual o por lotes (con la causa de cada caso que se salte), pasa a lista de espera
 * los que no alcanzan y consulta los beneficios asignados con la trazabilidad de los cupos reasignados.
 */
@Component({
  selector: 'app-asignacion-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    Dialogo,
    EntregaBeneficio,
  ],
  templateUrl: './asignacion-page.html',
  styleUrl: './asignacion-page.scss',
})
export class AsignacionPage implements OnInit {
  private readonly api = inject(AsignacionApi);
  private readonly sesion = inject(Sesion);

  protected readonly pestana = signal<Pestana>('propuesta');
  protected readonly propuesta = signal<Propuesta | null>(null);
  protected readonly pagina = signal(1);
  protected readonly tamano = 50;
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly seleccion = signal<ReadonlySet<number>>(new Set());
  protected readonly asignando = signal(false);
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.propuesta()?.total ?? 0) / this.tamano)),
  );
  protected readonly puedeAsignar = computed(() => this.sesion.tiene(PERMISO.asignacionAsignar));
  protected readonly puedeCupos = computed(() => this.sesion.tiene(PERMISO.cupos));

  // ---- diálogos
  protected readonly dialogo = signal<Dialogos>('ninguno');
  protected readonly saltados = signal<FilaPropuesta[]>([]);
  protected readonly errorDialogo = signal('');
  protected readonly causas = new FormArray<FormControl<string>>([]);
  protected readonly formCausas = new FormGroup({ causas: this.causas });

  // ---- beneficiarios
  protected readonly beneficiarios = signal<{ items: Beneficiario[]; total: number } | null>(null);
  protected readonly paginaBen = signal(1);
  /** Beneficio cuya entrega se está viendo o registrando. */
  protected readonly entregaId = signal<number | null>(null);
  protected readonly totalPaginasBen = computed(() =>
    Math.max(1, Math.ceil((this.beneficiarios()?.total ?? 0) / this.tamano)),
  );
  protected readonly estados = NOMBRE_ESTADO_BENEFICIO;
  protected readonly opcionesEstado = Object.keys(NOMBRE_ESTADO_BENEFICIO) as EstadoBeneficio[];
  protected readonly filtroBen = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    estado: new FormControl<'' | EstadoBeneficio>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    void this.cargarPropuesta();
  }

  protected cambiarPestana(p: Pestana): void {
    this.pestana.set(p);
    if (p === 'beneficiarios' && !this.beneficiarios()) void this.cargarBeneficiarios();
  }

  // ---------------------------------------------------------------- propuesta

  protected async cargarPropuesta(pagina = 1): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.pagina.set(pagina);
    try {
      this.propuesta.set(await firstValueFrom(this.api.propuesta(pagina, this.tamano)));
      this.seleccion.set(new Set());
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar la propuesta.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected marcado(id: number): boolean {
    return this.seleccion().has(id);
  }

  protected alternar(id: number, activo: boolean): void {
    const nuevo = new Set(this.seleccion());
    if (activo) nuevo.add(id);
    else nuevo.delete(id);
    this.seleccion.set(nuevo);
  }

  /** Marca todos los casos de la página que alcanzan cupo, en el orden propuesto. */
  protected seleccionarLosQueAlcanzan(): void {
    this.seleccion.set(
      new Set((this.propuesta()?.items ?? []).filter((x) => x.alcanza).map((x) => x.solicitudId)),
    );
  }

  protected limpiarSeleccion(): void {
    this.seleccion.set(new Set());
  }

  /** Casos de esta página que van antes del último elegido, podían asignarse y no se eligieron. */
  private casosSaltados(): FilaPropuesta[] {
    const items = this.propuesta()?.items ?? [];
    const elegidos = this.seleccion();
    let ultimo = -1;
    items.forEach((x, i) => {
      if (elegidos.has(x.solicitudId)) ultimo = i;
    });
    return items
      .slice(0, Math.max(0, ultimo))
      .filter((x) => x.alcanza && !elegidos.has(x.solicitudId));
  }

  protected async asignarSeleccionados(): Promise<void> {
    if (this.seleccion().size === 0) return;
    const saltados = this.casosSaltados();
    if (saltados.length > 0) {
      this.saltados.set(saltados);
      this.causas.clear();
      saltados.forEach(() => this.causas.push(new FormControl('', { nonNullable: true })));
      this.errorDialogo.set('');
      this.dialogo.set('omisiones');
      return;
    }
    await this.enviarAsignacion([]);
  }

  protected async confirmarOmisiones(): Promise<void> {
    const causas = this.causas.getRawValue().map((c) => c.trim());
    if (causas.some((c) => c.length < 10)) {
      this.errorDialogo.set(
        'Escriba la causa de cada caso que no se asigna (mínimo 10 caracteres).',
      );
      return;
    }
    await this.enviarAsignacion(
      this.saltados().map((s, i) => ({ solicitudId: s.solicitudId, causa: causas[i] as string })),
    );
  }

  private async enviarAsignacion(
    omisiones: { solicitudId: number; causa: string }[],
  ): Promise<void> {
    this.asignando.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.errorDialogo.set('');
    try {
      const r = await firstValueFrom(this.api.asignar([...this.seleccion()], omisiones));
      this.cerrar();
      this.mensaje.set(
        `${r.asignados} caso(s) asignado(s). Se notificó a cada persona con las instrucciones de la entrega.`,
      );
      await this.cargarPropuesta(this.pagina());
      this.beneficiarios.set(null);
    } catch (e) {
      const mensaje =
        e instanceof ApiError
          ? e.errores.map((x) => x.mensaje).join(' ') || e.message
          : 'No pudimos asignar.';
      if (this.dialogo() === 'omisiones') this.errorDialogo.set(mensaje);
      else this.error.set(mensaje);
    } finally {
      this.asignando.set(false);
    }
  }

  protected cerrar(): void {
    this.dialogo.set('ninguno');
  }

  // ---------------------------------------------------------------- lista de espera

  protected pedirListaEspera(): void {
    this.errorDialogo.set('');
    this.dialogo.set('espera');
  }

  protected async confirmarListaEspera(): Promise<void> {
    this.asignando.set(true);
    this.errorDialogo.set('');
    try {
      const r = await firstValueFrom(this.api.enviarAListaEspera());
      this.cerrar();
      this.mensaje.set(
        r.enListaDeEspera > 0
          ? `${r.enListaDeEspera} caso(s) pasaron a lista de espera y se notificó a cada persona.`
          : 'No hay casos por pasar a lista de espera.',
      );
      await this.cargarPropuesta(this.pagina());
    } catch (e) {
      this.errorDialogo.set(
        e instanceof ApiError ? e.message : 'No pudimos pasar los casos a lista de espera.',
      );
    } finally {
      this.asignando.set(false);
    }
  }

  // ---------------------------------------------------------------- beneficiarios

  protected async cargarBeneficiarios(pagina = 1): Promise<void> {
    this.paginaBen.set(pagina);
    this.error.set('');
    const f = this.filtroBen.getRawValue();
    try {
      this.beneficiarios.set(
        await firstValueFrom(
          this.api.beneficiarios(
            f.estado || undefined,
            f.q.trim() || undefined,
            pagina,
            this.tamano,
          ),
        ),
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los beneficiarios.');
    }
  }

  protected limpiarBeneficiarios(): void {
    this.filtroBen.reset({ q: '', estado: '' });
    void this.cargarBeneficiarios();
  }
}
