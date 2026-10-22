import { Component, ElementRef, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Sesion } from '../../../../core/auth/sesion';
import { Icono } from '../../../../shared/icono/icono';
import { Confirmar } from '../../../../shared/alertas/confirmar';

/**
 * Persona que tiene la sesión abierta, en el encabezado: un botón con su nombre que despliega un panel con
 * sus datos y las opciones de la cuenta (cambiar contraseña y cerrar sesión). Se cierra con Escape, al
 * hacer clic fuera, al elegir una opción o cuando el foco sale del panel.
 */
@Component({
  selector: 'app-menu-usuario',
  imports: [Confirmar, RouterLink, Icono],
  templateUrl: './menu-usuario.html',
  styleUrl: './menu-usuario.scss',
  host: {
    '(document:click)': 'clicFuera($event)',
    '(keydown.escape)': 'cerrar(true)',
    '(focusout)': 'focoFuera($event)',
  },
})
export class MenuUsuario {
  private readonly sesion = inject(Sesion);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly cerrarSesion = output<void>();

  protected readonly abierto = signal(false);
  protected readonly perfil = this.sesion.perfil;
  protected readonly roles = computed(
    () =>
      this.perfil()
        ?.roles.map((r) => r.nombre)
        .join(', ') || 'Sin rol activo',
  );
  protected readonly iniciales = computed(() => {
    const palabras = (this.perfil()?.nombres ?? '').split(/\s+/).filter(Boolean);
    return ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase() || '?';
  });

  protected alternar(): void {
    this.abierto.update((a) => !a);
  }

  protected cerrar(devolverFoco = false): void {
    if (!this.abierto()) return;
    this.abierto.set(false);
    if (devolverFoco) this.raiz.nativeElement.querySelector<HTMLElement>('.disparador')?.focus();
  }

  protected clicFuera(evento: Event): void {
    if (!this.raiz.nativeElement.contains(evento.target as Node)) this.abierto.set(false);
  }

  protected focoFuera(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (destino && !this.raiz.nativeElement.contains(destino)) this.abierto.set(false);
  }

  protected salir(): void {
    this.abierto.set(false);
    this.cerrarSesion.emit();
  }
}
