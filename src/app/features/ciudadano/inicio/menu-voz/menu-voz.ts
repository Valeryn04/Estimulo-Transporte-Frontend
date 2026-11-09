import { Component, DestroyRef, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
  interpretarMenu,
  primeraInterpretacion,
} from '../../../../shared/lectura-voz/analisis-voz';
import { LecturaVoz } from '../../../../shared/lectura-voz/lectura-voz';
import {
  MENSAJES_FALLO,
  MotivoFallo,
  ReconocimientoVoz,
} from '../../../../shared/lectura-voz/reconocimiento-voz';

interface OpcionMenu {
  id: number;
  nombre: string;
  /** Cómo se dice en voz alta. */
  dicho: string;
  ruta: string | null;
}

/** Las opciones de la pantalla de inicio, en el mismo orden en que se leen. */
export const OPCIONES_MENU: OpcionMenu[] = [
  { id: 1, nombre: 'Preinscribirme', dicho: 'preinscribirse', ruta: '/preinscripcion' },
  {
    id: 2,
    nombre: 'Continuar mi caracterización y cargar documentos',
    dicho: 'continuar con la caracterización y los documentos',
    ruta: '/caracterizacion',
  },
  {
    id: 3,
    nombre: 'Consultar el estado de mi solicitud',
    dicho: 'consultar el estado de su solicitud',
    ruta: '/consulta',
  },
  {
    id: 4,
    nombre: 'No me llegó el correo de verificación',
    dicho: 'recibir de nuevo el correo de verificación',
    ruta: '/reenviar-verificacion',
  },
  {
    id: 5,
    nombre: 'Escuchar la guía paso a paso',
    dicho: 'escuchar la guía paso a paso',
    ruta: '/ayuda',
  },
  { id: 6, nombre: 'Apagar la voz', dicho: 'apagar la voz y seguir sin ayuda de voz', ruta: null },
];

/**
 * Menú principal por voz para quien no ve: dice qué se puede hacer, escucha «uno», «consultar el estado»… y abre esa
 * pantalla. Las mismas opciones están en botones grandes. Es lo primero que oye quien dijo que necesita la lectura.
 */
@Component({
  selector: 'app-menu-voz',
  templateUrl: './menu-voz.html',
  styleUrl: './menu-voz.scss',
  host: {
    '(document:pointerdown)': 'alToque($event)',
    '(document:keydown)': 'alToque($event)',
  },
})
export class MenuVoz implements OnInit {
  protected readonly voz = inject(LecturaVoz);
  private readonly reconocimiento = inject(ReconocimientoVoz);
  /** Lo que se va oyendo mientras la persona habla. */
  protected readonly oido = this.reconocimiento.parcial;
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);

  protected readonly opciones = OPCIONES_MENU;
  protected readonly abierto = signal(false);
  protected readonly estado = signal<'hablando' | 'escuchando' | 'esperando'>('esperando');

  private corriendo = false;
  private cancelado = false;
  private destruido = false;
  /** El micrófono no sirve (permiso, internet…): ya se le dijo y solo se usan los botones. */
  private microfonoMalo = false;
  private fallo: MotivoFallo | null = null;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private resolverUI: ((id: number | null) => void) | null = null;
  /** Opción tocada mientras el menú todavía hablaba: se toma como respuesta y se corta la voz. */
  private elegida: number | null | undefined;

  constructor() {
    // Si la persona acaba de decir que sí necesita la lectura, el menú empieza.
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
    // Aquí el menú es quien habla: la lectura de entrada de la barra se calla.
    this.voz.asistenteEnPagina.set(true);
    this.destruir.onDestroy(() => {
      this.destruido = true;
      clearTimeout(this.temporizador);
      this.voz.asistenteEnPagina.set(false);
      this.cancelado = true;
      this.reconocimiento.cancelar();
      this.voz.detener();
    });
    if (this.voz.activa() && this.voz.decidida() && this.voz.gestoHecho) {
      this.temporizador = setTimeout(() => void this.iniciar(), 500);
    }
  }

  /** El primer toque o tecla (fuera de los botones) es el permiso para hablar de quien ya pidió la lectura. */
  protected alToque(e: Event): void {
    if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea'))
      return;
    this.voz.gestoHecho = true;
    if (this.voz.activa() && this.voz.decidida() && !this.corriendo && !this.yaDicho) {
      void this.iniciar();
    }
  }

  private yaDicho = false;

  protected async iniciar(): Promise<void> {
    if (this.corriendo || this.destruido || !this.voz.soportado) return;
    this.corriendo = true;
    this.cancelado = false;
    this.abierto.set(true);
    try {
      await this.menu();
      this.yaDicho = true;
    } finally {
      this.corriendo = false;
    }
  }

  private async hablar(texto: string): Promise<void> {
    this.estado.set('hablando');
    await this.voz.decir(texto);
  }

  /** Dice el menú, escucha la elección y la abre. Hasta tres intentos hablando; después, solo los botones. */
  private async menu(): Promise<void> {
    await this.hablar(
      'Estímulo Social de Transporte, de la Alcaldía de Barranquilla, para personas con discapacidad y, cuando aplique, su cuidador. ' +
        'Importante: la preinscripción no equivale a la aprobación del beneficio.',
    );
    const lista = this.opciones.map((o) => `${o.id}, ${o.dicho}`).join('. ');
    for (let intento = 0; !this.cancelado; intento++) {
      // Un toque durante la primera lectura vale; los de intentos anteriores ya no.
      if (intento > 0) this.elegida = undefined;
      await this.hablar(`¿Qué desea hacer? ${lista}. Diga el número o el nombre de la opción.`);
      if (this.cancelado) return;
      const id = await this.esperar(intento < 3 && !this.microfonoMalo);
      if (this.cancelado) return;
      if (this.fallo) {
        const motivo = this.fallo;
        this.fallo = null;
        this.microfonoMalo = true;
        await this.hablar(MENSAJES_FALLO[motivo as Exclude<MotivoFallo, 'sin-voz'>]);
        continue;
      }
      const opcion = this.opciones.find((o) => o.id === id);
      if (opcion) {
        await this.abrir(opcion);
        return;
      }
      if (intento === 2) {
        await this.hablar('Use los botones grandes de la pantalla para escoger.');
      } else if (id === null) {
        await this.hablar('No le entendí.');
      }
    }
  }

  /** Espera la elección: hablando (si se puede) o con un botón. Devuelve el número de la opción. */
  private async esperar(conVoz: boolean): Promise<number | null> {
    if (this.elegida !== undefined) {
      const e = this.elegida;
      this.elegida = undefined;
      return e;
    }
    const ui = new Promise<number | null>((resolver) => {
      this.resolverUI = resolver;
    });
    if (!conVoz || !this.reconocimiento.soportado) {
      this.estado.set('esperando');
      return ui;
    }
    this.estado.set('escuchando');
    const voz = this.reconocimiento.escuchar(12_000).then((r) => {
      if (r.ok) return primeraInterpretacion(r.alternativas, interpretarMenu);
      if (r.motivo !== 'sin-voz') this.fallo = r.motivo;
      return null;
    });
    const ganador = await Promise.race([ui, voz]);
    this.reconocimiento.cancelar();
    return ganador;
  }

  private async abrir(o: OpcionMenu): Promise<void> {
    if (o.ruta === null) {
      this.abierto.set(false);
      this.voz.fijar(false);
      return;
    }
    this.estado.set('hablando');
    await this.voz.decir(`Abriendo: ${o.nombre}.`);
    this.abierto.set(false);
    await this.router.navigateByUrl(o.ruta);
  }

  protected elegir(id: number): void {
    this.recibir(id);
  }

  /** Responde a quien espera; si todavía está hablando, corta la voz y guarda la respuesta para cuando termine. */
  private recibir(id: number | null): void {
    if (this.resolverUI) {
      this.resolverUI(id);
      this.resolverUI = null;
    } else {
      this.elegida = id;
      this.voz.detener();
    }
  }

  protected repetir(): void {
    this.reconocimiento.cancelar();
    this.voz.detener();
    this.recibir(null);
  }

  protected textoEstado(): string {
    switch (this.estado()) {
      case 'hablando':
        return 'Hablando…';
      case 'escuchando':
        return 'Escuchando: hable ahora';
      default:
        return 'Esperando su elección';
    }
  }
}
