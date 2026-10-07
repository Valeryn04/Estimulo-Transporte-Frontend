import { FormControl } from '@angular/forms';
import { DatosCaracterizacion } from '../../../core/publico/caracterizacion-api';
import {
  CAMPOS,
  aplicarDependencias,
  camposCambiados,
  celularValido,
  correoValido,
  fechaNacimientoValida,
  fijoValido,
  nombreValido,
  normalizarTelefono,
  textoONulo,
} from './caracterizacion-datos';

const vacios = (): DatosCaracterizacion =>
  Object.fromEntries(CAMPOS.map((c) => [c, null])) as unknown as DatosCaracterizacion;

describe('caracterizacion-datos', () => {
  describe('normalizarTelefono', () => {
    it('deja solo los dígitos y quita el indicativo del país', () => {
      expect(normalizarTelefono('+57 (300) 123-4567')).toBe('3001234567');
      expect(normalizarTelefono('300 123 4567')).toBe('3001234567');
      expect(normalizarTelefono('605 123 4567')).toBe('6051234567');
      expect(normalizarTelefono('abc')).toBe('');
    });
  });

  describe('textoONulo', () => {
    it('quita espacios sobrantes y trata el texto vacío como sin dato', () => {
      expect(textoONulo('  Colombia   Mayor ')).toBe('Colombia Mayor');
      expect(textoONulo('   ')).toBeNull();
      expect(textoONulo(null)).toBeNull();
    });
  });

  describe('aplicarDependencias (igual que el servidor)', () => {
    it('sin hijos se borran la cantidad y las edades; con hijos hay una edad por hijo', () => {
      expect(
        aplicarDependencias({
          ...vacios(),
          tieneHijos: false,
          hijosCantidad: 2,
          hijosEdades: [3, 4],
        }),
      ).toMatchObject({ hijosCantidad: null, hijosEdades: null });
      expect(
        aplicarDependencias({ ...vacios(), tieneHijos: true, hijosCantidad: 3, hijosEdades: [7] })
          .hijosEdades,
      ).toEqual([7, null, null]);
      expect(
        aplicarDependencias({
          ...vacios(),
          tieneHijos: true,
          hijosCantidad: 1,
          hijosEdades: [7, 9],
        }).hijosEdades,
      ).toEqual([7]);
    });

    it('la gestación y el subsidio solo se conservan si aplican', () => {
      const d = aplicarDependencias({
        ...vacios(),
        embarazo: 'NO',
        semanasGestacion: 12,
        recibeSubsidios: false,
        subsidioCual: 'Colombia Mayor',
      });
      expect(d.semanasGestacion).toBeNull();
      expect(d.subsidioCual).toBeNull();
      const si = aplicarDependencias({ ...vacios(), embarazo: 'SI', semanasGestacion: 12 });
      expect(si.semanasGestacion).toBe(12);
    });

    it('sin cuidador se borran sus datos', () => {
      const d = aplicarDependencias({
        ...vacios(),
        requiereCuidador: false,
        cuidadorCelular: '3001112222',
        cuidadorCorreo: 'a@b.co',
      });
      expect(d.cuidadorCelular).toBeNull();
      expect(d.cuidadorCorreo).toBeNull();
    });
  });

  describe('camposCambiados', () => {
    it('devuelve solo lo que cambió y se puede enviar', () => {
      const guardado = { ...vacios(), celular: '3001112222' };
      const actual = { ...vacios(), celular: '3009998888', generoId: 1, telefonoFijo: '123' };
      const enviables = new Set<string>(['celular', 'generoId']);
      expect(camposCambiados(actual, guardado, enviables)).toEqual(
        ['generoId', 'celular'].sort(
          (a, b) => CAMPOS.indexOf(a as never) - CAMPOS.indexOf(b as never),
        ),
      );
    });

    it('compara también las listas de edades', () => {
      const guardado = { ...vacios(), tieneHijos: true, hijosCantidad: 2, hijosEdades: [3, null] };
      const igual = { ...guardado, hijosEdades: [3, null] };
      const otro = { ...guardado, hijosEdades: [3, 5] };
      const enviables = new Set<string>(CAMPOS);
      expect(camposCambiados(igual, guardado, enviables)).toEqual([]);
      expect(camposCambiados(otro, guardado, enviables)).toEqual(['hijosEdades']);
    });
  });

  describe('validadores', () => {
    const valido = (v: (c: FormControl) => unknown, valor: string | null) =>
      v(new FormControl(valor)) === null;

    it('celular: 10 dígitos que empiezan por 3, con o sin indicativo', () => {
      expect(valido(celularValido, '300 123 4567')).toBe(true);
      expect(valido(celularValido, '+57 3001234567')).toBe(true);
      expect(valido(celularValido, '2001234567')).toBe(false);
      expect(valido(celularValido, '300123')).toBe(false);
      expect(valido(celularValido, '')).toBe(true);
    });

    it('teléfono fijo: 7 dígitos o 10 con indicativo 60', () => {
      expect(valido(fijoValido, '3456789')).toBe(true);
      expect(valido(fijoValido, '605 345 6789')).toBe(true);
      expect(valido(fijoValido, '34567')).toBe(false);
      expect(valido(fijoValido, '3001234567')).toBe(false);
    });

    it('correo: exige usuario, arroba y dominio con punto', () => {
      expect(valido(correoValido, 'carlos@correo.com')).toBe(true);
      expect(valido(correoValido, 'carlos@correo')).toBe(false);
      expect(valido(correoValido, 'carlos')).toBe(false);
    });

    it('nombre: solo letras, espacios, punto, apóstrofo y guion', () => {
      expect(valido(nombreValido, "María-José O'Brien Jr.")).toBe(true);
      expect(valido(nombreValido, 'Maria 123')).toBe(false);
    });

    it('fecha de nacimiento: válida, no futura y posterior a 1900', () => {
      expect(valido(fechaNacimientoValida, '1985-04-12')).toBe(true);
      expect(valido(fechaNacimientoValida, '2999-01-01')).toBe(false);
      expect(valido(fechaNacimientoValida, '1850-01-01')).toBe(false);
      expect(valido(fechaNacimientoValida, '12/04/1985')).toBe(false);
      expect(valido(fechaNacimientoValida, '')).toBe(true);
    });
  });
});
