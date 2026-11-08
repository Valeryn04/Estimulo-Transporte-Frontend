import { Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { LecturaVoz, describirControl, textoDePagina, textoVisible } from './lectura-voz';

/**
 * Barra de lectura en voz alta del portal ciudadano. Es lo primero que se alcanza con Tab. Activada, dice el nombre
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
  },
})
export class LecturaVozBarra implements OnInit {
  protected readonly voz = inject(LecturaVoz);
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);
  private readonly raiz = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    // Al cambiar de pantalla se dice su título, para quien no ve qué pasó.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe(() => {
        setTimeout(() => {
          if (!this.voz.activa()) return;
          const h1 = this.principal()?.querySelector('h1');
          const titulo = h1 ? textoVisible(h1) : '';
          if (titulo) this.voz.hablar(titulo);
        }, 400);
      });
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

  private principal(): HTMLElement | null {
    return this.raiz.nativeElement.ownerDocument.querySelector('main');
  }

  protected alEnfocar(e: FocusEvent): void {
    if (!this.voz.activa() || !(e.target instanceof HTMLElement)) return;
    const objetivo = e.target;
    if (objetivo.closest('main') || this.raiz.nativeElement.contains(objetivo)) {
      this.voz.hablar(describirControl(objetivo));
    }
  }

  protected alTeclear(e: KeyboardEvent): void {
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      this.voz.alternar();
    }
  }

  protected leerPagina(): void {
    const principal = this.principal();
    if (!principal) return;
    this.voz.hablar(textoDePagina(principal));
  }
}
