import { Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { LecturaVoz, SALUDO, describirControl, textoConAyuda, textoDePagina } from './lectura-voz';

/** Espera a que la pantalla termine de dibujarse antes de leerla. */
export const RETRASO_ENTRADA = 700;

/**
 * Barra de lectura en voz alta del portal ciudadano. Viene activada de entrada para quien no ve: se presenta sola con
 * el primer toque o tecla, y quien no la necesita la desactiva (queda guardado). Es lo primero que se alcanza con Tab.
 * Activada, dice el nombre
 * de cada campo al enfocarlo, lee los errores y avisos cuando aparecen, dice el título al cambiar de pantalla y puede
 * leer la página completa. Atajo de teclado: Alt + Mayús + L.
 */
@Component({
  selector: 'app-lectura-voz-barra',
  templateUrl: './lectura-voz-barra.html',
  styleUrl: './lectura-voz-barra.scss',
  host: {
    '(document:focusin)': 'alEnfocar($event)',
    '(document:keydown)': 'alTeclear($event)',
    '(document:pointerdown)': 'primerContacto()',
  },
})
export class LecturaVozBarra implements OnInit {
  protected readonly voz = inject(LecturaVoz);
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);
  private readonly raiz = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    // Al entrar y al cambiar de pantalla se lee el título y la introducción, sin que la persona tenga que pedirlo.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe(() => this.programarEntrada());
    this.programarEntrada();
    this.destruir.onDestroy(() => clearTimeout(this.temporizador));
    // Los avisos y errores que aparecen se leen solos.
    const principal = this.principal();
    if (principal && typeof MutationObserver !== 'undefined') {
      const observador = new MutationObserver((cambios) => {
        if (!this.voz.activa()) return;
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
    return [h1 ? textoConAyuda(h1) : '', intro, 'Pulse Tab para recorrer los campos.']
      .filter(Boolean)
      .join(' ');
  }

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  /** Espera a que la pantalla se dibuje; si llega otra pantalla antes, solo se lee la última. */
  private programarEntrada(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.alEntrar(), RETRASO_ENTRADA);
  }

  /** Aún no se pudo hablar solos (el navegador lo bloquea): se hará con el primer toque o tecla. */
  private pendiente = false;

  /** Lee la pantalla al entrar. Si el navegador no deja hablar todavía, queda pendiente para el primer toque. */
  private async alEntrar(): Promise<void> {
    if (!this.voz.activa() || !this.voz.soportado) return;
    const primera = !this.voz.saludada;
    const texto = this.textoDeEntrada();
    const completo = primera ? `${SALUDO} ${texto}` : texto;
    if (await this.voz.intentar(completo)) {
      this.voz.saludada = true;
      this.pendiente = false;
    } else {
      this.pendiente = true;
    }
  }

  private principal(): HTMLElement | null {
    return this.raiz.nativeElement.ownerDocument.querySelector('main');
  }

  protected alEnfocar(e: FocusEvent): void {
    if (!this.voz.activa() || !(e.target instanceof HTMLElement)) return;
    const objetivo = e.target;
    if (objetivo.closest('main') || this.raiz.nativeElement.contains(objetivo)) {
      // Durante la presentación lo enfocado se dice a continuación, para no cortarla.
      this.voz.hablar(describirControl(objetivo), this.voz.saludando());
    }
  }

  /** El primer toque o tecla es el permiso que el navegador pide para hablar. */
  protected primerContacto(): void {
    if (!this.voz.activa()) return;
    if (this.pendiente || !this.voz.saludada) {
      this.pendiente = false;
      if (!this.voz.saludada) this.voz.saludar(this.textoDeEntrada());
      else this.voz.hablar(this.textoDeEntrada());
    }
  }

  protected alTeclear(e: KeyboardEvent): void {
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      this.voz.alternar();
      return;
    }
    this.primerContacto();
  }

  protected leerPagina(): void {
    const principal = this.principal();
    if (!principal) return;
    this.voz.hablar(textoDePagina(principal));
  }
}
