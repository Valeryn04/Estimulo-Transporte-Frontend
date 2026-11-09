import { montarPantalla } from '../../../testing/config';
import { InicioPage } from './inicio-page';

describe('InicioPage', () => {
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
});
