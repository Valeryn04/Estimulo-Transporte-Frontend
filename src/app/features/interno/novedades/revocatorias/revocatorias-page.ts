import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import {
  EstadoRevocatoria,
  EventoRevocatoria,
  NOMBRE_ESTADO_REVOCATORIA,
  NOMBRE_ETAPA,
  Revocatoria,
  RevocatoriaResumen,
} from '../modelos-novedades';
import { NovedadesApi } from '../novedades-api';

/**
 * Revocatorias con debido proceso (RF-NOV-02): inicio con causal y evidencia, traslado de las razones, descargos y acto
 * administrativo motivado. Cada etapa solo se habilita cuando la anterior se agotó; el beneficio solo se finaliza con el
 * acto registrado.
 */
@Component({
  selector: 'app-revocatorias-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Dialogo],
  templateUrl: './revocatorias-page.html',
  styleUrl: './revocatorias-page.scss',
})
export class RevocatoriasPage implements OnInit {
  private readonly api = inject(NovedadesApi);
  private readonly sesion = inject(Sesion);

  /** Parámetro opcional de la ruta: abre esa revocatoria al entrar. */
  readonly id = input<string>();

  protected readonly datos = signal<{ items: RevocatoriaResumen[]; total: number } | null>(null);
  protected readonly pagina = signal(1);
  protected readonly tamano = 25;
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.datos()?.total ?? 0) / this.tamano)),
  );
  protected readonly estados = NOMBRE_ESTADO_REVOCATORIA;
  protected readonly etapas = NOMBRE_ETAPA;
  protected readonly opciones = Object.keys(NOMBRE_ESTADO_REVOCATORIA) as EstadoRevocatoria[];
  protected readonly estado = new FormControl<'' | EstadoRevocatoria>('', { nonNullable: true });
  protected readonly puedeGestionar = computed(() => this.sesion.tiene(PERMISO.novedadesGestionar));

  // ---- detalle
  protected readonly detalle = signal<Revocatoria | null>(null);
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly archivo = signal<File | null>(null);
  protected readonly formTraslado = new FormGroup({
    texto: new FormControl('', { nonNullable: true, validators: [Validators.minLength(20)] }),
  });
  protected readonly formDescargos = new FormGroup({
    texto: new FormControl('', { nonNullable: true, validators: [Validators.minLength(10)] }),
  });
  protected readonly formDecision = new FormGroup({
    resultado: new FormControl<'REVOCAR' | 'ARCHIVAR'>('REVOCAR', { nonNullable: true }),
    numeroActo: new FormControl('', { nonNullable: true, validators: [Validators.minLength(2)] }),
    motivacion: new FormControl('', { nonNullable: true, validators: [Validators.minLength(20)] }),
  });

  ngOnInit(): void {
    void this.buscar();
    const id = this.id();
    if (id) void this.abrir(Number(id));
  }

  protected async buscar(pagina = 1): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.pagina.set(pagina);
    try {
      this.datos.set(
        await firstValueFrom(
          this.api.revocatorias(this.estado.value || undefined, pagina, this.tamano),
        ),
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar las revocatorias.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected async abrir(id: number): Promise<void> {
    this.errorDialogo.set('');
    this.mensaje.set('');
    this.archivo.set(null);
    this.formTraslado.reset();
    this.formDescargos.reset();
    this.formDecision.reset({ resultado: 'REVOCAR', numeroActo: '', motivacion: '' });
    try {
      this.detalle.set(await firstValueFrom(this.api.revocatoria(id)));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos abrir la revocatoria.');
    }
  }

  protected cerrar(): void {
    this.detalle.set(null);
  }

  protected elegirArchivo(evento: Event): void {
    this.archivo.set((evento.target as HTMLInputElement).files?.[0] ?? null);
  }

  private async ejecutar(accion: () => Promise<Revocatoria>, texto: string): Promise<void> {
    this.guardando.set(true);
    this.errorDialogo.set('');
    try {
      const nueva = await accion();
      this.detalle.set(nueva);
      this.archivo.set(null);
      this.formTraslado.reset();
      this.formDescargos.reset();
      this.formDecision.reset({ resultado: 'REVOCAR', numeroActo: '', motivacion: '' });
      this.mensaje.set(texto);
      await this.buscar(this.pagina());
    } catch (e) {
      this.errorDialogo.set(
        e instanceof ApiError
          ? e.errores.length > 0
            ? e.errores.map((x) => x.mensaje).join(' ')
            : e.message
          : 'No pudimos registrar la etapa.',
      );
    } finally {
      this.guardando.set(false);
    }
  }

  protected async registrarTraslado(): Promise<void> {
    const d = this.detalle();
    if (!d) return;
    const texto = this.formTraslado.controls.texto.value.trim();
    if (texto.length < 20) {
      this.errorDialogo.set(
        'Escriba las razones que se comunican a la persona (mínimo 20 caracteres).',
      );
      return;
    }
    await this.ejecutar(
      () => firstValueFrom(this.api.traslado(d.id, texto, this.archivo())),
      'Traslado registrado y comunicado a la persona. Corre el plazo para presentar descargos.',
    );
  }

  protected async registrarDescargos(): Promise<void> {
    const d = this.detalle();
    if (!d) return;
    const texto = this.formDescargos.controls.texto.value.trim();
    if (texto.length < 10) {
      this.errorDialogo.set('Registre lo que presentó la persona (mínimo 10 caracteres).');
      return;
    }
    await this.ejecutar(
      () =>
        firstValueFrom(this.api.descargos(d.id, { texto, sinDescargos: false }, this.archivo())),
      'Descargos registrados. Ya se puede decidir.',
    );
  }

  protected async registrarSinDescargos(): Promise<void> {
    const d = this.detalle();
    if (!d) return;
    await this.ejecutar(
      () => firstValueFrom(this.api.descargos(d.id, { texto: '', sinDescargos: true }, null)),
      'Quedó registrado que venció el plazo sin descargos. Ya se puede decidir.',
    );
  }

  protected async decidir(): Promise<void> {
    const d = this.detalle();
    if (!d) return;
    const v = this.formDecision.getRawValue();
    const acto = this.archivo();
    if (v.numeroActo.trim().length < 2 || v.motivacion.trim().length < 20 || !acto) {
      this.errorDialogo.set(
        'Complete el número del acto, la motivación (mínimo 20 caracteres) y adjunte el acto administrativo.',
      );
      return;
    }
    await this.ejecutar(
      () =>
        firstValueFrom(
          this.api.decidir(
            d.id,
            {
              resultado: v.resultado,
              motivacion: v.motivacion.trim(),
              numeroActo: v.numeroActo.trim(),
            },
            acto,
          ),
        ),
      v.resultado === 'REVOCAR'
        ? 'Acto registrado: el beneficio se finalizó y el cupo quedó libre para reasignar.'
        : 'Acto registrado: se archivó el trámite y el beneficio continúa.',
    );
  }

  protected async verArchivo(e: EventoRevocatoria): Promise<void> {
    this.errorDialogo.set('');
    try {
      const blob = await firstValueFrom(this.api.archivoEvento(e.id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      this.errorDialogo.set(err instanceof ApiError ? err.message : 'No pudimos abrir el archivo.');
    }
  }
}
