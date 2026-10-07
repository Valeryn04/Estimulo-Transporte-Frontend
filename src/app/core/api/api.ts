import { environment } from '../../../environments/environment';

/** Base de todas las llamadas a la API versionada. */
export const API_BASE = `${environment.apiUrl}/api/v1`;

/** Cabecera que solo agrega el portal en las llamadas que usan la cookie de sesión (defensa CSRF). */
export const CABECERAS_PORTAL = { 'X-Requested-With': 'estimulo-portal' };
