import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

/** Confirmación después de enviar la preinscripción: explica el siguiente paso (verificar el correo). */
@Component({
  selector: 'app-enviada-page',
  imports: [RouterLink],
  templateUrl: './enviada-page.html',
  styleUrl: './enviada-page.scss',
})
export class EnviadaPage {
  private readonly router = inject(Router);
  // El estado de navegación solo existe si la persona llegó desde el formulario.
  private readonly estado = this.router.getCurrentNavigation()?.extras.state as
    { correo?: string; horas?: number } | undefined;

  protected readonly correo = this.estado?.correo ?? null;
  protected readonly horas = this.estado?.horas ?? null;
}
