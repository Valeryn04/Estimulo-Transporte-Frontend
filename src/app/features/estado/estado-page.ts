import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';
import { EstadoServicio, SaludService } from '../../core/salud/salud.service';

type Resultado = { cargando: true } | { cargando: false; ok: boolean; detalle: string };

/** Estado del servicio y de la base de datos, consultado en vivo a la API (RNF-08, monitoreo). */
@Component({
  selector: 'app-estado-page',
  templateUrl: './estado-page.html',
  styleUrl: './estado-page.scss',
})
export class EstadoPage {
  private readonly salud = inject(SaludService);

  protected readonly resultado = toSignal(
    this.salud.consultar().pipe(
      map((e: EstadoServicio): Resultado => ({
        cargando: false,
        ok: e.estado === 'ok',
        detalle:
          e.baseDeDatos === 'ok' ? 'Base de datos conectada' : 'Sin conexión a la base de datos',
      })),
      catchError(() =>
        of<Resultado>({ cargando: false, ok: false, detalle: 'No hay conexión con la API' }),
      ),
      startWith<Resultado>({ cargando: true }),
    ),
    { requireSync: true },
  );
}
