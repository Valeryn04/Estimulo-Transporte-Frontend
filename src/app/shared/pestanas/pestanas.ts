import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Sesion } from '../../core/auth/sesion';
import { SECCIONES } from './secciones';

/** Pestañas de una sección del portal interno: solo muestra las que el rol puede ver y se oculta si hay una sola. */
@Component({
  selector: 'app-pestanas',
  imports: [RouterLink, RouterLinkActive],
  template: `
    @if (visibles().length > 1) {
      <nav class="pestanas" [attr.aria-label]="titulo()">
        @for (p of visibles(); track p.ruta) {
          <a
            [routerLink]="p.ruta"
            routerLinkActive="activa"
            [routerLinkActiveOptions]="{ exact: esPrefijo(p.ruta) }"
            ariaCurrentWhenActive="page"
            >{{ p.texto }}</a
          >
        }
      </nav>
    }
  `,
})
export class Pestanas {
  private readonly sesion = inject(Sesion);

  readonly seccion = input.required<string>();
  protected readonly titulo = computed(() => SECCIONES[this.seccion()]?.titulo ?? '');
  /** Una pestaña cuya ruta es el inicio de otra solo se marca cuando la dirección coincide exactamente. */
  protected esPrefijo(ruta: string): boolean {
    return (SECCIONES[this.seccion()]?.pestanas ?? []).some((o) => o.ruta.startsWith(`${ruta}/`));
  }

  protected readonly visibles = computed(() =>
    (SECCIONES[this.seccion()]?.pestanas ?? []).filter((p) =>
      this.sesion.tieneAlguno(...p.permisos),
    ),
  );
}
