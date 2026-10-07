import { calcularEdad, hoyIso, sumarDiasIso } from './forms';

describe('fechas en hora de Colombia', () => {
  it('«hoy» es el día de Bogotá aunque en UTC ya sea el día siguiente', () => {
    // 02:30 UTC del 6 de octubre = 21:30 del 5 de octubre en Bogotá (UTC-5)
    expect(hoyIso(new Date('2026-10-06T02:30:00Z'))).toBe('2026-10-05');
    // 05:00 UTC = medianoche en Bogotá: ya es el 6
    expect(hoyIso(new Date('2026-10-06T05:00:00Z'))).toBe('2026-10-06');
    expect(hoyIso(new Date('2026-10-06T04:59:59Z'))).toBe('2026-10-05');
  });

  it('cambia de año a la medianoche de Bogotá, no a la de UTC', () => {
    expect(hoyIso(new Date('2027-01-01T04:59:00Z'))).toBe('2026-12-31');
    expect(hoyIso(new Date('2027-01-01T05:00:00Z'))).toBe('2027-01-01');
  });

  it('suma y resta días sin depender de la zona del dispositivo, incluso entre meses y años', () => {
    expect(sumarDiasIso('2026-10-05', -29)).toBe('2026-09-06');
    expect(sumarDiasIso('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDiasIso('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('la edad se cuenta con el día de Colombia', () => {
    // Cumple 18 el 6 de octubre de 2026; a las 21:30 del día 5 (hora de Bogotá) aún tiene 17.
    expect(calcularEdad('2008-10-06', new Date('2026-10-06T02:30:00Z'))).toBe(17);
    expect(calcularEdad('2008-10-06', new Date('2026-10-06T05:00:00Z'))).toBe(18);
  });
});
