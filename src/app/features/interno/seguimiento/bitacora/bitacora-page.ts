import { DatePipe, JsonPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { SeguimientoApi, descargar } from '../seguimiento-api';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { PaginaBitacora } from '../modelos-seguimiento';

/**
 * Bitácora de auditoría (RF-SEG-01): quién hizo qué y cuándo, con filtros por expediente, usuario, módulo, acción y
 * fechas. La bitácora no se puede editar ni borrar; consultarla también deja constancia.
 */
@Component({
  selector: 'app-bitacora-page',
  imports: [DatePipe, JsonPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './bitacora-page.html',
  styleUrl: './bitacora-page.scss',
})
export class BitacoraPage implements OnInit {
  private readonly api = inject(SeguimientoApi);
  private readonly sesion = inject(Sesion);
  protected readonly puedeExportar = computed(() => this.sesion.tiene(PERMISO.reportesExportar));
  protected readonly exportando = signal(false);

  protected readonly datos = signal<PaginaBitacora | null>(null);
  protected readonly modulos = signal<string[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly pagina = signal(1);
  protected readonly tamano = 25;
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil((this.datos()?.total ?? 0) / this.tamano)),
  );

  protected readonly filtros = new FormGroup({
    radicado: new FormControl('', { nonNullable: true }),
    usuario: new FormControl('', { nonNullable: true }),
    modulo: new FormControl('', { nonNullable: true }),
    accion: new FormControl('', { nonNullable: true }),
    desde: new FormControl('', { nonNullable: true }),
    hasta: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    void this.cargarModulos();
    void this.buscar();
  }

  private async cargarModulos(): Promise<void> {
    try {
      this.modulos.set(await firstValueFrom(this.api.modulosBitacora()));
    } catch {
      this.modulos.set([]);
    }
  }

  protected async buscar(pagina = 1): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.pagina.set(pagina);
    const f = this.filtros.getRawValue();
    try {
      this.datos.set(
        await firstValueFrom(
          this.api.bitacora({
            radicado: f.radicado.trim() || undefined,
            usuario: f.usuario.trim() || undefined,
            modulo: f.modulo || undefined,
            accion: f.accion.trim() || undefined,
            desde: f.desde || undefined,
            hasta: f.hasta || undefined,
            pagina,
            tamano: this.tamano,
          }),
        ),
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos consultar la bitácora.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Exporta la bitácora con los mismos filtros que se ven en pantalla. */
  protected async exportar(formato: 'XLSX' | 'PDF'): Promise<void> {
    this.exportando.set(true);
    this.error.set('');
    const f = this.filtros.getRawValue();
    try {
      const archivo = await firstValueFrom(
        this.api.exportarBitacora(formato, {
          radicado: f.radicado.trim() || undefined,
          usuario: f.usuario.trim() || undefined,
          modulo: f.modulo || undefined,
          accion: f.accion.trim() || undefined,
          desde: f.desde || undefined,
          hasta: f.hasta || undefined,
        }),
      );
      descargar(
        archivo,
        `bitacora-${new Date().toISOString().slice(0, 10)}.${formato === 'XLSX' ? 'xlsx' : 'pdf'}`,
      );
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos exportar la bitácora.');
    } finally {
      this.exportando.set(false);
    }
  }

  protected limpiar(): void {
    this.filtros.reset();
    void this.buscar();
  }

  protected tieneValores(e: { anterior: unknown; nuevo: unknown; detalle: unknown }): boolean {
    return e.anterior !== null || e.nuevo !== null || this.detalleUtil(e.detalle);
  }

  protected detalleUtil(d: unknown): boolean {
    return d !== null && typeof d === 'object' && Object.keys(d).length > 0;
  }
}
