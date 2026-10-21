import { Component, inject } from '@angular/core';
import { PERMISO } from '../../../core/auth/modelos';
import { Sesion } from '../../../core/auth/sesion';
import { TableroPage } from '../seguimiento/tablero/tablero-page';

/** Inicio del portal interno: el tablero de control, para quien tiene permiso de verlo. */
@Component({
  selector: 'app-inicio-interno-page',
  imports: [TableroPage],
  templateUrl: './inicio-interno-page.html',
})
export class InicioInternoPage {
  protected readonly sesion = inject(Sesion);
  protected readonly PERMISO = PERMISO;
}
