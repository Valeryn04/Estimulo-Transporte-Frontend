import { Component, computed, input } from '@angular/core';

/** Iconos del portal (trazo de 2 px sobre una rejilla de 24, estilo Feather, licencia MIT). */
const TRAZADOS = {
  editar: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  llave:
    'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  papelera:
    'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M10 11v6 M14 11v6',
  apagar: 'M18.36 6.64a9 9 0 1 1-12.73 0 M12 2v10',
  usuarioX:
    'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M18 8l5 5 M23 8l-5 5',
  usuarioCheck:
    'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M17 11l2 2 4-4',
  usuarioMas:
    'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M20 8v6 M23 11h-6',
  usuario: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  descargar: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  escudo: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  menu: 'M3 12h18 M3 6h18 M3 18h18',
  atras: 'M19 12H5 M12 19l-7-7 7-7',
  adelante: 'M5 12h14 M12 5l7 7-7 7',
  documento:
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  cerrar: 'M18 6L6 18 M6 6l12 12',
  flecha: 'M6 9l6 6 6-6',
  campana: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  check: 'M20 6L9 17l-5-5',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  candado:
    'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4',
} as const;

export type NombreIcono = keyof typeof TRAZADOS;

/** Icono decorativo: el significado lo da el texto del botón o enlace que lo contiene. */
@Component({
  selector: 'app-icono',
  templateUrl: './icono.html',
  styleUrl: './icono.scss',
})
export class Icono {
  readonly nombre = input.required<NombreIcono>();
  protected readonly trazado = computed(() => TRAZADOS[this.nombre()]);
}
