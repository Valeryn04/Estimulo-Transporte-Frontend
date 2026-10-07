// Configuración de PRODUCCIÓN (es la que usa `ng build` por defecto).
// `apiUrl` vacío = la API se sirve desde el mismo origen (ruta /api/v1). Si la API vive en otro
// subdominio del mismo sitio, escríbalo aquí ANTES de desplegar. No ponga secretos: este archivo
// termina dentro del JavaScript que se descarga en el navegador.
export const environment = {
  production: true,
  apiUrl: '',
};
