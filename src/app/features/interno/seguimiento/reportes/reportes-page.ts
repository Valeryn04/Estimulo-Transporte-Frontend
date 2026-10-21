import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import {
  Exportacion,
  FiltroReporte,
  ListasFiltro,
  Reporte,
  VistaReporte,
} from '../modelos-seguimiento';
import { SeguimientoApi, descargar } from '../seguimiento-api';

/**
 * Reportes del programa (RF-SEG-05 y RF-SEG-06): siete reportes con los mismos filtros, vista previa en pantalla y
 * exportación a Excel o PDF con los filtros en el encabezado. Cada exportación queda en el historial. Quien tiene el
 * permiso también descarga los eventos para tableros de BI (RF-SEG-07).
 */
@Component({
  selector: 'app-reportes-page',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './reportes-page.html',
  styleUrl: './reportes-page.scss',
})
export class ReportesPage implements OnInit {
  private readonly api = inject(SeguimientoApi);
  private readonly sesion = inject(Sesion);

  protected readonly reportes = signal<Reporte[]>([]);
  protected readonly listas = signal<ListasFiltro | null>(null);
  protected readonly vista = signal<VistaReporte | null>(null);
  protected readonly historial = signal<Exportacion[]>([]);
  protected readonly cargando = signal(false);
  protected readonly exportando = signal(false);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');

  protected readonly puedeExportar = computed(() => this.sesion.tiene(PERMISO.reportesExportar));
  protected readonly puedeBi = computed(() => this.sesion.tiene(PERMISO.biConsultar));

  protected readonly filtros = new FormGroup({
    reporte: new FormControl('', { nonNullable: true }),
    vigenciaId: new FormControl('', { nonNullable: true }),
    desde: new FormControl('', { nonNullable: true }),
    hasta: new FormControl('', { nonNullable: true }),
    localidadId: new FormControl('', { nonNullable: true }),
    estado: new FormControl('', { nonNullable: true }),
    poblacion: new FormControl<'' | 'CON_CUIDADOR' | 'SIN_CUIDADOR'>('', { nonNullable: true }),
  });
  protected readonly bi = new FormGroup({
    desde: new FormControl('', { nonNullable: true }),
    hasta: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    void this.cargarCatalogos();
    void this.cargarHistorial();
  }

  private async cargarCatalogos(): Promise<void> {
    try {
      const [reportes, listas] = await Promise.all([
        firstValueFrom(this.api.reportes()),
        firstValueFrom(this.api.listas()),
      ]);
      this.reportes.set(reportes);
      this.listas.set(listas);
      this.filtros.controls.reporte.setValue(reportes[0]?.codigo ?? '');
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los reportes.');
    }
  }

  private async cargarHistorial(): Promise<void> {
    if (!this.puedeExportar()) return;
    try {
      this.historial.set(await firstValueFrom(this.api.exportaciones()));
    } catch {
      this.historial.set([]);
    }
  }

  private filtrosActuales(): FiltroReporte {
    const f = this.filtros.getRawValue();
    return {
      vigenciaId: f.vigenciaId ? Number(f.vigenciaId) : undefined,
      desde: f.desde || undefined,
      hasta: f.hasta || undefined,
      localidadId: f.localidadId ? Number(f.localidadId) : undefined,
      estado: f.estado || undefined,
      poblacion: f.poblacion || undefined,
    };
  }

  protected async consultar(): Promise<void> {
    const codigo = this.filtros.controls.reporte.value;
    if (!codigo) return;
    this.cargando.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      this.vista.set(await firstValueFrom(this.api.vistaPrevia(codigo, this.filtrosActuales())));
    } catch (e) {
      this.vista.set(null);
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos generar el reporte.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected async exportar(formato: 'XLSX' | 'PDF'): Promise<void> {
    const codigo = this.filtros.controls.reporte.value;
    if (!codigo) return;
    this.exportando.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      const archivo = await firstValueFrom(
        this.api.exportar(codigo, formato, this.filtrosActuales()),
      );
      const hoy = new Date().toISOString().slice(0, 10);
      const nombre = `${codigo.toLowerCase()}-${hoy}.${formato === 'XLSX' ? 'xlsx' : 'pdf'}`;
      descargar(archivo, nombre);
      this.mensaje.set(`Se descargó ${nombre}. La exportación quedó registrada en el historial.`);
      await this.cargarHistorial();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos exportar el reporte.');
    } finally {
      this.exportando.set(false);
    }
  }

  protected async descargarBi(): Promise<void> {
    this.exportando.set(true);
    this.error.set('');
    this.mensaje.set('');
    const f = this.bi.getRawValue();
    try {
      const archivo = await firstValueFrom(
        this.api.eventosBiCsv(f.desde || undefined, f.hasta || undefined),
      );
      descargar(archivo, 'eventos-bi.csv');
      this.mensaje.set('Se descargó eventos-bi.csv.');
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos descargar los eventos.');
    } finally {
      this.exportando.set(false);
    }
  }

  protected celda(v: string | number | null): string {
    return v === null ? '' : String(v);
  }
}
