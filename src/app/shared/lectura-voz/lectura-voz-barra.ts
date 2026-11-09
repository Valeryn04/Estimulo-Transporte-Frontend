import { Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { interpretarSiNo, primeraInterpretacion } from './analisis-voz';
import {
  LecturaVoz,
  PREGUNTA_INICIAL,
  SALUDO,
  describirControl,
  textoConAyuda,
} from './lectura-voz';
import { MENSAJES_FALLO, ReconocimientoVoz } from './reconocimiento-voz';

/** Espera a que la pantalla termine de dibujarse antes de leerla. */
export const RETRASO_ENTRADA = 700;

/**
 * Lectura en voz alta del portal ciudadano. Al entrar por primera vez pregunta, en voz alta y con dos botones, si la
 * persona es una persona con discapacidad visual y necesita que le lean el formulario: si responde que sí, sigue con la
 * lectura y el asistente por voz; si responde que no, queda todo manual y en silencio. La respuesta se recuerda.
 * Los navegadores no dejan hablar antes del primer toque o tecla: la pregunta se dice con ese primer contacto.
 */
@Component({
  selector: 'app-lectura-voz-barra',
  templateUrl: './lectura-voz-barra.html',
  styleUrl: './lectura-voz-barra.scss',
  host: {
    '(document:focusin)': 'alEnfocar($event)',
    '(document:keydown)': 'alTeclear($event)',
    '(document:pointerdown)': 'primerContacto($event)',
  },
})
export class LecturaVozBarra implements OnInit {
  protected readonly voz = inject(LecturaVoz);
  private readonly reconocimiento = inject(ReconocimientoVoz);
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);
  private readonly raiz = inject(ElementRef<HTMLElement>);

  /** Aún no se pudo hablar solos (el navegador lo bloquea): se hará con el primer toque o tecla. */
  private pendiente = false;
  private preguntando = false;
  /** La persona dijo que no quería volver al menú: se le vuelve a ofrecer con su próximo toque. */
  private menuPendiente = false;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe(() => this.programarEntrada());
    this.programarEntrada();
    this.destruir.onDestroy(() => {
      clearTimeout(this.temporizador);
      this.reconocimiento.cancelar();
    });
    // Los avisos y errores que aparecen se leen solos.
    const principal = this.principal();
    if (principal && typeof MutationObserver !== 'undefined') {
      const observador = new MutationObserver((cambios) => {
        if (!this.voz.activa() || this.voz.asistenteEnPagina()) return;
        for (const c of cambios) {
          c.addedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement)) return;
            const avisos = n.matches('[role="alert"], [role="status"]')
              ? [n]
              : Array.from(n.querySelectorAll<HTMLElement>('[role="alert"], [role="status"]'));
            for (const a of avisos) {
              const t = (a.textContent ?? '').trim();
              if (t && !/^cargando/i.test(t)) this.voz.hablar(t, true);
            }
          });
        }
      });
      observador.observe(principal, { childList: true, subtree: true });
      this.destruir.onDestroy(() => observador.disconnect());
    }
  }

  /** Título, ayuda del título e introducción de la pantalla actual: lo que se dice al entrar. */
  private textoDeEntrada(): string {
    const principal = this.principal();
    if (!principal) return '';
    const h1 = principal.querySelector('h1');
    const intro = Array.from(principal.querySelectorAll('p'))
      .map((p) => textoConAyuda(p))
      .filter((t) => t.length > 20)
      .slice(0, 2)
      .join(' ');
    return [h1 ? textoConAyuda(h1) : '', intro].filter(Boolean).join(' ');
  }

  /** Espera a que la pantalla se dibuje; si llega otra pantalla antes, solo se lee la última. */
  private programarEntrada(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.alEntrar(), RETRASO_ENTRADA);
  }

  /**
   * Al entrar: si todavía no se le ha preguntado a la persona, se le pregunta; si dijo que sí, se lee la pantalla
   * (salvo que la pantalla tenga asistente por voz, que lo hace él); si dijo que no, no se dice nada.
   */
  private async alEntrar(): Promise<void> {
    if (!this.voz.soportado) return;
    if (!this.voz.decidida()) {
      if (await this.voz.intentar(PREGUNTA_INICIAL)) {
        this.voz.gestoHecho = true;
        await this.escucharRespuesta();
      } else {
        this.pendiente = true;
      }
      return;
    }
    if (!this.voz.activa() || this.voz.asistenteEnPagina()) return;
    const primera = !this.voz.saludada;
    const texto = this.textoDeEntrada();
    if (await this.voz.intentar(primera ? `${SALUDO} ${texto}` : texto)) {
      this.voz.saludada = true;
      this.pendiente = false;
      await this.ofrecerMenu();
    } else {
      this.pendiente = true;
    }
  }

  private async esperarFinDeVoz(): Promise<void> {
    const limite = Date.now() + 30_000;
    while (this.voz.hablando() && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  /**
   * Después de leer una pantalla que no es el menú ni tiene asistente, pregunta si quiere volver al menú principal: así
   * quien no ve nunca queda perdido. Si dice que no, se queda y se lo vuelve a ofrecer con el siguiente toque.
   */
  private async ofrecerMenu(): Promise<void> {
    if (
      !this.voz.activa() ||
      this.voz.asistenteEnPagina() ||
      !this.reconocimiento.soportado ||
      this.router.url.split('?')[0] === '/'
    ) {
      return;
    }
    await this.esperarFinDeVoz();
    await this.voz.decir(
      '¿Quiere volver al menú principal? Diga sí para volver, o no para quedarse en esta pantalla.',
    );
    const r = await this.reconocimiento.escuchar(8000);
    const respuesta = r.ok ? interpretarSiNo(r.texto) : null;
    if (respuesta === 'si') {
      this.menuPendiente = false;
      await this.router.navigateByUrl('/');
    } else {
      this.menuPendiente = true;
      if (respuesta === 'no') {
        await this.voz.decir(
          'De acuerdo, me quedo aquí. Cuando quiera volver al menú, toque la pantalla.',
        );
      }
    }
  }

  /** Pregunta en voz alta si necesita la lectura y escucha la respuesta («sí» o «no»). Los botones también responden. */
  private async preguntar(): Promise<void> {
    if (this.preguntando || this.voz.decidida()) return;
    this.preguntando = true;
    try {
      await this.voz.decir(PREGUNTA_INICIAL);
      await this.escucharRespuesta();
    } finally {
      this.preguntando = false;
    }
  }

  private async escucharRespuesta(): Promise<void> {
    for (let intento = 0; intento < 2 && !this.voz.decidida(); intento++) {
      if (!this.reconocimiento.soportado) break;
      const r = await this.reconocimiento.escuchar(8000);
      if (this.voz.decidida()) return;
      const respuesta = r.ok ? primeraInterpretacion(r.alternativas, interpretarSiNo) : null;
      if (respuesta) {
        this.responder(respuesta === 'si');
        return;
      }
      // Si el problema es el micrófono (permiso, internet…), se le dice cuál es: no es que «no le entendí».
      if (!r.ok && r.motivo !== 'sin-voz') {
        await this.voz.decir(MENSAJES_FALLO[r.motivo]);
        break;
      }
      if (intento === 0) await this.voz.decir('No le entendí. Diga sí o no.');
    }
    if (!this.voz.decidida()) {
      await this.voz.decir(
        'Si necesita que le leamos el formulario, toque el botón de arriba. Si no lo necesita, toque el botón de abajo.',
      );
    }
  }

  /** La persona respondió (hablando o con los botones). Sí: sigue la lectura y el asistente. No: queda todo manual. */
  protected responder(necesita: boolean): void {
    this.reconocimiento.cancelar();
    this.voz.detener();
    this.voz.fijar(necesita);
    if (!necesita) return;
    this.voz.saludada = true;
    this.voz.gestoHecho = true;
    this.voz.asistenteSolicitado.set(true);
    // Fuera de la preinscripción no hay asistente: se le lee la pantalla donde está.
    setTimeout(() => {
      if (!this.voz.asistenteEnPagina()) {
        void this.voz
          .decir('Perfecto. Le iré leyendo cada pantalla.')
          .then(() => this.voz.hablar(this.textoDeEntrada(), true));
      }
    }, 150);
  }

  private principal(): HTMLElement | null {
    return this.raiz.nativeElement.ownerDocument.querySelector('main');
  }

  protected alEnfocar(e: FocusEvent): void {
    if (!this.voz.activa() || this.voz.asistenteEnPagina() || !(e.target instanceof HTMLElement)) {
      return;
    }
    const objetivo = e.target;
    if (objetivo.closest('main') || this.raiz.nativeElement.contains(objetivo)) {
      // Durante la presentación lo enfocado se dice a continuación, para no cortarla.
      this.voz.hablar(describirControl(objetivo), this.voz.saludando());
    }
  }

  /**
   * El primer toque o tecla es el permiso que el navegador pide para hablar: ahí se dice lo pendiente. Los toques sobre
   * los botones no cuentan (son la respuesta), para que quien explora la pantalla sin ver no conteste sin querer.
   */
  protected primerContacto(e?: Event): void {
    if (e?.target instanceof Element && e.target.closest('button, a, input, select, textarea'))
      return;
    this.voz.gestoHecho = true;
    if (!this.voz.decidida()) {
      if (!this.preguntando && (this.pendiente || !this.voz.hablando())) {
        this.pendiente = false;
        void this.preguntar();
      }
      return;
    }
    if (!this.voz.activa() || this.voz.asistenteEnPagina()) return;
    if (this.pendiente || !this.voz.saludada) {
      this.pendiente = false;
      if (!this.voz.saludada) this.voz.saludar(this.textoDeEntrada());
      else this.voz.hablar(this.textoDeEntrada());
      void this.ofrecerMenu();
    } else if (this.menuPendiente) {
      this.menuPendiente = false;
      void this.ofrecerMenu();
    }
  }

  protected alTeclear(e: KeyboardEvent): void {
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      if (!this.voz.decidida()) this.responder(true);
      else this.voz.alternar();
      return;
    }
    this.primerContacto();
  }
}
