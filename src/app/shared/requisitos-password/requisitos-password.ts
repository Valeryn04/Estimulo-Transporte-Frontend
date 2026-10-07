import { Component, computed, input } from '@angular/core';
import { requisitosPassword } from './politica-password';

/** Lista de requisitos de la contraseña que se marca en vivo mientras se escribe. */
@Component({
  selector: 'app-requisitos-password',
  templateUrl: './requisitos-password.html',
  styleUrl: './requisitos-password.scss',
})
export class RequisitosPassword {
  readonly password = input.required<string>();
  readonly usuario = input<string>('');
  protected readonly requisitos = computed(() =>
    requisitosPassword(this.password(), this.usuario()),
  );
}
