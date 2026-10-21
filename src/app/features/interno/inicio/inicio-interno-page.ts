import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PERMISO } from '../../../core/auth/modelos';
import { Sesion } from '../../../core/auth/sesion';
import { AsignacionApi } from '../asignacion/asignacion-api';
import { Alerta } from '../asignacion/modelos-asignacion';

@Component({
  selector: 'app-inicio-interno-page',
  imports: [DatePipe, RouterLink],
  templateUrl: './inicio-interno-page.html',
  styleUrl: './inicio-interno-page.scss',
})
export class InicioInternoPage implements OnInit {
  private readonly api = inject(AsignacionApi);
  protected readonly sesion = inject(Sesion);
  protected readonly PERMISO = PERMISO;
  /** Avisos dirigidos al rol de la persona (por ejemplo, un cupo liberado para el asignador). */
  protected readonly alertas = signal<Alerta[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.alertas.set(await firstValueFrom(this.api.alertas()));
    } catch {
      this.alertas.set([]);
    }
  }

  protected async atender(a: Alerta): Promise<void> {
    try {
      await firstValueFrom(this.api.atenderAlerta(a.id));
      this.alertas.set(this.alertas().filter((x) => x.id !== a.id));
    } catch {
      // Si no se pudo marcar, el aviso sigue a la vista.
    }
  }
}
