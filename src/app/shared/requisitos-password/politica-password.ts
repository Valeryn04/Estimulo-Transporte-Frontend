export interface Requisito {
  texto: string;
  cumple: boolean;
}

export const PASSWORD_MIN = 10;

/**
 * Política de contraseñas de los funcionarios (RF-ADM-01). Es la misma que valida la API: aquí solo se
 * muestra en vivo para que la persona sepa qué le falta antes de enviar.
 */
export function requisitosPassword(password: string, usuario = ''): Requisito[] {
  const lista: Requisito[] = [
    { texto: `Al menos ${PASSWORD_MIN} caracteres`, cumple: password.length >= PASSWORD_MIN },
    { texto: 'Una letra minúscula', cumple: /[a-z]/.test(password) },
    { texto: 'Una letra mayúscula', cumple: /[A-Z]/.test(password) },
    { texto: 'Un número', cumple: /[0-9]/.test(password) },
    { texto: 'Un símbolo (por ejemplo ! # $ %)', cumple: /[^A-Za-z0-9]/.test(password) },
  ];
  if (usuario.length >= 3) {
    lista.push({
      texto: 'No contiene su nombre de usuario',
      cumple: !password.toLowerCase().includes(usuario.toLowerCase()),
    });
  }
  return lista;
}

export function passwordValida(password: string, usuario = ''): boolean {
  return requisitosPassword(password, usuario).every((r) => r.cumple);
}
