import { valorLegible } from './datos-caso';

describe('valorLegible', () => {
  const catalogos = { '7': 'Femenino', '9': 'Sanitas' };

  it('muestra el nombre de las opciones de lista, no su número', () => {
    expect(valorLegible('generoId', { generoId: 7 }, catalogos, false)).toBe('Femenino');
    expect(valorLegible('generoId', { generoId: 99 }, catalogos, false)).toBe('#99');
  });

  it('muestra Sí/No, la fecha en formato día/mes/año y las listas separadas por comas', () => {
    expect(valorLegible('tieneHijos', { tieneHijos: true }, catalogos, false)).toBe('Sí');
    expect(valorLegible('recibeSubsidios', { recibeSubsidios: false }, catalogos, false)).toBe(
      'No',
    );
    expect(
      valorLegible('fechaNacimiento', { fechaNacimiento: '1990-05-03' }, catalogos, false),
    ).toBe('03/05/1990');
    expect(valorLegible('hijosEdades', { hijosEdades: [3, null, 10] }, catalogos, false)).toBe(
      '3, ?, 10',
    );
    expect(valorLegible('embarazo', { embarazo: 'NO_APLICA' }, catalogos, false)).toBe('No aplica');
  });

  it('lo que no se diligenció sale con una raya', () => {
    expect(valorLegible('celular', { celular: null }, catalogos, false)).toBe('—');
    expect(valorLegible('celular', {}, catalogos, false)).toBe('—');
  });

  it('los datos sensibles salen ocultos para quien no tiene permiso', () => {
    expect(valorLegible('epsId', { epsId: 9 }, catalogos, true)).toContain('oculto');
    expect(valorLegible('celular', { celular: '3001234567' }, catalogos, true)).toBe('3001234567');
    expect(valorLegible('epsId', { epsId: 9 }, catalogos, false)).toBe('Sanitas');
  });
});
