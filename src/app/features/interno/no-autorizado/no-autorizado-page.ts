import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icono } from '../../../shared/icono/icono';

/**
 * Se muestra cuando la persona intenta abrir una pantalla para la que su rol no tiene permiso, por ejemplo
 * escribiendo la dirección a mano. La API vuelve a validar los permisos en cada llamada: ocultar la
 * pantalla es una cortesía, no la protección.
 */
@Component({
  selector: 'app-no-autorizado-page',
  imports: [RouterLink, Icono],
  templateUrl: './no-autorizado-page.html',
  styleUrl: './no-autorizado-page.scss',
})
export class NoAutorizadoPage {}
