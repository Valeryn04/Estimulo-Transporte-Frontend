import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LockupDependencia } from '../../../../shared/lockup-dependencia/lockup-dependencia';

/** Marco de las pantallas de acceso del portal interno (ingreso y manejo de contraseña). */
@Component({
  selector: 'app-acceso-shell',
  imports: [RouterOutlet, LockupDependencia],
  templateUrl: './acceso-shell.html',
  styleUrl: './acceso-shell.scss',
})
export class AccesoShell {}
