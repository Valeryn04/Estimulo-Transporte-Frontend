import { TestBed } from '@angular/core/testing';
import { ModoAccesible } from '../../../shared/accesibilidad/modo-accesible';
import { montarPantalla } from '../../../testing/config';
import { InicioPage } from './inicio-page';

describe('InicioPage', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-modo-accesible');
  });

  it('muestra las cinco opciones como enlaces con su nombre y su explicación', async () => {
    const { el, asentar } = montarPantalla(InicioPage);
    await asentar();
    const opciones = [...el.querySelectorAll('a.tarjeta')].map(
      (a) => a.querySelector('.enfasis')?.textContent,
    );
    expect(opciones).toEqual([
      'Preinscribirme',
      'Continuar mi caracterización',
      'Consultar el estado de mi solicitud',
      'Guía paso a paso',
      'No me llegó el correo de verificación',
    ]);
    // Cada enlace lleva su explicación dentro, para que el lector de pantalla la lea con el nombre.
    for (const a of el.querySelectorAll('a.tarjeta'))
      expect(a.querySelector('span')).not.toBeNull();
  });

  it('el enlace a la guía del lector de pantalla aparece solo en el modo accesible', async () => {
    const a = montarPantalla(InicioPage);
    await a.asentar();
    expect(a.el.textContent).not.toContain('Cómo usar el lector de pantalla');
    TestBed.inject(ModoAccesible).fijar(true);
    a.fixture.detectChanges();
    const enlace = [...a.el.querySelectorAll('a')].find((x) =>
      x.textContent?.includes('Cómo usar el lector de pantalla'),
    )!;
    expect(enlace.getAttribute('href')).toBe('/ayuda#lector');
  });
});
