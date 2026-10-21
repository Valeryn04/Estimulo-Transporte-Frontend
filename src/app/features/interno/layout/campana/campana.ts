import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { Icono } from '../../../../shared/icono/icono';
import { AsignacionApi } from '../../asignacion/asignacion-api';
import { Alerta } from '../../asignacion/modelos-asignacion';

const CADA_MINUTO = 60_000;

/**
 * Alertas del rol, junto al nombre de la persona. El contador muestra las que no ha leído; al abrir una alerta (o
 * marcarla) se da por leída y deja de contar.
 */
@Component({
  selector: 'app-campana',
  imports: [DatePipe, Icono],
  templateUrl: './campana.html',
  styleUrl: './campana.scss',
  host: {
    '(document:click)': 'clicFuera($event)',
    '(keydown.escape)': 'abierto.set(false)',
  },
})
export class Campana implements OnInit {
  private readonly api = inject(AsignacionApi);
  private readonly router = inject(Router);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destruir = inject(DestroyRef);

  protected readonly alertas = signal<Alerta[]>([]);
  protected readonly abierto = signal(false);
  protected readonly error = signal('');
  protected readonly cuenta = computed(() => this.alertas().length);

  ngOnInit(): void {
    void this.cargar();
    const reloj = setInterval(() => void this.cargar(), CADA_MINUTO);
    const nav = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => void this.cargar());
    this.destruir.onDestroy(() => {
      clearInterval(reloj);
      nav.unsubscribe();
    });
  }

  private async cargar(): Promise<void> {
    try {
      this.alertas.set(await firstValueFrom(this.api.alertas()));
    } catch {
      // Sin conexión o sin permiso para ver avisos: la campana queda como estaba.
    }
  }

  protected alternar(): void {
    this.abierto.update((a) => !a);
    if (this.abierto()) void this.cargar();
  }

  protected clicFuera(e: Event): void {
    if (!this.raiz.nativeElement.contains(e.target as Node)) this.abierto.set(false);
  }

  private async marcar(a: Alerta): Promise<boolean> {
    try {
      await firstValueFrom(this.api.atenderAlerta(a.id));
      this.alertas.update((l) => l.filter((x) => x.id !== a.id));
      return true;
    } catch {
      this.error.set('No pudimos marcar la alerta como leída. Intente de nuevo.');
      return false;
    }
  }

  /** Abrir la alerta la marca como leída y lleva a donde se atiende. */
  protected async abrir(a: Alerta): Promise<void> {
    this.error.set('');
    if (!(await this.marcar(a))) return;
    this.abierto.set(false);
    if (a.enlace) await this.router.navigateByUrl(a.enlace);
  }

  protected async marcarTodas(): Promise<void> {
    this.error.set('');
    for (const a of [...this.alertas()]) await this.marcar(a);
  }
}
