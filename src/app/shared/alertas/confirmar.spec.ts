import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { esperarTareas } from '../../testing/asentar';
import { AlertasPrueba } from '../../testing/alertas';
import { Alertas } from './alertas';
import { Confirmar } from './confirmar';

@Component({
  imports: [Confirmar],
  template: `
    <button
      type="button"
      appConfirmar="¿Seguro?"
      confirmarTexto="Detalle"
      (click)="veces = veces + 1"
    >
      Hacer
    </button>
  `,
})
class Anfitrion {
  veces = 0;
}

describe('Confirmar', () => {
  function montar(respuesta: boolean) {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const alertas = TestBed.inject(Alertas) as AlertasPrueba;
    alertas.respuesta = respuesta;
    return {
      alertas,
      anfitrion: fixture.componentInstance,
      boton: fixture.nativeElement.querySelector('button') as HTMLButtonElement,
    };
  }

  it('pregunta primero y, si la persona confirma, ejecuta la acción', async () => {
    const { alertas, anfitrion, boton } = montar(true);
    boton.click();
    expect(anfitrion.veces).toBe(0);
    await esperarTareas();
    expect(alertas.preguntas[0]).toMatchObject({ titulo: '¿Seguro?', texto: 'Detalle' });
    expect(anfitrion.veces).toBe(1);
  });

  it('si la persona no confirma, no pasa nada', async () => {
    const { anfitrion, boton } = montar(false);
    boton.click();
    await esperarTareas();
    expect(anfitrion.veces).toBe(0);
  });
});
