import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { PERMISO } from '../../../core/auth/modelos';
import { Sesion } from '../../../core/auth/sesion';
import { Campo } from '../../../shared/campo';
import { CampoControl } from '../../../shared/campo-control';
import { Dialogo } from '../../../shared/dialogo/dialogo';
import { EncuestasApi } from './encuestas-api';
import {
  Encuesta,
  NOMBRE_ESTADO_ENCUESTA,
  NOMBRE_TIPO_PREGUNTA,
  Pregunta,
  ResultadosEncuesta,
  TipoPregunta,
} from './modelos-encuestas';
import { Pestanas } from '../../../shared/pestanas/pestanas';

type Vista = 'ninguna' | 'formulario' | 'resultados' | 'publicar';

const nuevaPregunta = (p?: Partial<Pregunta>) =>
  new FormGroup({
    tipo: new FormControl<TipoPregunta>(p?.tipo ?? 'ESCALA', { nonNullable: true }),
    texto: new FormControl(p?.texto ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(300)],
    }),
    obligatoria: new FormControl(p?.obligatoria ?? true, { nonNullable: true }),
    /** Una opción por línea. */
    opciones: new FormControl((p?.opciones ?? []).join('\n'), { nonNullable: true }),
    escalaMax: new FormControl<number | null>(p?.escalaMax ?? 5),
  });

/**
 * Encuestas de satisfacción (RF-NOV-04): se crean con preguntas de selección, escala o texto y un periodo de vigencia;
 * al publicarlas se invita por correo a los beneficiarios activos; los resultados se ven sin identificar a nadie.
 */
@Component({
  selector: 'app-encuestas-page',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, Campo, CampoControl, Dialogo, Pestanas],
  templateUrl: './encuestas-page.html',
  styleUrl: './encuestas-page.scss',
})
export class EncuestasPage implements OnInit {
  private readonly api = inject(EncuestasApi);
  private readonly sesion = inject(Sesion);

  protected readonly encuestas = signal<Encuesta[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly estados = NOMBRE_ESTADO_ENCUESTA;
  protected readonly tipos = NOMBRE_TIPO_PREGUNTA;
  protected readonly listaTipos = Object.keys(NOMBRE_TIPO_PREGUNTA) as TipoPregunta[];
  protected readonly puedeAdministrar = computed(() =>
    this.sesion.tiene(PERMISO.encuestasAdministrar),
  );

  protected readonly vista = signal<Vista>('ninguna');
  protected readonly editando = signal<Encuesta | null>(null);
  protected readonly erroresDialogo = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly resultados = signal<ResultadosEncuesta | null>(null);

  protected readonly form = new FormGroup({
    titulo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(150)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
    desde: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    hasta: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    preguntas: new FormArray<ReturnType<typeof nuevaPregunta>>([]),
  });

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.encuestas.set(await firstValueFrom(this.api.listar()));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar las encuestas.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected get preguntas(): FormArray<ReturnType<typeof nuevaPregunta>> {
    return this.form.controls.preguntas;
  }

  protected cerrar(): void {
    this.vista.set('ninguna');
  }

  protected abrirNueva(): void {
    this.editando.set(null);
    this.erroresDialogo.set([]);
    const hoy = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
    const fin = new Date(Date.now() - 5 * 3_600_000 + 30 * 86_400_000).toISOString().slice(0, 10);
    this.form.reset({ titulo: '', descripcion: '', desde: hoy, hasta: fin });
    this.preguntas.clear();
    this.preguntas.push(nuevaPregunta({ texto: '¿Qué tan satisfecho está con el servicio?' }));
    this.vista.set('formulario');
  }

  protected async abrirEditar(e: Encuesta): Promise<void> {
    this.error.set('');
    try {
      const d = await firstValueFrom(this.api.obtener(e.id));
      this.editando.set(e);
      this.erroresDialogo.set([]);
      this.form.reset({
        titulo: d.titulo,
        descripcion: d.descripcion,
        desde: d.vigenteDesde,
        hasta: d.vigenteHasta,
      });
      this.preguntas.clear();
      for (const p of d.preguntas) this.preguntas.push(nuevaPregunta(p));
      this.vista.set('formulario');
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'No pudimos abrir la encuesta.');
    }
  }

  protected agregarPregunta(): void {
    this.preguntas.push(nuevaPregunta());
  }

  protected quitarPregunta(i: number): void {
    this.preguntas.removeAt(i);
  }

  protected tipoDe(i: number): TipoPregunta {
    return this.preguntas.at(i).controls.tipo.value;
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    this.erroresDialogo.set([]);
    if (this.form.invalid) {
      this.erroresDialogo.set([
        'Revise los datos: el título y cada pregunta necesitan al menos 5 caracteres.',
      ]);
      return;
    }
    const v = this.form.getRawValue();
    const datos = {
      titulo: v.titulo.trim(),
      descripcion: v.descripcion.trim(),
      desde: v.desde,
      hasta: v.hasta,
      preguntas: v.preguntas.map((p): Pregunta => ({
        tipo: p.tipo,
        texto: p.texto.trim(),
        obligatoria: p.obligatoria,
        opciones:
          p.tipo === 'SELECCION'
            ? p.opciones
                .split('\n')
                .map((o) => o.trim())
                .filter(Boolean)
            : null,
        escalaMax: p.tipo === 'ESCALA' ? Number(p.escalaMax) : null,
      })),
    };
    this.guardando.set(true);
    try {
      const edicion = this.editando();
      if (edicion) await firstValueFrom(this.api.actualizar(edicion.id, datos));
      else await firstValueFrom(this.api.crear(datos));
      this.cerrar();
      this.mensaje.set(`Encuesta «${datos.titulo}» guardada como borrador.`);
      await this.cargar();
    } catch (e) {
      this.erroresDialogo.set(
        e instanceof ApiError
          ? e.errores.length > 0
            ? e.errores.map((x) => x.mensaje)
            : [e.message]
          : ['No pudimos guardar la encuesta.'],
      );
    } finally {
      this.guardando.set(false);
    }
  }

  // ---------------------------------------------------------------- publicar y cerrar

  protected pedirPublicar(e: Encuesta): void {
    this.editando.set(e);
    this.erroresDialogo.set([]);
    this.vista.set('publicar');
  }

  protected async publicar(): Promise<void> {
    const e = this.editando();
    if (!e) return;
    this.guardando.set(true);
    try {
      const r = await firstValueFrom(this.api.publicar(e.id));
      this.cerrar();
      this.mensaje.set(
        `Encuesta publicada: se invitó por correo a ${r.invitadosAhora} beneficiario(s) activo(s).`,
      );
      await this.cargar();
    } catch (err) {
      this.erroresDialogo.set(
        err instanceof ApiError
          ? err.errores.length > 0
            ? err.errores.map((x) => x.mensaje)
            : [err.message]
          : ['No pudimos publicar la encuesta.'],
      );
    } finally {
      this.guardando.set(false);
    }
  }

  protected async cerrarEncuesta(e: Encuesta): Promise<void> {
    this.error.set('');
    this.mensaje.set('');
    try {
      await firstValueFrom(this.api.cerrar(e.id));
      this.mensaje.set(`Encuesta «${e.titulo}» cerrada: ya no recibe respuestas.`);
      await this.cargar();
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'No pudimos cerrar la encuesta.');
    }
  }

  // ---------------------------------------------------------------- resultados

  protected async verResultados(e: Encuesta): Promise<void> {
    this.error.set('');
    try {
      this.resultados.set(await firstValueFrom(this.api.resultados(e.id)));
      this.vista.set('resultados');
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'No pudimos cargar los resultados.');
    }
  }

  /** Ancho de la barra de una opción respecto al total de respuestas de la pregunta. */
  protected porcentaje(cantidad: number, total: number): number {
    return total > 0 ? Math.round((cantidad / total) * 100) : 0;
  }
}
