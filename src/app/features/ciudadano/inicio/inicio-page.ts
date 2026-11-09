import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuVoz } from './menu-voz/menu-voz';

@Component({
  selector: 'app-inicio-page',
  imports: [RouterLink, MenuVoz],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
})
export class InicioPage {}
