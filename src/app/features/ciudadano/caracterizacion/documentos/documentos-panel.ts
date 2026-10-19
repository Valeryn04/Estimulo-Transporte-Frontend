import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import {
  CaracterizacionApi,
  DocumentoSolicitud,
  DocumentosSolicitud,
  FormatoArchivo,
} from '../../../../core/publico/caracterizacion-api';
import { Icono } from '../../../../shared/icono/icono';
import { reducirImagen, tamanoLegible } from '../../../../shared/imagen';

const NOMBRE_GRUPO: Record<DocumentoSolicitud['aplicaA'], string> = {
  PCD: 'Documentos de la persona con discapacidad',
  CUIDADOR: 'Documentos del cuidador o asistente personal',
  COMUN: 'Carta de solicitud (firmada por la persona con discapacidad y por el cuidador)',
};

const ESTADO: Record<DocumentoSolicitud['estado'], string> = {
  PENDIENTE: 'Pendiente',
  CARGADO: 'Cargado',
  RECHAZADO: 'Rechazado',
};

const EXTENSIONES: Record<FormatoArchivo, string[]> = {
  pdf: ['pdf'],
  jpg: ['jpg', 'jpeg'],
  png: ['png'],
};

/**
 * Carga de documentos soporte (RF-CAR-03): lista lo que se exige según la parametrización vigente, con el tipo de
 * archivo permitido, el tamaño máximo y el estado de cada documento. Se puede elegir un archivo del equipo o tomar
 * una fotografía desde el teléfono; las fotos muy pesadas se reducen solas antes de enviarlas.
 */
@Component({
  selector: 'app-documentos-panel',
  imports: [DatePipe, Icono],
  templateUrl: './documentos-panel.html',
  styleUrl: './documentos-panel.scss',
})
export class DocumentosPanel implements OnInit {
  private readonly api = inject(CaracterizacionApi);

  readonly editable = input.required<boolean>();

  /** Con una subsanación vigente solo se pueden cargar los documentos señalados. */
  protected puedeCargar(doc: { id: number }): boolean {
    const lista = this.datos()?.documentosEditables;
    return this.editable() && (lista === null || lista === undefined || lista.includes(doc.id));
  }
  /** Avisa cada vez que cambia la lista de documentos, para que la pantalla actualice su resumen. */
  readonly actualizado = output<DocumentosSolicitud>();

  protected readonly datos = signal<DocumentosSolicitud | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  /** Avance del envío (0–100) de cada documento que se está subiendo. */
  protected readonly subiendo = signal<Record<number, number>>({});
  protected readonly errores = signal<Record<number, string>>({});
  protected readonly mensajes = signal<Record<number, string>>({});
  protected readonly tactil = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  protected readonly ESTADO = ESTADO;

  protected readonly grupos = computed(() => {
    const d = this.datos();
    if (!d) return [];
    return (['PCD', 'CUIDADOR', 'COMUN'] as const)
      .map((clave) => ({
        clave,
        nombre: NOMBRE_GRUPO[clave],
        documentos: d.documentos.filter((x) => x.aplicaA === clave),
      }))
      .filter((g) => g.documentos.length > 0);
  });

  protected readonly formatosTexto = computed(() => {
    const f = this.datos()?.reglas.formatos ?? [];
    const m = f.map((x) => x.toUpperCase());
    return m.length <= 1 ? m.join('') : `${m.slice(0, -1).join(', ')} o ${m.at(-1)}`;
  });

  protected readonly accept = computed(() =>
    (this.datos()?.reglas.formatos ?? [])
      .map((f) => EXTENSIONES[f].map((e) => `.${e}`).join(','))
      .join(','),
  );

  protected readonly porcentaje = computed(() => {
    const r = this.datos()?.resumen;
    return r && r.obligatorios > 0 ? Math.round((r.cargados / r.obligatorios) * 100) : 0;
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.poner(await firstValueFrom(this.api.documentos()));
    } catch (e) {
      this.error.set(
        e instanceof ApiError ? e.message : 'No pudimos cargar la lista de documentos.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  private poner(d: DocumentosSolicitud): void {
    this.datos.set(d);
    this.actualizado.emit(d);
  }

  private fijar<T>(
    señal: { update: (f: (v: Record<number, T>) => Record<number, T>) => void },
    id: number,
    valor: T | null,
  ): void {
    señal.update((v) => {
      const { [id]: _anterior, ...resto } = v;
      void _anterior;
      return valor === null ? resto : { ...resto, [id]: valor };
    });
  }

  /** Revisa en el equipo lo mismo que revisa el servidor, para avisar de inmediato qué corregir. */
  private revisar(archivo: File, d: DocumentosSolicitud): string | null {
    if (archivo.size === 0) return 'El archivo está vacío. Seleccione otro.';
    const ext = /\.([A-Za-z0-9]+)$/.exec(archivo.name)?.[1]?.toLowerCase() ?? '';
    const permitidas = d.reglas.formatos.flatMap((f) => EXTENSIONES[f]);
    if (!permitidas.includes(ext)) {
      return `El formato no es válido. Solo se aceptan archivos ${this.formatosTexto()}.`;
    }
    const max = d.reglas.maxMb * 1_048_576;
    if (archivo.size > max) {
      return `El archivo pesa ${tamanoLegible(archivo.size)} y el máximo permitido es ${d.reglas.maxMb} MB. Reduzca su tamaño o tome la foto con menor calidad.`;
    }
    return null;
  }

  protected async elegir(doc: DocumentoSolicitud, evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const original = input.files?.[0];
    input.value = ''; // permite elegir de nuevo el mismo archivo
    if (!original) return;
    await this.subir(doc, original);
  }

  protected async subir(doc: DocumentoSolicitud, original: File): Promise<void> {
    const reglas = this.datos();
    if (!reglas) return;
    this.fijar(this.errores, doc.id, null);
    this.fijar(this.mensajes, doc.id, null);
    // Las fotos pesadas se reducen solas; los demás archivos se revisan tal cual.
    const archivo = await reducirImagen(original, reglas.reglas.maxMb * 1_048_576);
    const problema = this.revisar(archivo, reglas);
    if (problema) {
      this.fijar(this.errores, doc.id, problema);
      return;
    }
    this.fijar(this.subiendo, doc.id, 0);
    try {
      await firstValueFrom(
        this.api.subirDocumento(doc.id, archivo, (p) => this.fijar(this.subiendo, doc.id, p)),
      );
      this.fijar(this.mensajes, doc.id, `Se cargó «${archivo.name}».`);
      this.poner(await firstValueFrom(this.api.documentos()));
    } catch (e) {
      const texto =
        e instanceof ApiError
          ? e.errores.length > 0
            ? e.errores.map((x) => x.mensaje).join(' ')
            : e.message
          : 'No pudimos cargar el archivo. Intente de nuevo.';
      this.fijar(this.errores, doc.id, texto);
    } finally {
      this.fijar(this.subiendo, doc.id, null);
    }
  }

  /** La persona descarga el archivo que cargó, para comprobar que es el correcto. */
  protected async descargar(doc: DocumentoSolicitud): Promise<void> {
    try {
      const blob = await firstValueFrom(this.api.descargarDocumento(doc.id));
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = doc.archivo?.nombre ?? 'documento';
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      this.fijar(
        this.errores,
        doc.id,
        e instanceof ApiError ? e.message : 'No pudimos descargar el archivo.',
      );
    }
  }

  protected modelo(doc: DocumentoSolicitud): string {
    return this.api.urlModelo(doc.id);
  }

  protected tamano(bytes: number): string {
    return tamanoLegible(bytes);
  }

  protected huella(sha: string): string {
    return sha.slice(0, 12);
  }
}
