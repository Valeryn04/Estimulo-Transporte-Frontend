import { ayudaPosicion } from './posicion';

describe('ayudaPosicion', () => {
  const base = { total: 5, esNuevo: true, ocupante: null };

  it('explica el campo mientras no hay una posición válida', () => {
    expect(ayudaPosicion({ ...base, posicion: null })).toContain('posición propia');
    expect(ayudaPosicion({ ...base, posicion: 0 })).toContain('posición propia');
  });

  it('avisa quién ocupa la posición y que los demás se corren', () => {
    const texto = ayudaPosicion({ ...base, posicion: 2, ocupante: { id: 7, nombre: 'Cédula' } });
    expect(texto).toContain('La posición 2 la tiene «Cédula»');
    expect(texto).toContain('no se repita');
  });

  it('no avisa nada raro cuando es la posición que ya tiene', () => {
    const texto = ayudaPosicion({
      posicion: 3,
      total: 5,
      esNuevo: false,
      ocupante: { id: 7, nombre: 'Cédula' },
      propioId: 7,
    });
    expect(texto).toContain('posición actual');
  });

  it('un elemento nuevo puede quedar una posición después del último', () => {
    expect(ayudaPosicion({ ...base, posicion: 6 })).toContain('final de la lista (posición 6)');
    expect(ayudaPosicion({ ...base, posicion: 40 })).toContain('(posición 6)');
  });

  it('al editar, la última posición es el total', () => {
    expect(ayudaPosicion({ total: 5, esNuevo: false, ocupante: null, posicion: 9 })).toContain(
      '(posición 5)',
    );
  });
});
