import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  Signal,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, debounceTime, firstValueFrom } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import {
  CambiosCaracterizacion,
  Caracterizacion,
  CaracterizacionApi,
  CampoDato,
  CodigoSeccion,
  DatosCaracterizacion,
  DocumentosSolicitud,
  Embarazo,
  Radicacion,
  RevisionSolicitud,
  SesionCiudadano,
} from '../../../core/publico/caracterizacion-api';
import { PublicoApi } from '../../../core/publico/publico-api';
import { Campo } from '../../../shared/campo';
import { Dialogo } from '../../../shared/dialogo/dialogo';
import { Icono } from '../../../shared/icono/icono';
import { CampoControl } from '../../../shared/campo-control';
import { ocultarTokenEnLaUrl } from '../../../shared/enlace';
import { aplicarErroresApi, hoyIso, valorDe } from '../../../shared/forms';
import {
  CAMPOS,
  MAX_HIJOS,
  MENSAJES,
  aplicarDependencias,
  camposCambiados,
  celularValido,
  correoValido,
  fechaNacimientoValida,
  fijoValido,
  nombreValido,
  normalizarTelefono,
  textoONulo,
} from './caracterizacion-datos';
import { DocumentosPanel } from './documentos/documentos-panel';

type Paso = 'cargando' | 'acceso' | 'formulario' | 'radicada' | 'error';
type Guardado = 'inactivo' | 'pendiente' | 'guardando' | 'guardado' | 'error';
export type SeccionVisible = CodigoSeccion | 'documentos' | 'revision';

/** Espera, en milisegundos, desde que la persona deja de escribir hasta que se guarda el avance. */
const ESPERA_AUTOGUARDADO = 1200;
/** Espera para reintentar cuando no hubo conexión. */
const ESPERA_REINTENTO = 8000;

const NOMBRE_SECCION: Record<SeccionVisible, string> = {
  'datos-personales': 'Datos personales',
  situacion: 'Su situación',
  'salud-apoyos': 'Salud y apoyos',
  transporte: 'Transporte',
  cuidador: 'Cuidador o asistente personal',
  documentos: 'Documentos',
  revision: 'Revisión y envío',
};

/** Qué se necesita en cada paso y por qué (RNF-11). */
const POR_QUE: Record<SeccionVisible, string> = {
  'datos-personales':
    'Con estos datos podemos identificarle y comunicarnos con usted durante el trámite.',
  situacion:
    'Nos ayuda a conocer las condiciones de vida de la persona para los criterios del programa.',
  'salud-apoyos':
    'La información de salud y de otros apoyos del Distrito se usa solo para verificar los requisitos. Se guarda cifrada y la ven únicamente las personas autorizadas.',
  transporte:
    'Nos permite saber cómo se moviliza la persona y si necesita servicio para su cuidador.',
  cuidador:
    'Datos de la persona que acompaña a quien tiene la discapacidad. Los usamos para contactarle y para validar sus documentos.',
  documentos:
    'Los documentos permiten verificar que cumple los requisitos. Cárguelos legibles y completos; puede reemplazarlos mientras no envíe la solicitud.',
  revision:
    'Antes de enviar, revise que no falte ningún dato ni documento. Al enviar se genera su número de radicado.',
};

const AVISO =
  'Importante: el registro de su solicitud no equivale a la aprobación del beneficio. La asignación depende de la verificación de requisitos, la disponibilidad presupuestal y los criterios de priorización vigentes.';

const requeridoNumero = () => new FormControl<number | null>(null, [Validators.required]);
const opcionalNumero = () => new FormControl<number | null>(null);
const textoControl = (validadores: ((c: AbstractControl) => object | null)[] = []) =>
  new FormControl('', { nonNullable: true, validators: validadores });

/**
 * Caracterización de la persona con discapacidad y del cuidador (RF-CAR-01, RF-CAR-02). El formulario se organiza por
 * secciones con indicador de avance, muestra solo los campos que aplican y guarda solo el avance (RF-CAR-04): la
 * persona puede cerrar y retomar desde el enlace de su correo sin perder lo diligenciado.
 */
@Component({
  selector: 'app-caracterizacion-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Campo,
    CampoControl,
    Dialogo,
    DocumentosPanel,
    Icono,
  ],
  templateUrl: './caracterizacion-page.html',
  styleUrl: './caracterizacion-page.scss',
  host: { '(window:beforeunload)': 'avisarSiHayCambios($event)' },
})
export class CaracterizacionPage implements OnInit, OnDestroy {
  private readonly api = inject(CaracterizacionApi);
  private readonly publico = inject(PublicoApi);
  private readonly sesion = inject(SesionCiudadano);
  private readonly destruir = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  /** El enlace del correo, guardado en memoria: la dirección ya no lo muestra. */
  private enlace: string | undefined;

  /** Parámetro de consulta `?token=` del enlace seguro del correo. */
  readonly token = input<string>();

  protected readonly MAX_HIJOS = MAX_HIJOS;
  protected readonly MENSAJES = MENSAJES;
  protected readonly NOMBRE_SECCION = NOMBRE_SECCION;
  protected readonly hoy = hoyIso();

  protected readonly paso = signal<Paso>('cargando');
  protected readonly error = signal('');
  protected readonly c = signal<Caracterizacion | null>(null);
  protected readonly seccion = signal<SeccionVisible>('datos-personales');
  protected readonly estadoGuardado = signal<Guardado>('inactivo');
  protected readonly guardadoAt = signal<Date | null>(null);
  protected readonly mensajeGuardado = signal('');
  protected readonly conflicto = signal(false);
  protected readonly sesionVencida = signal(false);
  protected readonly bloqueado = signal(false);
  protected readonly titulo = viewChild<ElementRef<HTMLElement>>('tituloEl');

  // ---- documentos, revisión y envío (RF-CAR-03, RF-CAR-04)
  protected readonly documentos = signal<DocumentosSolicitud | null>(null);
  protected readonly revision = signal<RevisionSolicitud | null>(null);
  protected readonly cargandoRevision = signal(false);
  protected readonly confirmando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal('');
  protected readonly radicacion = signal<Radicacion | null>(null);

  protected readonly form = new FormGroup({
    pcdNombre: textoControl([
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(150),
      nombreValido,
    ]),
    cuidadorNombre: textoControl([
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(150),
      nombreValido,
    ]),
    generoId: requeridoNumero(),
    telefonoFijo: textoControl([fijoValido]),
    celular: textoControl([Validators.required, celularValido]),
    fechaNacimiento: textoControl([fechaNacimientoValida]),
    estadoCivilId: opcionalNumero(),
    tieneHijos: new FormControl<boolean | null>(null),
    hijosCantidad: new FormControl<number | null>(null, [
      Validators.min(1),
      Validators.max(MAX_HIJOS),
    ]),
    hijosEdades: new FormArray<FormControl<number | null>>([]),
    etniaId: opcionalNumero(),
    escolaridadId: opcionalNumero(),
    ocupacionId: requeridoNumero(),
    epsId: requeridoNumero(),
    embarazo: new FormControl<Embarazo | null>(null, [Validators.required]),
    semanasGestacion: new FormControl<number | null>(null, [Validators.min(1), Validators.max(42)]),
    recibeSubsidios: new FormControl<boolean | null>(null, [Validators.required]),
    subsidioCual: textoControl([Validators.minLength(3), Validators.maxLength(200)]),
    tipoTransporteId: opcionalNumero(),
    justificacionTransporte: textoControl([Validators.minLength(3), Validators.maxLength(500)]),
    requiereCuidador: new FormControl<boolean | null>(null, [Validators.required]),
    cuidadorGeneroId: opcionalNumero(),
    cuidadorTelefonoFijo: textoControl([fijoValido]),
    cuidadorCelular: textoControl([celularValido]),
    cuidadorCorreo: textoControl([correoValido, Validators.maxLength(150)]),
  });

  // Lo que decide qué campos se muestran.
  protected readonly tieneHijos: Signal<boolean | null> = valorDe(this.form.controls.tieneHijos);
  protected readonly embarazo: Signal<Embarazo | null> = valorDe(this.form.controls.embarazo);
  protected readonly generoId: Signal<number | null> = valorDe(this.form.controls.generoId);
  private readonly generoCodigo = computed(
    () => this.c()?.catalogos.generos.find((g) => g.id === this.generoId())?.codigo ?? null,
  );
  /** Qué opciones de embarazo tienen sentido según el género: «Sí» y «No» no van para masculino. */
  protected readonly embarazoSiNo = computed(() => this.generoCodigo() !== 'MASCULINO');
  /** «No aplica» no va para femenino. */
  protected readonly embarazoNoAplica = computed(() => this.generoCodigo() !== 'FEMENINO');
  protected readonly recibeSubsidios: Signal<boolean | null> = valorDe(
    this.form.controls.recibeSubsidios,
  );
  protected readonly requiereCuidador: Signal<boolean | null> = valorDe(
    this.form.controls.requiereCuidador,
  );

  protected readonly avance = computed(() => this.c()?.avance ?? null);
  /** Pasos que se muestran: la sección del cuidador solo aparece si requiere el servicio (RF-CAR-02). */
  protected readonly pasos = computed<SeccionVisible[]>(() => {
    const base: SeccionVisible[] = ['datos-personales', 'situacion', 'salud-apoyos', 'transporte'];
    if (this.requiereCuidador() === true) base.push('cuidador');
    base.push('documentos', 'revision');
    return base;
  });
  protected readonly indice = computed(() => this.pasos().indexOf(this.seccion()));
  protected readonly editable = computed(() => !!this.c()?.solicitud.editable && !this.bloqueado());

  // ---- estado interno del guardado
  private servidor!: DatosCaracterizacion;
  private nombresServidor = { pcd: '', cuidador: '' };
  private version = 0;
  private guardando = false;
  private repetir = false;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private renovada = false;

  ngOnInit(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe(() => this.alCambiar());
    this.form.valueChanges
      .pipe(debounceTime(ESPERA_AUTOGUARDADO), takeUntilDestroyed(this.destruir))
      .subscribe(() => void this.guardarAhora());
    // Cuando cambia una respuesta de la que dependen otros campos, se ajustan los obligatorios y la lista de edades.
    const f = this.form.controls;
    const dependientes: Observable<unknown>[] = [
      f.tieneHijos.valueChanges,
      f.hijosCantidad.valueChanges,
      f.embarazo.valueChanges,
      f.generoId.valueChanges,
      f.recibeSubsidios.valueChanges,
      f.requiereCuidador.valueChanges,
    ];
    for (const origen of dependientes) {
      origen
        .pipe(takeUntilDestroyed(this.destruir))
        .subscribe(() => this.sincronizarDependientes());
    }
    void this.iniciar();
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
    // Al salir se guarda lo que se alcanzó a escribir.
    if (this.paso() === 'formulario' && this.editable()) void this.guardarAhora();
  }

  // ---------------------------------------------------------------------------------------------------------
  // Entrada: enlace seguro del correo o sesión abierta en la consulta
  // ---------------------------------------------------------------------------------------------------------

  private async iniciar(): Promise<void> {
    const enlace = this.token();
    if (enlace) {
      this.enlace = enlace;
      ocultarTokenEnLaUrl(this.router, this.ruta);
    }
    try {
      if (enlace) {
        this.sesion.establecer((await firstValueFrom(this.publico.accederPorEnlace(enlace))).token);
      }
      if (!this.sesion.token()) {
        this.paso.set('acceso');
        return;
      }
      await this.cargar();
    } catch (e) {
      this.error.set(
        e instanceof ApiError
          ? e.message
          : 'No pudimos abrir su formulario. Intente de nuevo en unos minutos.',
      );
      this.paso.set(e instanceof ApiError && e.estado === 401 ? 'acceso' : 'error');
    }
  }

  /** Trae el formulario guardado y lo muestra. */
  protected async cargar(): Promise<void> {
    this.paso.set('cargando');
    this.conflicto.set(false);
    try {
      const datos = await firstValueFrom(this.api.obtener());
      this.mostrar(datos);
      if (datos.solicitud.estado.codigo === 'RADICADA' && datos.solicitud.radicado) {
        this.radicacion.set({
          radicado: datos.solicitud.radicado,
          radicadaAt: datos.solicitud.radicadaAt ?? '',
          estado: datos.solicitud.estado,
          explicacion: datos.solicitud.explicacion,
          siguientePaso: datos.solicitud.siguientePaso,
          aviso: AVISO,
        });
        this.paso.set('radicada');
        this.enfocarTitulo();
        return;
      }
      this.paso.set('formulario');
      void this.refrescarDocumentos();
      this.estadoGuardado.set(datos.guardadoAt ? 'guardado' : 'inactivo');
      this.guardadoAt.set(datos.guardadoAt ? new Date(datos.guardadoAt) : null);
      this.enfocarTitulo();
    } catch (e) {
      const sinSesion = e instanceof ApiError && e.estado === 401;
      if (sinSesion && this.enlace && !this.renovada) {
        // La sesión dura poco: con el enlace del correo se abre otra.
        this.renovada = true;
        this.sesion.establecer(
          (await firstValueFrom(this.publico.accederPorEnlace(this.enlace))).token,
        );
        return this.cargar();
      }
      this.error.set(
        e instanceof ApiError
          ? e.message
          : 'No pudimos cargar su formulario. Intente de nuevo en unos minutos.',
      );
      this.paso.set(sinSesion ? 'acceso' : 'error');
    }
  }

  /** Trae el resumen de documentos, para mostrar en el menú cuántos faltan. */
  private async refrescarDocumentos(): Promise<void> {
    try {
      this.documentos.set(await firstValueFrom(this.api.documentos()));
    } catch {
      // El panel de documentos muestra su propio error cuando se abre.
    }
  }

  private mostrar(datos: Caracterizacion): void {
    this.c.set(datos);
    this.servidor = datos.datos;
    this.version = datos.version;
    this.nombresServidor = { pcd: datos.pcd.nombre, cuidador: datos.cuidador.nombre };
    this.escribirDatos(datos);
    this.bloqueado.set(false);
    if (!this.pasos().includes(this.seccion())) this.seccion.set('datos-personales');
  }

  private enfocarTitulo(): void {
    setTimeout(() => this.titulo()?.nativeElement.focus(), 50);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Del formulario a los datos y de los datos al formulario
  // ---------------------------------------------------------------------------------------------------------

  private escribirDatos(r: Caracterizacion): void {
    const d = r.datos;
    const f = this.form.controls;
    const opciones = { emitEvent: false };
    f.pcdNombre.setValue(r.pcd.nombre, opciones);
    f.cuidadorNombre.setValue(r.cuidador.nombre, opciones);
    f.generoId.setValue(d.generoId, opciones);
    f.telefonoFijo.setValue(d.telefonoFijo ?? '', opciones);
    f.celular.setValue(d.celular ?? '', opciones);
    f.fechaNacimiento.setValue(d.fechaNacimiento ?? '', opciones);
    f.estadoCivilId.setValue(d.estadoCivilId, opciones);
    // Las respuestas que deciden qué campos se muestran sí avisan el cambio: la pantalla se ajusta a lo guardado.
    f.tieneHijos.setValue(d.tieneHijos);
    f.hijosCantidad.setValue(d.hijosCantidad);
    f.etniaId.setValue(d.etniaId, opciones);
    f.escolaridadId.setValue(d.escolaridadId, opciones);
    f.ocupacionId.setValue(d.ocupacionId, opciones);
    f.epsId.setValue(d.epsId, opciones);
    f.embarazo.setValue(d.embarazo);
    f.semanasGestacion.setValue(d.semanasGestacion, opciones);
    f.recibeSubsidios.setValue(d.recibeSubsidios);
    f.subsidioCual.setValue(d.subsidioCual ?? '', opciones);
    f.tipoTransporteId.setValue(d.tipoTransporteId, opciones);
    f.justificacionTransporte.setValue(d.justificacionTransporte ?? '', opciones);
    f.requiereCuidador.setValue(d.requiereCuidador);
    f.cuidadorGeneroId.setValue(d.cuidadorGeneroId, opciones);
    f.cuidadorTelefonoFijo.setValue(d.cuidadorTelefonoFijo ?? '', opciones);
    f.cuidadorCelular.setValue(d.cuidadorCelular ?? '', opciones);
    f.cuidadorCorreo.setValue(d.cuidadorCorreo ?? '', opciones);
    this.ajustarEdades(d.hijosEdades);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.sincronizarDependientes();
  }

  /** Los datos como los guardaría el servidor: sin espacios sobrantes y sin lo que ya no aplica. */
  private leerDatos(): DatosCaracterizacion {
    const f = this.form.getRawValue();
    const telefono = (v: string) => textoONulo(normalizarTelefono(v));
    const edades = this.form.controls.hijosEdades.controls.map((x) => x.value);
    return aplicarDependencias({
      generoId: f.generoId,
      telefonoFijo: telefono(f.telefonoFijo),
      celular: telefono(f.celular),
      fechaNacimiento: textoONulo(f.fechaNacimiento),
      estadoCivilId: f.estadoCivilId,
      tieneHijos: f.tieneHijos,
      hijosCantidad: f.hijosCantidad,
      hijosEdades: f.tieneHijos === true && f.hijosCantidad !== null ? edades : null,
      etniaId: f.etniaId,
      escolaridadId: f.escolaridadId,
      ocupacionId: f.ocupacionId,
      epsId: f.epsId,
      embarazo: f.embarazo,
      semanasGestacion: f.semanasGestacion,
      recibeSubsidios: f.recibeSubsidios,
      subsidioCual: textoONulo(f.subsidioCual),
      tipoTransporteId: f.tipoTransporteId,
      justificacionTransporte: textoONulo(f.justificacionTransporte),
      requiereCuidador: f.requiereCuidador,
      cuidadorGeneroId: f.cuidadorGeneroId,
      cuidadorTelefonoFijo: telefono(f.cuidadorTelefonoFijo),
      cuidadorCelular: telefono(f.cuidadorCelular),
      cuidadorCorreo: textoONulo(f.cuidadorCorreo)?.toLowerCase() ?? null,
    });
  }

  /** Una edad por hijo: se agregan o quitan casillas conservando las que ya se escribieron. */
  private ajustarEdades(valores?: (number | null)[] | null): void {
    const lista = this.form.controls.hijosEdades;
    const f = this.form.getRawValue();
    const cantidad =
      f.tieneHijos === true &&
      f.hijosCantidad !== null &&
      f.hijosCantidad >= 1 &&
      f.hijosCantidad <= MAX_HIJOS
        ? Math.trunc(f.hijosCantidad)
        : 0;
    while (lista.length > cantidad) lista.removeAt(lista.length - 1, { emitEvent: false });
    while (lista.length < cantidad) {
      lista.push(
        new FormControl<number | null>(null, [
          Validators.required,
          Validators.min(0),
          Validators.max(100),
        ]),
        { emitEvent: false },
      );
    }
    if (valores)
      lista.controls.forEach((x, i) => x.setValue(valores[i] ?? null, { emitEvent: false }));
  }

  /** Obligatorios que dependen de otras respuestas: cambian según lo que la persona contesta. */
  private sincronizarDependientes(): void {
    this.ajustarEdades();
    const f = this.form.controls;
    // El embarazo se ajusta al género: masculino solo puede ser «No aplica» y femenino no puede serlo.
    const genero = this.c()?.catalogos.generos.find((g) => g.id === f.generoId.value)?.codigo;
    if (genero === 'MASCULINO' && f.embarazo.value !== 'NO_APLICA')
      f.embarazo.setValue('NO_APLICA');
    else if (genero === 'FEMENINO' && f.embarazo.value === 'NO_APLICA') f.embarazo.setValue(null);
    const alternar = (control: AbstractControl, obligatorio: boolean) => {
      if (obligatorio === control.hasValidator(Validators.required)) return;
      if (obligatorio) control.addValidators(Validators.required);
      else control.removeValidators(Validators.required);
      control.updateValueAndValidity({ emitEvent: false });
    };
    alternar(f.hijosCantidad, f.tieneHijos.value === true);
    alternar(f.semanasGestacion, f.embarazo.value === 'SI');
    alternar(f.subsidioCual, f.recibeSubsidios.value === true);
    const cuidador = f.requiereCuidador.value === true;
    alternar(f.cuidadorGeneroId, cuidador);
    alternar(f.cuidadorCelular, cuidador);
    alternar(f.cuidadorCorreo, cuidador);
    if (!this.pasos().includes(this.seccion())) this.seccion.set('transporte');
  }

  // ---------------------------------------------------------------------------------------------------------
  // Guardado de avance (RF-CAR-04)
  // ---------------------------------------------------------------------------------------------------------

  /** Un dato se puede enviar si no tiene errores de formato; estar vacío (obligatorio) sí se envía: es borrarlo. */
  private enviable(control: AbstractControl): boolean {
    return Object.keys(control.errors ?? {}).every((k) => k === 'required');
  }

  private camposEnviables(): Set<string> {
    const f = this.form.controls;
    const ok = new Set<string>();
    for (const campo of CAMPOS) {
      if (campo === 'hijosEdades') {
        if (
          this.enviable(f.hijosCantidad) &&
          f.hijosEdades.controls.every((x) => this.enviable(x))
        ) {
          ok.add(campo);
        }
      } else if (this.enviable(f[campo as keyof typeof f] as AbstractControl)) {
        ok.add(campo);
      }
    }
    return ok;
  }

  private cambiosPendientes(): { cambios: CambiosCaracterizacion; hay: boolean } {
    const actual = this.leerDatos();
    const enviables = this.camposEnviables();
    const campos = camposCambiados(actual, this.servidor, enviables);
    const cambios: CambiosCaracterizacion = { version: this.version };
    const destino = cambios as unknown as Record<string, unknown>;
    for (const campo of campos) destino[campo] = actual[campo];
    const pcd = textoONulo(this.form.controls.pcdNombre.value);
    if (pcd && pcd !== this.nombresServidor.pcd && this.enviable(this.form.controls.pcdNombre)) {
      cambios.pcdNombre = pcd;
    }
    const cuidador = textoONulo(this.form.controls.cuidadorNombre.value);
    if (
      this.c()?.cuidador.nombreEditable &&
      cuidador &&
      cuidador !== this.nombresServidor.cuidador &&
      this.enviable(this.form.controls.cuidadorNombre)
    ) {
      cambios.cuidadorNombre = cuidador;
    }
    return { cambios, hay: Object.keys(cambios).length > 1 };
  }

  private alCambiar(): void {
    if (this.paso() !== 'formulario' || !this.editable()) return;
    if (this.cambiosPendientes().hay) {
      this.estadoGuardado.set('pendiente');
      this.mensajeGuardado.set('');
    }
  }

  /** Guarda ya (botón «Guardar avance», cambio de sección o fin de la pausa al escribir). */
  protected async guardarAhora(): Promise<void> {
    clearTimeout(this.temporizador);
    if (this.paso() !== 'formulario' || !this.editable() || this.conflicto()) return;
    if (this.guardando) {
      this.repetir = true;
      return;
    }
    const { cambios, hay } = this.cambiosPendientes();
    if (!hay) {
      if (this.estadoGuardado() === 'pendiente') {
        this.estadoGuardado.set(this.guardadoAt() ? 'guardado' : 'inactivo');
      }
      return;
    }
    this.guardando = true;
    this.estadoGuardado.set('guardando');
    try {
      const r = await firstValueFrom(this.api.guardar(cambios));
      this.version = r.version;
      this.servidor = r.datos;
      this.nombresServidor = { pcd: r.pcdNombre, cuidador: r.cuidadorNombre };
      this.c.update((x) =>
        x
          ? {
              ...x,
              datos: r.datos,
              avance: r.avance,
              version: r.version,
              guardadoAt: r.guardadoAt,
              pcd: { ...x.pcd, nombre: r.pcdNombre },
              cuidador: { ...x.cuidador, nombre: r.cuidadorNombre },
            }
          : x,
      );
      this.reflejarNormalizacion(cambios, r.datos);
      this.guardadoAt.set(r.guardadoAt ? new Date(r.guardadoAt) : new Date());
      this.estadoGuardado.set('guardado');
      this.mensajeGuardado.set('');
    } catch (e) {
      this.alFallar(e);
    } finally {
      this.guardando = false;
      if (this.repetir) {
        this.repetir = false;
        this.programar(0);
      } else if (this.cambiosPendientes().hay && this.estadoGuardado() === 'guardado') {
        this.estadoGuardado.set('pendiente');
      }
    }
  }

  /** Si el servidor dejó un dato distinto de lo escrito (por ejemplo, el teléfono sin espacios), se muestra así. */
  private reflejarNormalizacion(
    enviado: CambiosCaracterizacion,
    guardado: DatosCaracterizacion,
  ): void {
    const actual = this.leerDatos();
    const f = this.form.controls;
    const sinCambio = (campo: CampoDato) =>
      JSON.stringify(actual[campo]) ===
      JSON.stringify((enviado as Partial<DatosCaracterizacion>)[campo]);
    const poner = (campo: CampoDato, control: AbstractControl, valor: unknown) => {
      if (!(campo in enviado) || !sinCambio(campo)) return;
      if (JSON.stringify(actual[campo]) === JSON.stringify(guardado[campo])) return;
      control.setValue(valor, { emitEvent: false });
    };
    poner('telefonoFijo', f.telefonoFijo, guardado.telefonoFijo ?? '');
    poner('celular', f.celular, guardado.celular ?? '');
    poner('cuidadorTelefonoFijo', f.cuidadorTelefonoFijo, guardado.cuidadorTelefonoFijo ?? '');
    poner('cuidadorCelular', f.cuidadorCelular, guardado.cuidadorCelular ?? '');
    poner('cuidadorCorreo', f.cuidadorCorreo, guardado.cuidadorCorreo ?? '');
    poner('subsidioCual', f.subsidioCual, guardado.subsidioCual ?? '');
    poner(
      'justificacionTransporte',
      f.justificacionTransporte,
      guardado.justificacionTransporte ?? '',
    );
    const nombre = (
      control: FormControl<string>,
      guardadoNombre: string,
      enviadoNombre?: string,
    ) => {
      if (enviadoNombre !== undefined && textoONulo(control.value) === enviadoNombre) {
        control.setValue(guardadoNombre, { emitEvent: false });
      }
    };
    nombre(f.pcdNombre, this.nombresServidor.pcd, enviado.pcdNombre);
    nombre(f.cuidadorNombre, this.nombresServidor.cuidador, enviado.cuidadorNombre);
  }

  private alFallar(e: unknown): void {
    this.estadoGuardado.set('error');
    if (!(e instanceof ApiError)) {
      this.mensajeGuardado.set('No pudimos guardar. Lo intentaremos de nuevo.');
      this.programar(ESPERA_REINTENTO);
      return;
    }
    if (e.estado === 0) {
      this.mensajeGuardado.set('Sin conexión. Lo intentaremos de nuevo en unos segundos.');
      this.programar(ESPERA_REINTENTO);
    } else if (e.codigo === 'CONFLICTO_VERSION') {
      this.conflicto.set(true);
      this.mensajeGuardado.set(e.message);
    } else if (e.codigo === 'SOLICITUD_NO_EDITABLE') {
      this.bloqueado.set(true);
      this.mensajeGuardado.set(e.message);
    } else if (e.estado === 401) {
      this.sesion.limpiar();
      this.sesionVencida.set(true);
      this.mensajeGuardado.set(
        'Su sesión venció. Lo que ya se guardó se conserva; abra de nuevo el enlace de su correo para continuar.',
      );
    } else if (e.estado === 422) {
      const sinControl = aplicarErroresApi(this.form, e.errores);
      this.mensajeGuardado.set(
        sinControl.length > 0 ? sinControl.join(' · ') : 'Revise los datos marcados en rojo.',
      );
      // Los datos correctos se guardan en la siguiente vuelta; los marcados esperan su corrección.
      this.programar(0);
    } else if (e.estado === 429) {
      this.mensajeGuardado.set(
        'Demasiadas operaciones seguidas. Lo intentaremos en unos segundos.',
      );
      this.programar(ESPERA_REINTENTO * 2);
    } else {
      this.mensajeGuardado.set(e.message);
      this.programar(ESPERA_REINTENTO);
    }
  }

  private programar(ms: number): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.guardarAhora(), ms);
  }

  protected avisarSiHayCambios(evento: BeforeUnloadEvent): void {
    if (this.paso() === 'formulario' && this.cambiosPendientes().hay) {
      evento.preventDefault();
    }
  }

  // ---------------------------------------------------------------------------------------------------------
  // Navegación entre secciones
  // ---------------------------------------------------------------------------------------------------------

  protected ir(destino: SeccionVisible): void {
    this.seccion.set(destino);
    this.errorEnvio.set('');
    this.enfocarTitulo();
    if (destino === 'revision') {
      // Primero se guarda lo escrito, para que la revisión vea lo último.
      void this.guardarAhora().then(() => this.cargarRevision());
    } else {
      void this.guardarAhora();
    }
  }

  /** Va a la sección que indica el servidor (la sección de un dato pendiente). */
  protected irA(seccion: string): void {
    this.ir(seccion as SeccionVisible);
  }

  /** Qué falta para poder enviar: lo calcula el servidor, que es quien lo exige al radicar. */
  protected async cargarRevision(): Promise<void> {
    this.cargandoRevision.set(true);
    try {
      this.revision.set(await firstValueFrom(this.api.revision()));
    } catch (e) {
      this.errorEnvio.set(
        e instanceof ApiError ? e.message : 'No pudimos revisar su solicitud. Intente de nuevo.',
      );
    } finally {
      this.cargandoRevision.set(false);
    }
  }

  protected alActualizarDocumentos(d: DocumentosSolicitud): void {
    this.documentos.set(d);
  }

  protected pedirConfirmacion(): void {
    this.errorEnvio.set('');
    this.confirmando.set(true);
  }

  /** Envía la solicitud: el servidor valida de nuevo, genera el radicado y manda el correo. */
  protected async enviar(): Promise<void> {
    this.enviando.set(true);
    this.errorEnvio.set('');
    try {
      await this.guardarAhora();
      const r = await firstValueFrom(this.api.radicar());
      this.confirmando.set(false);
      this.radicacion.set(r);
      this.paso.set('radicada');
      this.enfocarTitulo();
    } catch (e) {
      this.confirmando.set(false);
      if (e instanceof ApiError && e.codigo === 'YA_RADICADA') {
        await this.cargar();
        return;
      }
      this.errorEnvio.set(
        e instanceof ApiError
          ? e.errores.length > 0
            ? 'Todavía faltan datos o documentos. Revise la lista y complételos para poder enviar.'
            : e.message
          : 'No pudimos enviar su solicitud. Intente de nuevo.',
      );
      await this.cargarRevision();
    } finally {
      this.enviando.set(false);
    }
  }

  protected imprimir(): void {
    window.print();
  }

  protected siguiente(): void {
    const sig = this.pasos()[this.indice() + 1];
    if (sig) this.ir(sig);
  }

  protected anterior(): void {
    const ant = this.pasos()[this.indice() - 1];
    if (ant) this.ir(ant);
  }

  /** Estado de una sección para el menú de pasos. */
  protected estadoDe(codigo: SeccionVisible): 'completa' | 'pendiente' | 'neutral' {
    if (codigo === 'revision') return 'neutral';
    if (codigo === 'documentos') {
      const r = this.documentos()?.resumen;
      if (!r) return 'neutral';
      return r.completo ? 'completa' : 'pendiente';
    }
    const s = this.avance()?.secciones.find((x) => x.codigo === codigo);
    if (!s) return 'neutral';
    return s.completa ? 'completa' : 'pendiente';
  }

  /** «1 dato pendiente», «3 documentos pendientes». */
  protected textoFaltan(codigo: SeccionVisible): string {
    const n = this.faltanDe(codigo);
    const palabra = codigo === 'documentos' ? 'documento' : 'dato';
    return `${n} ${palabra}${n === 1 ? ' pendiente' : 's pendientes'}`;
  }

  protected faltanDe(codigo: SeccionVisible): number {
    if (codigo === 'documentos') {
      const r = this.documentos()?.resumen;
      return r ? r.obligatorios - r.cargados : 0;
    }
    return this.avance()?.secciones.find((x) => x.codigo === codigo)?.faltantes.length ?? 0;
  }

  protected POR_QUE_DE(codigo: SeccionVisible): string {
    return POR_QUE[codigo];
  }

  protected edades(): FormArray<FormControl<number | null>> {
    return this.form.controls.hijosEdades;
  }
}
