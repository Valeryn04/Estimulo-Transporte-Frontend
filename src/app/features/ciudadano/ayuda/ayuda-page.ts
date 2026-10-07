import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Guía ciudadana en lenguaje claro: preinscripción, caracterización, documentos, radicación y consulta de estado. El
 * texto no promete plazos ni resultados: dice qué se hace en cada paso y qué esperar.
 */
@Component({
  selector: 'app-ayuda-page',
  imports: [RouterLink],
  templateUrl: './ayuda-page.html',
  styleUrl: './ayuda-page.scss',
})
export class AyudaPage {}
