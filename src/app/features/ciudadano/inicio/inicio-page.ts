import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModoAccesible } from '../../../shared/accesibilidad/modo-accesible';

@Component({
  selector: 'app-inicio-page',
  imports: [RouterLink],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
})
export class InicioPage {
  protected readonly modo = inject(ModoAccesible);
}
