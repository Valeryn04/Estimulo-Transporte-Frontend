import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  Signal,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { FormularioPreinscripcion, PublicoApi } from '../../../core/publico/publico-api';
import { Campo, textoError } from '../../../shared/campo';
import { CampoControl } from '../../../shared/campo-control';
import { Direccion } from '../../../shared/direccion/direccion';
import { aplicarErroresApi, igualA, valorDe } from '../../../shared/forms';
import { PATRON_NOMBRE, numeroSegunTipo, soloDigitos } from '../../../shared/identificacion';
import { TurnstileCasilla } from '../../../shared/turnstile/turnstile';
import { Ayuda } from '../../../shared/ayuda/ayuda';
import { Confirmar } from '../../../shared/alertas/confirmar';
import { AsistenteVoz } from './asistente-voz/asistente-voz';

/** Campos que se muestran en el resumen de errores, en el orden del formulario. */
const CAMPOS = [
  ['diligencia', 'diligencia', '¿Quién diligencia este formulario?'],
  ['agregaCuidador', 'agrega-cuidador', '¿Va a agregar un cuidador?'],
  ['pcdNombre', 'pcd-nombre', 'Nombre completo de la persona con discapacidad'],
  ['pcdTipoIdentificacionId', 'pcd-tipo', 'Tipo de identificación de la persona con discapacidad'],
  ['pcdNumero', 'pcd-numero', 'Número de identificación de la persona con discapacidad'],
  ['cuidadorNombre', 'cui-nombre', 'Nombre completo del cuidador'],
  ['cuidadorTipoIdentificacionId', 'cui-tipo', 'Tipo de identificación del cuidador'],
  ['cuidadorNumero', 'cui-numero', 'Número de identificación del cuidador'],
  ['cuidadorEsPcd', 'cui-es-pcd', '¿El cuidador también es una persona con discapacidad?'],
  ['direccion', 'direccion', 'Dirección de residencia'],
  ['localidadId', 'localidad', 'Localidad'],
  ['barrioId', 'barrio', 'Barrio'],
  ['correo', 'correo', 'Correo electrónico para notificaciones'],
  ['correoConfirmacion', 'correo-confirmacion', 'Confirmación del correo'],
  ['aceptaAutorizacion', 'acepta', 'Autorización de tratamiento de datos'],
] as const;

type NombreCampo = (typeof CAMPOS)[number][0];

interface ErrorResumen {
  id: string;
  mensaje: string;
}

/**
 * Preinscripción en el portal ciudadano (RF-PRE-01, RF-PRE-02, RF-PRE-03): datos básicos de la persona con
 * discapacidad y del cuidador, residencia, correo para notificaciones y autorización de tratamiento de datos.
 */
@Component({
  selector: 'app-preinscripcion-page',
  imports: [
    Confirmar,
    ReactiveFormsModule,
    RouterLink,
    Campo,
    CampoControl,
    Direccion,
    TurnstileCasilla,
    Ayuda,
    AsistenteVoz,
  ],
  templateUrl: './preinscripcion-page.html',
  styleUrl: './preinscripcion-page.scss',
})
export class PreinscripcionPage implements OnInit {
  private readonly api = inject(PublicoApi);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destruir = inject(DestroyRef);

  protected readonly datos = signal<FormularioPreinscripcion | null>(null);
  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly errorCarga = signal('');
  protected readonly aviso = signal<{
    tipo: 'error' | 'advertencia';
    texto: string;
    consulta?: boolean;
  } | null>(null);
  protected readonly resumen = signal<ErrorResumen[]>([]);
  protected readonly resumenEl = viewChild<ElementRef<HTMLElement>>('resumenEl');
  protected readonly avisoEl = viewChild<ElementRef<HTMLElement>>('avisoEl');

  protected readonly form = new FormGroup({
    pcdNombre: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(150),
        Validators.pattern(PATRON_NOMBRE),
      ],
    }),
    pcdTipoIdentificacionId: new FormControl<number | null>(null, [Validators.required]),
    pcdNumero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, numeroSegunTipo(() => this.codigoPcd())],
    }),
    // Primera pregunta: quién llena el formulario. De eso depende si el cuidador es obligatorio.
    diligencia: new FormControl<'PCD' | 'CUIDADOR' | null>(null, [Validators.required]),
    // Solo la pregunta la persona con discapacidad: ¿agregará un cuidador? Si responde que sí, sus datos son obligatorios.
    agregaCuidador: new FormControl<boolean | null>({ value: null, disabled: true }, [
      Validators.required,
    ]),
    cuidadorNombre: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(150),
        Validators.pattern(PATRON_NOMBRE),
      ],
    }),
    cuidadorTipoIdentificacionId: new FormControl<number | null>(null, [Validators.required]),
    cuidadorNumero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, numeroSegunTipo(() => this.codigoCuidador())],
    }),
    // ¿El cuidador también es una persona con discapacidad? Solo recibiría un beneficio (una sola tarjeta).
    cuidadorEsPcd: new FormControl<boolean | null>(null, [Validators.required]),
    direccion: new FormControl('', {
      nonNullable: true,
      // El componente de dirección la arma por partes con un formato estándar.
      validators: [Validators.maxLength(200)],
    }),
    localidadId: new FormControl<number | null>(null),
    barrioId: new FormControl<number | null>(null),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(150)],
    }),
    // Se escribe dos veces para evitar un error de digitación: ahí llega el enlace de verificación.
    correoConfirmacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, igualA('correo', 'correoDiferente')],
    }),
    aceptaAutorizacion: new FormControl(false, {
      nonNullable: true,
      validators: [Validators.required, Validators.requiredTrue],
    }),
    // Campo trampa: las personas no lo ven; un programa que llena todo lo completa y se rechaza.
    contactoAlterno: new FormControl('', { nonNullable: true }),
  });

  private readonly tipoPcd: Signal<number | null> = valorDe(
    this.form.controls.pcdTipoIdentificacionId,
  );
  private readonly tipoCuidador: Signal<number | null> = valorDe(
    this.form.controls.cuidadorTipoIdentificacionId,
  );
  private readonly localidad: Signal<number | null> = valorDe(this.form.controls.localidadId);
  protected readonly diligencia = valorDe(this.form.controls.diligencia);
  protected readonly agregaCuidador = valorDe(this.form.controls.agregaCuidador);
  protected readonly cuidadorEsPcd = valorDe(this.form.controls.cuidadorEsPcd);
  /** El cuidador es obligatorio si quien llena es el cuidador, o si la persona con discapacidad dijo que lo agregará. */
  protected readonly tieneCuidador = computed(
    () =>
      this.diligencia() === 'CUIDADOR' ||
      (this.diligencia() === 'PCD' && this.agregaCuidador() === true),
  );

  protected readonly codigoPcd: Signal<string | undefined> = computed(() =>
    this.codigo(this.tipoPcd()),
  );
  protected readonly codigoCuidador: Signal<string | undefined> = computed(() =>
    this.codigo(this.tipoCuidador()),
  );
  protected readonly modoPcd = computed(() => (soloDigitos(this.codigoPcd()) ? 'numeric' : 'text'));
  protected readonly modoCuidador = computed(() =>
    soloDigitos(this.codigoCuidador()) ? 'numeric' : 'text',
  );
  protected readonly barriosDeLocalidad = computed(() => {
    const l = this.localidad();
    return l ? (this.datos()?.barrios.filter((b) => b.localidadId === l) ?? []) : [];
  });

  ngOnInit(): void {
    this.form.controls.correo.valueChanges
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe(() => this.form.controls.correoConfirmacion.updateValueAndValidity());
    void this.cargar();
    // Al cambiar el tipo de documento se vuelve a validar el número; al cambiar la localidad se limpia el barrio.
    this.form.controls.pcdTipoIdentificacionId.valueChanges.subscribe(() =>
      this.form.controls.pcdNumero.updateValueAndValidity(),
    );
    this.form.controls.cuidadorTipoIdentificacionId.valueChanges.subscribe(() =>
      this.form.controls.cuidadorNumero.updateValueAndValidity(),
    );
    // Las preguntas del cuidador se piden (y se validan) solo cuando corresponde.
    this.form.controls.diligencia.valueChanges.subscribe((quien) => {
      const agrega = this.form.controls.agregaCuidador;
      if (quien === 'PCD') agrega.enable();
      else {
        agrega.reset(null);
        agrega.disable();
      }
      this.alternarCuidador();
    });
    this.form.controls.agregaCuidador.valueChanges.subscribe(() => this.alternarCuidador());
    this.alternarCuidador();
    this.form.controls.barrioId.disable(); // se habilita al elegir la localidad
    this.form.controls.localidadId.valueChanges.subscribe((localidad) => {
      this.form.controls.barrioId.reset(null);
      if (localidad) this.form.controls.barrioId.enable();
      else this.form.controls.barrioId.disable();
    });
  }

  private alternarCuidador(): void {
    const f = this.form.controls;
    const pide =
      f.diligencia.value === 'CUIDADOR' ||
      (f.diligencia.value === 'PCD' && f.agregaCuidador.value === true);
    for (const c of [
      f.cuidadorNombre,
      f.cuidadorTipoIdentificacionId,
      f.cuidadorNumero,
      f.cuidadorEsPcd,
    ]) {
      if (pide) c.enable({ emitEvent: false });
      else c.disable({ emitEvent: false });
    }
  }

  private codigo(id: number | null): string | undefined {
    return this.datos()?.tiposIdentificacion.find((t) => t.id === id)?.codigo;
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set('');
    try {
      this.datos.set(await firstValueFrom(this.api.formulario()));
    } catch (e) {
      this.errorCarga.set(
        e instanceof ApiError ? e.message : 'No pudimos cargar el formulario. Intente de nuevo.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  /** Construye la lista de errores para el resumen que se anuncia a lectores de pantalla (RNF-02). */
  private construirResumen(): ErrorResumen[] {
    const mensajes: Record<string, string> = {
      required: 'complete este dato',
      pattern: 'use solo letras, espacios, punto, apóstrofo o guion',
    };
    return CAMPOS.flatMap(([nombre, id, etiqueta]) => {
      const control = this.form.controls[nombre as NombreCampo];
      if (!control.invalid) return [];
      const personalizados =
        nombre === 'aceptaAutorizacion'
          ? { required: 'debe aceptarla para poder enviar la preinscripción' }
          : nombre.endsWith('TipoIdentificacionId') ||
              nombre === 'localidadId' ||
              nombre === 'barrioId'
            ? { required: 'elija una opción de la lista' }
            : mensajes;
      return [{ id, mensaje: textoError(control, etiqueta, personalizados) }];
    });
  }

  /** Lleva el foco al resumen cuando ya está en pantalla, para que los lectores de pantalla lo anuncien. */
  /** El aviso queda junto al botón de enviar: se lleva a la vista, sobre todo en el teléfono. */
  private mostrarAviso(): void {
    afterNextRender(
      () => {
        const el = this.avisoEl()?.nativeElement;
        el?.scrollIntoView?.({ block: 'center' });
        el?.focus();
      },
      { injector: this.injector },
    );
  }

  private enfocarResumen(): void {
    afterNextRender(() => this.resumenEl()?.nativeElement.focus(), { injector: this.injector });
  }

  protected irAlCampo(id: string, evento: Event): void {
    evento.preventDefault();
    document.getElementById(id)?.focus();
  }

  protected async enviar(evento?: Event): Promise<void> {
    evento?.preventDefault();
    this.aviso.set(null);
    this.form.markAllAsTouched();
    const d = this.datos();
    if (!d?.autorizacion) return;
    if (this.form.invalid) {
      this.resumen.set(this.construirResumen());
      this.enfocarResumen();
      return;
    }
    this.resumen.set([]);
    this.enviando.set(true);
    const v = this.form.getRawValue();
    try {
      const r = await firstValueFrom(
        this.api.preinscribir({
          pcdNombre: v.pcdNombre.trim(),
          pcdTipoIdentificacionId: v.pcdTipoIdentificacionId as number,
          pcdNumero: v.pcdNumero.trim(),
          diligenciadaPor: v.diligencia as 'PCD' | 'CUIDADOR',
          tieneCuidador: this.tieneCuidador(),
          ...(!this.tieneCuidador()
            ? {}
            : {
                cuidadorNombre: v.cuidadorNombre.trim(),
                cuidadorTipoIdentificacionId: v.cuidadorTipoIdentificacionId as number,
                cuidadorNumero: v.cuidadorNumero.trim(),
                cuidadorEsPcd: v.cuidadorEsPcd === true,
              }),
          direccion: v.direccion.trim() || null,
          localidadId: v.localidadId,
          barrioId: v.barrioId,
          correo: v.correo.trim(),
          correoConfirmacion: v.correoConfirmacion.trim(),
          aceptaAutorizacion: true,
          autorizacionVersion: d.autorizacion.version,
          formularioToken: d.formularioToken,
          contactoAlterno: v.contactoAlterno,
        }),
      );
      await this.router.navigate(['/preinscripcion/enviada'], {
        state: { correo: r.correoEnmascarado, horas: r.horasVigenciaEnlace },
      });
    } catch (e) {
      await this.manejarError(e);
    } finally {
      this.enviando.set(false);
    }
  }

  private async manejarError(e: unknown): Promise<void> {
    if (!(e instanceof ApiError)) {
      this.aviso.set({
        tipo: 'error',
        texto: 'No pudimos enviar la preinscripción. Intente de nuevo.',
      });
      return;
    }
    if (e.codigo === 'SOLICITUD_EXISTENTE') {
      this.aviso.set({ tipo: 'advertencia', texto: e.message, consulta: true });
      // También se marca en el campo de la persona, para que se vea qué dato es el repetido.
      this.form.controls.pcdNumero.setErrors({
        ocupado: 'esta persona ya tiene una solicitud en esta vigencia',
      });
      this.mostrarAviso();
    } else if (e.codigo === 'AUTORIZACION_CAMBIO' || e.codigo === 'FORMULARIO_INVALIDO') {
      // El texto cambió o el formulario venció: se trae de nuevo y la persona vuelve a aceptar.
      await this.cargar();
      this.form.controls.aceptaAutorizacion.setValue(false);
      this.aviso.set({ tipo: 'advertencia', texto: e.message });
      this.mostrarAviso();
    } else if (e.errores.length > 0) {
      const sueltos = aplicarErroresApi(this.form, e.errores);
      this.resumen.set(this.construirResumen());
      if (sueltos.length) this.aviso.set({ tipo: 'error', texto: sueltos.join(' ') });
      this.enfocarResumen();
    } else {
      this.aviso.set({ tipo: 'error', texto: e.message });
      this.mostrarAviso();
    }
    if (e.codigo === 'PREINSCRIPCION_CERRADA') await this.cargar();
  }
}
