import {
  coincidirOpcion,
  deletrear,
  interpretarCorreo,
  interpretarSiNo,
  leerDigitos,
  nombrePropio,
} from './analisis-voz';

describe('análisis de lo que dice la persona', () => {
  describe('interpretarSiNo', () => {
    it('entiende las formas de decir sí', () => {
      for (const t of ['sí', 'Si', 'claro', 'es correcto', 'Sí, claro', 'listo', 'autorizo']) {
        expect(interpretarSiNo(t), t).toBe('si');
      }
    });

    it('entiende las formas de decir no', () => {
      for (const t of ['no', 'No.', 'incorrecto', 'no es correcto', 'negativo']) {
        expect(interpretarSiNo(t), t).toBe('no');
      }
    });

    it('decide la primera palabra que dice sí o no y no inventa una respuesta', () => {
      expect(interpretarSiNo('no, sí es correcto')).toBe('no');
      expect(interpretarSiNo('')).toBeNull();
      expect(interpretarSiNo('mmm no sé qué decir')).toBe('no');
      expect(interpretarSiNo('el cielo es azul')).toBeNull();
    });
  });

  describe('interpretarCorreo', () => {
    it('convierte lo dictado en un correo', () => {
      expect(interpretarCorreo('maria arroba gmail punto com')).toBe('maria@gmail.com');
      expect(interpretarCorreo('María Pérez guion bajo uno dos arroba hotmail punto com')).toBe(
        'mariaperez_12@hotmail.com',
      );
      expect(interpretarCorreo('juan punto lopez arroba correo punto gov punto co')).toBe(
        'juan.lopez@correo.gov.co',
      );
    });

    it('respeta un correo que ya viene escrito, con sus puntos', () => {
      expect(interpretarCorreo('Maria.Perez@Gmail.com')).toBe('maria.perez@gmail.com');
    });

    it('si no parece un correo, no inventa uno', () => {
      expect(interpretarCorreo('hola buenas tardes')).toBeNull();
      expect(interpretarCorreo('maria arroba gmail')).toBeNull();
    });
  });

  it('deletrea un correo para confirmarlo', () => {
    expect(deletrear('ana@gmail.co')).toBe('a, n, a, arroba, g, m, a, i, l, punto, c, o');
    expect(deletrear('a_b-c')).toBe('a, guion bajo, b, guion, c');
  });

  it('lee un número dígito por dígito', () => {
    expect(leerDigitos('1045-678')).toBe('1, 0, 4, 5, 6, 7, 8');
  });

  it('un nombre propio queda con mayúscula inicial y sin números ni símbolos', () => {
    expect(nombrePropio('maría fernanda  pérez 2 !')).toBe('María Fernanda Pérez');
    expect(nombrePropio("o'brien de la hoz")).toBe("O'Brien De La Hoz");
  });

  describe('coincidirOpcion', () => {
    const tipos = [
      { id: 1, nombre: 'Cédula de Ciudadanía', alias: ['cedula', 'cc'] },
      { id: 2, nombre: 'Tarjeta de Identidad', alias: ['tarjeta'] },
      { id: 3, nombre: 'Cédula de Extranjería', alias: ['extranjeria'] },
      { id: 4, nombre: 'Pasaporte' },
    ];

    it('elige por la frase exacta o por un alias', () => {
      expect(coincidirOpcion('Cédula de ciudadanía', tipos)?.id).toBe(1);
      expect(coincidirOpcion('cédula', tipos)?.id).toBe(1);
      expect(coincidirOpcion('tarjeta', tipos)?.id).toBe(2);
    });

    it('elige por palabras en común y distingue las dos cédulas', () => {
      expect(coincidirOpcion('mi cédula de extranjería por favor', tipos)?.id).toBe(3);
      expect(coincidirOpcion('tengo pasaporte', tipos)?.id).toBe(4);
    });

    it('si es ambiguo o no coincide, no elige', () => {
      expect(coincidirOpcion('documento', tipos)).toBeNull();
      expect(coincidirOpcion('', tipos)).toBeNull();
      expect(coincidirOpcion('de', tipos)).toBeNull();
    });
  });
});
