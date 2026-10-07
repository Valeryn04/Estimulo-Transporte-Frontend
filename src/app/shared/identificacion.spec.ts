import { FormControl } from '@angular/forms';
import { errorNumero, normalizarNumero, numeroSegunTipo, soloDigitos } from './identificacion';

describe('identificación', () => {
  it('normaliza puntos, espacios y guiones', () => {
    expect(normalizarNumero('1.234 567-8')).toBe('12345678');
    expect(normalizarNumero('ab-123')).toBe('AB123');
  });

  it('valida la longitud y los caracteres según el tipo de documento', () => {
    expect(errorNumero('CC', '1234567')).toBeNull();
    expect(errorNumero('CC', '1234')).toContain('cédula de ciudadanía');
    expect(errorNumero('CC', '12AB567')).not.toBeNull();
    expect(errorNumero('TI', '1045678901')).toBeNull();
    expect(errorNumero('RC', '12345')).not.toBeNull();
    expect(errorNumero('CE', 'X123456A')).toBeNull();
    expect(errorNumero('PT', '123')).not.toBeNull();
    expect(errorNumero(undefined, 'ABC1234')).toBeNull();
  });

  it('solo muestra el teclado numérico en los documentos que solo tienen dígitos', () => {
    expect(soloDigitos('CC')).toBe(true);
    expect(soloDigitos('CE')).toBe(false);
    expect(soloDigitos(undefined)).toBe(false);
  });

  it('el validador usa el tipo vigente en el momento de validar', () => {
    let tipo: string | undefined = 'CC';
    const validador = numeroSegunTipo(() => tipo);
    const c = new FormControl('AB12345');
    expect(validador(c)).toEqual({ numeroIdentificacion: expect.stringContaining('cédula') });
    tipo = 'CE';
    expect(validador(c)).toBeNull();
    expect(validador(new FormControl(''))).toBeNull();
  });
});
