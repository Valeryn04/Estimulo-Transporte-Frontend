import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Incrustacion } from './core/incrustacion';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  constructor() {
    // Si el portal ciudadano está dentro de la página institucional (iframe), le avisa su alto y sus cambios de pantalla.
    inject(Incrustacion).iniciar();
  }
}
