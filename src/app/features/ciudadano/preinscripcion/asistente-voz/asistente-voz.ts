import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AbstractControl, FormControl } from '@angular/forms';
import {
  OpcionDicha,
  coincidirOpcion,
  primeraInterpretacion,
  deletrear,
  interpretarCorreo,
  interpretarSiNo,
  leerDigitos,
  nombrePropio,
} from '../../../../shared/lectura-voz/analisis-voz';
import { LecturaVoz } from '../../../../shared/lectura-voz/lectura-voz';
import {
  MENSAJES_FALLO,
  MotivoFallo,
  ReconocimientoVoz,
} from '../../../../shared/lectura-voz/reconocimiento-voz';
import { textoError } from '../../../../shared/campo';
import { soloDigitos } from '../../../../shared/identificacion';

/** Los campos del formulario de preinscripción que el asistente llena. */
export interface ControlesPreinscripcion {
  controls: {
    diligencia: FormControl<'PCD' | 'CUIDADOR' | null>;
    agregaCuidador: FormControl<boolean | null>;
    pcdNombre: FormControl<string>;
    pcdTipoIdentificacionId: FormControl<number | null>;
    pcdNumero: FormControl<string>;
    cuidadorNombre: FormControl<string>;
    cuidadorTipoIdentificacionId: FormControl<number | null>;
    cuidadorNumero: FormControl<string>;
    cuidadorEsPcd: FormControl<boolean | null>;
    correo: FormControl<string>;
    correoConfirmacion: FormControl<string>;
    aceptaAutorizacion: FormControl<boolean>;
  };
}

export interface TipoDocumentoDicho {
  id: number;
  codigo: string;
  nombre: string;
}

/** Lo que la persona contestó: hablando, escribiendo o con los botones grandes. */
type Entrada =
  | { via: 'voz'; texto: string; alternativas: string[] }
  | { via: 'fallo'; motivo: MotivoFallo }
  | { via: 'ui'; texto: string }
  | { via: 'sino'; valor: boolean }
  | { via: 'opcion'; id: number }
  | { via: 'repetir' }
  | { via: 'saltar' }
  | { via: 'silencio' };

class Salida extends Error {}

/** Otras formas de decir cada tipo de documento. */
const ALIAS: Record<string, string[]> = {
  CC: ['cedula', 'cedula de ciudadania', 'cc'],
  TI: ['tarjeta', 'tarjeta de identidad', 'ti'],
  RC: ['registro', 'registro civil', 'rc'],
  CE: ['cedula de extranjeria', 'extranjeria', 'ce'],
  PA: ['pasaporte', 'pa'],
  PT: ['permiso por proteccion temporal', 'proteccion temporal', 'permiso temporal', 'pt'],
};

/**
 * Asistente de preinscripción por voz para quien no ve: hace las preguntas en voz alta, escucha las respuestas, repite lo
 * que entendió y pide confirmarlo, y llena el formulario. Cada pregunta también se puede contestar con los botones
 * grandes o escribiendo. Los datos sensibles (número de documento) NO se escuchan: la voz del navegador viaja a un
 * servicio externo, así que se escriben y el asistente va diciendo cada número.
 */
@Component({
  selector: 'app-asistente-voz',
  templateUrl: './asistente-voz.html',
  styleUrl: './asistente-voz.scss',
  host: {
    '(document:pointerdown)': 'alToque($event)',
    '(document:keydown)': 'alToque($event)',
  },
})
export class AsistenteVoz implements OnInit {
  protected readonly voz = inject(LecturaVoz);
  private readonly reconocimiento = inject(ReconocimientoVoz);
  /** Lo que se va oyendo mientras la persona habla. */
  protected readonly oido = this.reconocimiento.parcial;
  private readonly destruir = inject(DestroyRef);

  readonly form = input.required<ControlesPreinscripcion>();
  readonly tipos = input.required<TipoDocumentoDicho[]>();
  readonly autorizacion = input<string | null>(null);
  /** La persona confirmó el resumen: el formulario se envía. */
  readonly enviar = output<void>();

  protected readonly abierto = signal(false);
  protected readonly pregunta = signal('');
  protected readonly modo = signal<'info' | 'sino' | 'texto' | 'sensible' | 'opcion' | 'lectura'>(
    'info',
  );
  protected readonly estado = signal<'hablando' | 'escuchando' | 'esperando'>('esperando');
  protected readonly etiquetaEntrada = signal('');
  protected readonly entrada = signal('');
  protected readonly modoTeclado = signal<'numeric' | 'text'>('text');
  protected readonly opciones = signal<TipoDocumentoDicho[]>([]);
  private readonly cuadro = viewChild<ElementRef<HTMLInputElement>>('cuadro');

  private corriendo = false;
  private cancelado = false;
  private destruido = false;
  /** El micrófono no sirve (permiso, internet…): ya se le dijo y solo se usan los botones y el teclado. */
  private microfonoMalo = false;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private resolverUI: ((e: Entrada) => void) | null = null;
  /** Respuesta tocada mientras el asistente todavía hablaba: corta la voz y se toma como respuesta. */
  private entradaPendiente: Entrada | null = null;

  constructor() {
    // Si la persona dijo que sí necesita la lectura, el asistente empieza.
    effect(() => {
      if (this.voz.asistenteSolicitado()) {
        untracked(() => {
          this.voz.asistenteSolicitado.set(false);
          void this.iniciar();
        });
      }
    });
  }

  ngOnInit(): void {
    this.voz.asistenteEnPagina.set(true);
    this.destruir.onDestroy(() => {
      this.destruido = true;
      clearTimeout(this.temporizador);
      this.cancelado = true;
      this.voz.asistenteEnPagina.set(false);
      this.cancelar();
    });
    // Quien ya pidió la lectura y vuelve a esta pantalla: empieza solo (si el navegador ya permite hablar).
    if (this.voz.activa() && this.voz.decidida() && this.voz.gestoHecho) {
      this.temporizador = setTimeout(() => void this.iniciar(), 500);
    }
  }

  /** El primer toque o tecla (fuera de los botones) es el permiso para hablar: aquí empieza quien ya pidió la lectura. */
  protected alToque(e: Event): void {
    if (
      e.target instanceof Element &&
      e.target.closest('button, a, input, select, textarea, dialog')
    ) {
      return;
    }
    this.voz.gestoHecho = true;
    if (this.voz.activa() && this.voz.decidida() && !this.corriendo && !this.yaTerminado) {
      void this.iniciar();
    }
  }

  private yaTerminado = false;

  // ------------------------------------------------------------------ control de la conversación

  protected async iniciar(): Promise<void> {
    if (this.corriendo || this.destruido || !this.voz.soportado) return;
    this.corriendo = true;
    this.cancelado = false;
    this.abierto.set(true);
    try {
      await this.conversacion();
      this.yaTerminado = true;
    } catch (e) {
      if (!(e instanceof Salida)) throw e;
    } finally {
      this.cancelar();
      this.corriendo = false;
      this.abierto.set(false);
    }
  }

  /** La persona sale del asistente (botón «Salir» o fin): se calla todo y el formulario queda como está. */
  protected salir(): void {
    this.cancelar();
    this.cancelado = true;
    this.resolverUI?.({ via: 'silencio' });
  }

  /** Quien activó la voz sin necesitarla la apaga: el formulario queda como siempre. */
  protected apagar(): void {
    this.salir();
    this.voz.fijar(false);
  }

  private cancelar(): void {
    this.reconocimiento.cancelar();
    this.voz.detener();
  }

  private revisar(): void {
    if (this.cancelado) throw new Salida();
  }

  private async decirA(texto: string): Promise<void> {
    this.revisar();
    this.estado.set('hablando');
    await this.voz.decir(texto);
    this.revisar();
  }

  /** Espera la respuesta: hablando (si se puede) o con los botones y los cuadros de la pantalla. */
  private async esperar(conVoz: boolean): Promise<Entrada> {
    this.revisar();
    if (this.entradaPendiente) {
      const e = this.entradaPendiente;
      this.entradaPendiente = null;
      return e;
    }
    const ui = new Promise<Entrada>((resolver) => {
      this.resolverUI = resolver;
    });
    if (!conVoz || this.microfonoMalo || !this.reconocimiento.soportado) {
      this.estado.set('esperando');
      const r = await ui;
      this.revisar();
      return r;
    }
    this.estado.set('escuchando');
    const voz = this.reconocimiento
      .escuchar(12_000)
      .then((r): Entrada =>
        r.ok
          ? { via: 'voz', texto: r.texto, alternativas: r.alternativas }
          : r.motivo === 'sin-voz'
            ? { via: 'silencio' }
            : { via: 'fallo', motivo: r.motivo },
      );
    const ganador = await Promise.race([ui, voz]);
    if (ganador.via !== 'voz' && ganador.via !== 'silencio' && ganador.via !== 'fallo') {
      this.reconocimiento.cancelar();
    }
    this.revisar();
    if (ganador.via === 'fallo') {
      // Si el problema es el micrófono, se le dice cuál es; después se vuelve a preguntar solo con botones y teclado.
      this.microfonoMalo = true;
      await this.decirA(MENSAJES_FALLO[ganador.motivo as Exclude<MotivoFallo, 'sin-voz'>]);
      return { via: 'repetir' };
    }
    return ganador;
  }

  // ------------------------------------------------------------------ tipos de pregunta

  private async preguntarSiNo(texto: string): Promise<boolean> {
    this.modo.set('sino');
    this.pregunta.set(texto);
    for (let intento = 0; ; intento++) {
      this.entradaPendiente = null;
      await this.decirA(`${texto} Diga sí o no.`);
      const r = await this.esperar(intento < 3);
      if (r.via === 'sino') return r.valor;
      if (r.via === 'voz') {
        const v = primeraInterpretacion(r.alternativas, interpretarSiNo);
        if (v) return v === 'si';
      }
      if (r.via === 'repetir') continue;
      if (intento === 2) await this.decirA('Use los botones grandes de la pantalla: Sí o No.');
      else if (r.via !== 'ui') await this.decirA('No le entendí.');
    }
  }

  private async preguntarTexto(
    texto: string,
    control: AbstractControl,
    etiqueta: string,
    normalizar: (t: string) => string | null,
    deletreo = false,
  ): Promise<void> {
    this.modo.set('texto');
    this.pregunta.set(texto);
    this.etiquetaEntrada.set(etiqueta);
    this.entrada.set('');
    for (let intento = 0; ; intento++) {
      this.entradaPendiente = null;
      await this.decirA(texto);
      const r = await this.esperar(intento < 3);
      if (r.via === 'repetir') continue;
      if (r.via !== 'voz' && r.via !== 'ui') {
        if (r.via === 'silencio')
          await this.decirA('No la escuché. Puede escribir la respuesta en el recuadro.');
        continue;
      }
      const valor =
        r.via === 'voz' ? primeraInterpretacion(r.alternativas, normalizar) : normalizar(r.texto);
      if (valor === null) {
        await this.decirA('No le entendí.');
        continue;
      }
      control.setValue(valor);
      control.markAsTouched();
      control.updateValueAndValidity();
      if (control.invalid) {
        await this.decirA(`Ese dato no es válido. ${textoError(control, etiqueta)}.`);
        continue;
      }
      // Lo que se dictó se confirma; lo que se escribió ya lo vio o lo sintió la persona.
      if (r.via === 'voz') {
        const claro = deletreo ? deletrear(valor) : valor;
        if (!(await this.preguntarSiNo(`Entendí: ${claro}. ¿Es correcto?`))) {
          this.modo.set('texto');
          this.pregunta.set(texto);
          continue;
        }
      }
      return;
    }
  }

  private async preguntarTipo(texto: string, control: FormControl<number | null>): Promise<void> {
    const lista = this.tipos();
    const opciones: OpcionDicha[] = lista.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      alias: ALIAS[t.codigo],
    }));
    this.modo.set('opcion');
    this.pregunta.set(texto);
    this.opciones.set(lista);
    for (let intento = 0; ; intento++) {
      this.entradaPendiente = null;
      await this.decirA(
        `${texto} Por ejemplo: cédula de ciudadanía, tarjeta de identidad, registro civil, cédula de extranjería o pasaporte.`,
      );
      const r = await this.esperar(intento < 3);
      if (r.via === 'repetir') continue;
      let id: number | null = null;
      if (r.via === 'opcion') id = r.id;
      else if (r.via === 'voz') {
        id = primeraInterpretacion(r.alternativas, (t) => coincidirOpcion(t, opciones))?.id ?? null;
      }
      if (id === null) {
        await this.decirA('No le entendí.');
        continue;
      }
      const nombre = lista.find((t) => t.id === id)?.nombre ?? '';
      if (r.via === 'voz' && !(await this.preguntarSiNo(`Entendí: ${nombre}. ¿Es correcto?`))) {
        this.modo.set('opcion');
        this.pregunta.set(texto);
        continue;
      }
      control.setValue(id);
      control.markAsTouched();
      return;
    }
  }

  /**
   * Dato sensible (número de documento): no se escucha. La persona lo escribe en el recuadro y el asistente le dice cada
   * número que teclea; al terminar se lo repite completo para que lo confirme.
   */
  private async pedirSensible(
    texto: string,
    control: AbstractControl,
    etiqueta: string,
    tipoId: number | null,
  ): Promise<void> {
    const codigo = this.tipos().find((t) => t.id === tipoId)?.codigo;
    this.modoTeclado.set(soloDigitos(codigo) ? 'numeric' : 'text');
    this.modo.set('sensible');
    this.pregunta.set(texto);
    this.etiquetaEntrada.set(etiqueta);
    this.entrada.set('');
    await this.decirA(
      `Por su seguridad, este dato no lo escucho. ${texto} Escríbalo en el recuadro: le iré diciendo cada número. Cuando termine, toque Listo.`,
    );
    for (;;) {
      this.enfocarCuadro();
      const r = await this.esperar(false);
      if (r.via === 'repetir') {
        await this.decirA(texto);
        continue;
      }
      if (r.via !== 'ui') continue;
      const valor = r.texto.replace(/\s+/g, '');
      control.setValue(valor);
      control.markAsTouched();
      control.updateValueAndValidity();
      if (!valor || control.invalid) {
        await this.decirA(
          `Ese dato no es válido. ${textoError(control, etiqueta)}. Escríbalo de nuevo.`,
        );
        this.entrada.set('');
        this.modo.set('sensible');
        continue;
      }
      const dicho = /^\d+$/.test(valor) ? leerDigitos(valor) : deletrear(valor);
      if (await this.preguntarSiNo(`Escribió: ${dicho}. ¿Es correcto?`)) return;
      this.entrada.set('');
      this.modo.set('sensible');
    }
  }

  private enfocarCuadro(): void {
    setTimeout(() => this.cuadro()?.nativeElement.focus(), 50);
  }

  // ------------------------------------------------------------------ la conversación completa

  private async conversacion(): Promise<void> {
    const f = this.form().controls;
    this.modo.set('info');
    this.pregunta.set('Preinscripción por voz');
    await this.decirA(
      'Voy a ayudarle a hacer la preinscripción, una pregunta a la vez. Responda hablando después del pitido, o use los botones grandes de la pantalla. ' +
        'El navegador puede pedirle permiso para usar el micrófono: acéptelo. Puede salir cuando quiera con el botón Salir del asistente.',
    );

    const esPcd = await this.preguntarSiNo(
      '¿Usted es la persona con discapacidad? Diga sí si es la persona con discapacidad, o no si es su cuidador.',
    );
    f.diligencia.setValue(esPcd ? 'PCD' : 'CUIDADOR');
    let conCuidador = !esPcd;
    if (esPcd) {
      conCuidador = await this.preguntarSiNo('¿Va a agregar un cuidador o asistente personal?');
      f.agregaCuidador.setValue(conCuidador);
    }

    const nombre = (t: string): string | null => {
      const n = nombrePropio(t);
      return n.length >= 3 ? n : null;
    };
    await this.preguntarTexto(
      'Diga el nombre completo de la persona con discapacidad.',
      f.pcdNombre,
      'Nombre completo de la persona con discapacidad',
      nombre,
    );
    await this.preguntarTipo(
      '¿Qué tipo de documento tiene la persona con discapacidad?',
      f.pcdTipoIdentificacionId,
    );
    await this.pedirSensible(
      'Ahora escriba el número de documento de la persona con discapacidad, sin puntos ni espacios.',
      f.pcdNumero,
      'Número de documento de la persona con discapacidad',
      f.pcdTipoIdentificacionId.value,
    );

    if (conCuidador) {
      await this.preguntarTexto(
        'Diga el nombre completo del cuidador.',
        f.cuidadorNombre,
        'Nombre completo del cuidador',
        nombre,
      );
      await this.preguntarTipo(
        '¿Qué tipo de documento tiene el cuidador?',
        f.cuidadorTipoIdentificacionId,
      );
      await this.pedirSensible(
        'Ahora escriba el número de documento del cuidador, sin puntos ni espacios.',
        f.cuidadorNumero,
        'Número de documento del cuidador',
        f.cuidadorTipoIdentificacionId.value,
      );
      f.cuidadorEsPcd.setValue(
        await this.preguntarSiNo('¿El cuidador también es una persona con discapacidad?'),
      );
    }

    await this.decirA(
      'La dirección de residencia y el barrio son opcionales: puede completarlos más adelante.',
    );
    await this.preguntarTexto(
      'Diga el correo electrónico donde quiere recibir el enlace de verificación. Diga arroba para la @ y punto para el punto, por ejemplo: maria arroba gmail punto com.',
      f.correo,
      'Correo electrónico',
      (t) => interpretarCorreo(t),
      true,
    );
    f.correoConfirmacion.setValue(f.correo.value);

    const texto = this.autorizacion();
    if (texto) {
      this.modo.set('lectura');
      this.pregunta.set('Autorización de tratamiento de datos personales');
      await this.decirA(
        'Ahora le leo el aviso de tratamiento de datos personales. Puede saltar la lectura con el botón.',
      );
      const lectura = Promise.race([
        this.voz.decir(texto),
        new Promise<void>((resolver) => {
          this.resolverUI = () => resolver();
        }),
      ]);
      await lectura;
      this.voz.detener();
      this.revisar();
    }
    const acepta = await this.preguntarSiNo(
      '¿Autoriza el tratamiento de sus datos personales en los términos que acaba de escuchar?',
    );
    f.aceptaAutorizacion.setValue(acepta);
    if (!acepta) {
      await this.decirA(
        'Sin esa autorización no podemos continuar con la preinscripción. Si cambia de opinión, vuelva a empezar el asistente.',
      );
      return;
    }

    const doc = this.tipos().find((t) => t.id === f.pcdTipoIdentificacionId.value)?.nombre ?? '';
    await this.decirA(
      `Resumen. Persona con discapacidad: ${f.pcdNombre.value}. ${doc}, número ${leerDigitos(f.pcdNumero.value)}. ` +
        `Correo: ${deletrear(f.correo.value)}.`,
    );
    if (await this.preguntarSiNo('¿Envío la preinscripción?')) {
      await this.decirA(
        'Enviando la preinscripción. Después le llegará un correo con un enlace para verificar su dirección.',
      );
      this.enviar.emit();
    } else {
      await this.decirA(
        'No la envié. Puede corregir los datos en el formulario y enviarla cuando quiera.',
      );
    }
  }

  // ------------------------------------------------------------------ lo que la persona hace en la pantalla

  private recibir(e: Entrada): void {
    if (this.resolverUI) {
      const resolver = this.resolverUI;
      this.resolverUI = null;
      resolver(e);
    } else {
      this.entradaPendiente = e;
      this.voz.detener();
    }
  }

  protected responderSino(valor: boolean): void {
    this.recibir({ via: 'sino', valor });
  }

  protected elegirOpcion(id: number): void {
    this.recibir({ via: 'opcion', id });
  }

  protected listo(): void {
    this.recibir({ via: 'ui', texto: this.entrada() });
  }

  protected repetir(): void {
    this.reconocimiento.cancelar();
    this.voz.detener();
    this.recibir({ via: 'repetir' });
  }

  protected saltarLectura(): void {
    this.voz.detener();
    this.resolverUI?.({ via: 'saltar' });
  }

  protected alEscribir(e: Event): void {
    const valor = (e.target as HTMLInputElement).value;
    this.entrada.set(valor);
    // En el dato sensible se dice cada número que se teclea, para saber que entró bien.
    if (this.modo() === 'sensible' && valor.length > 0) this.voz.hablar(valor.slice(-1));
  }

  protected textoEstado(): string {
    switch (this.estado()) {
      case 'hablando':
        return 'Hablando…';
      case 'escuchando':
        return 'Escuchando: hable ahora';
      default:
        return 'Esperando su respuesta';
    }
  }
}
