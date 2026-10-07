import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Icono } from '../../../../shared/icono/icono';
import { ConfigApi } from '../config/config-api';
import { PlantillaResumen } from '../config/modelos-config';

/** Plantillas de correo del programa (RF-COM-02): lista de las plantillas editables. */
@Component({
  selector: 'app-plantillas-page',
  imports: [DatePipe, RouterLink, Icono],
  templateUrl: './plantillas-page.html',
  styleUrl: './plantillas-page.scss',
})
export class PlantillasPage implements OnInit {
  private readonly api = inject(ConfigApi);

  protected readonly plantillas = signal<PlantillaResumen[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.plantillas.set(await firstValueFrom(this.api.plantillas()));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar las plantillas.');
    } finally {
      this.cargando.set(false);
    }
  }
}
