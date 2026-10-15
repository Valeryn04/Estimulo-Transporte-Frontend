import {
  PARTES_VACIAS,
  evaluarDireccion,
  limpiarComplemento,
  partesDeDireccion,
  textoFaltantes,
  type PartesDireccion,
} from './direccion-formato';

const partes = (c: Partial<PartesDireccion>): PartesDireccion => ({ ...PARTES_VACIAS, ...c });

describe('dirección estandarizada', () => {
  it('sin datos no está iniciada ni completa', () => {
    expect(evaluarDireccion(PARTES_VACIAS)).toMatchObject({
      iniciada: false,
      completa: false,
      texto: '',
    });
  });

  it('arma la dirección mínima: tipo de vía, número, cruce y placa', () => {
    const e = evaluarDireccion(partes({ tipo: 'Calle', numero: '72', cruce: '54', placa: '30' }));
    expect(e.completa).toBe(true);
    expect(e.texto).toBe('Calle 72 # 54 - 30');
  });

  it('arma la dirección completa con letras, bis, orientaciones y complemento', () => {
    const e = evaluarDireccion(
      partes({
        tipo: 'Carrera',
        numero: '54',
        letra: 'b',
        bis: 'Bis',
        orientacion: 'Sur',
        cruce: '72',
        cruceLetra: 'A',
        placa: '30',
        placaOrientacion: 'Este',
        complemento: '  Apto   301 Torre 2 ',
      }),
    );
    expect(e.texto).toBe('Carrera 54 B Bis Sur # 72 A - 30 Este, Apto 301 Torre 2');
  });

  it('si empezó y falta algo, dice qué falta y no arma nada', () => {
    const e = evaluarDireccion(partes({ tipo: 'Calle', numero: '72' }));
    expect(e).toMatchObject({ iniciada: true, completa: false, texto: '' });
    expect(e.faltantes).toEqual(['el número del cruce', 'el número de la placa']);
    expect(textoFaltantes(e.faltantes)).toBe('falta el número del cruce y el número de la placa');
    expect(textoFaltantes(['el tipo de vía'])).toBe('falta el tipo de vía');
  });

  it('solo deja números (hasta 3 dígitos), letras válidas y un complemento limpio', () => {
    const e = evaluarDireccion(
      partes({ tipo: 'Vía', numero: '4a0', cruce: '0012', placa: '9999', letra: 'ñ' }),
    );
    expect(e.texto).toBe('Vía 40 # 12 - 999');
    expect(limpiarComplemento('Casa <script>5')).toBe('Casa script5');
    expect(limpiarComplemento('.. #3')).toBe('3');
    expect(limpiarComplemento('x'.repeat(100))).toHaveLength(60);
  });

  it('el cero no es un número válido', () => {
    expect(
      evaluarDireccion(partes({ tipo: 'Calle', numero: '0', cruce: '5', placa: '6' })).completa,
    ).toBe(false);
  });

  it('un tipo de vía que no está en la lista no cuenta', () => {
    expect(
      evaluarDireccion(partes({ tipo: 'Camino', numero: '1', cruce: '2', placa: '3' })).completa,
    ).toBe(false);
  });

  it('lo que arma se puede volver a separar en sus partes', () => {
    const texto = 'Avenida Carrera 46 A Bis Norte # 80 B - 17 Oeste, Casa 5';
    expect(partesDeDireccion(texto)).toEqual({
      tipo: 'Avenida Carrera',
      numero: '46',
      letra: 'A',
      bis: 'Bis',
      orientacion: 'Norte',
      cruce: '80',
      cruceLetra: 'B',
      placa: '17',
      placaOrientacion: 'Oeste',
      complemento: 'Casa 5',
    });
    expect(partesDeDireccion('Calle 72 # 54 - 30')?.tipo).toBe('Calle');
    expect(partesDeDireccion('mi casa por el parque')).toBeNull();
    expect(partesDeDireccion('Camino 3 # 4 - 5')).toBeNull();
  });
});
