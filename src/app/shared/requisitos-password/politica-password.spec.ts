import { passwordValida, requisitosPassword } from './politica-password';

describe('política de contraseñas (RF-ADM-01)', () => {
  it('marca qué requisitos faltan mientras se escribe', () => {
    const r = requisitosPassword('abc');
    expect(r.filter((x) => x.cumple).map((x) => x.texto)).toEqual(['Una letra minúscula']);
    expect(r.filter((x) => !x.cumple)).toHaveLength(4);
  });

  it('acepta una contraseña que cumple todo', () => {
    expect(passwordValida('Segura#2026x', 'maria')).toBe(true);
  });

  it('exige longitud, mayúscula, minúscula, número y símbolo', () => {
    expect(passwordValida('Corta#1a')).toBe(false);
    expect(passwordValida('sinmayuscula#2026')).toBe(false);
    expect(passwordValida('SINMINUSCULA#2026')).toBe(false);
    expect(passwordValida('SinNumero#Segura')).toBe(false);
    expect(passwordValida('SinSimbolo2026Ab')).toBe(false);
  });

  it('rechaza una contraseña que contiene el nombre de usuario', () => {
    expect(passwordValida('Maria#2026xyz', 'maria')).toBe(false);
    expect(requisitosPassword('Maria#2026xyz', 'maria').at(-1)?.cumple).toBe(false);
  });
});
