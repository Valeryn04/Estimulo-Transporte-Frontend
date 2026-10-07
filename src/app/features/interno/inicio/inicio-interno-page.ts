import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISO } from '../../../core/auth/modelos';
import { Sesion } from '../../../core/auth/sesion';

@Component({
  selector: 'app-inicio-interno-page',
  imports: [RouterLink],
  templateUrl: './inicio-interno-page.html',
  styleUrl: './inicio-interno-page.scss',
})
export class InicioInternoPage {
  protected readonly sesion = inject(Sesion);
  protected readonly PERMISO = PERMISO;
}
