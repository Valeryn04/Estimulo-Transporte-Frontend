import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OrdenLista } from './orden-lista';

@Component({
  imports: [OrdenLista],
  template: `<app-orden-lista
    [elementos]="elementos"
    [nombre]="nombre()"
    [(posicion)]="posicion"
  />`,
})
class Anfitrion {
  elementos = [
    { id: 1, nombre: 'Cédula' },
    { id: 2, nombre: 'Pasaporte' },
    { id: 3, nombre: 'Registro civil' },
  ];
  nombre = signal('Visa');
  posicion = signal<number | null>(2);
}

describe('OrdenLista', () => {
  function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const filas = () =>
      [...el.querySelectorAll('li')].map((f) => f.textContent!.replace(/\s+/g, ' ').trim());
    return { fixture, el, filas };
  }

  it('muestra los demás elementos y el actual resaltado en su posición', () => {
    const { el, filas } = montar();
    const textos = [...el.querySelectorAll('li')].map(
      (f) => `${f.querySelector('.numero')?.textContent} ${f.querySelector('.texto')?.textContent}`,
    );
    expect(textos).toEqual(['1 Cédula', '2 Visa', '3 Pasaporte', '4 Registro civil']);
    expect(filas()).toHaveLength(4);
    expect(el.querySelector('li.actual')?.textContent).toContain('Visa');
  });

  it('sin posición queda al final y con nombre vacío dice «Este elemento»', async () => {
    const { fixture, filas } = montar();
    fixture.componentInstance.posicion.set(null);
    fixture.componentInstance.nombre.set('');
    fixture.detectChanges();
    expect(filas()[3]).toContain('Este elemento');
  });

  it('las flechas mueven una posición y avisan al formulario', () => {
    const { fixture, el } = montar();
    el.querySelector<HTMLButtonElement>('button[title="Bajar una posición"]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.posicion()).toBe(3);
    el.querySelector<HTMLButtonElement>('button[title="Subir una posición"]')!.click();
    el.querySelector<HTMLButtonElement>('button[title="Subir una posición"]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.posicion()).toBe(1);
    expect(
      el.querySelector<HTMLButtonElement>('button[title="Subir una posición"]')!.disabled,
    ).toBe(true);
  });
});
