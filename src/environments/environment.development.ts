// Configuración de DESARROLLO (`ng serve`): reemplaza a environment.ts mediante "fileReplacements" en
// angular.json. La API corre en el proyecto Estimulo-Transporte-Backend (puerto 3100).
// El servidor se busca en el mismo equipo desde el que se abrió la página: con `localhost` en el computador y
// con la IP del computador cuando se prueba desde un celular en la misma red Wi-Fi.
const servidor =
  typeof location !== 'undefined' && location.hostname ? location.hostname : 'localhost';

export const environment = {
  production: false,
  apiUrl: `http://${servidor}:3100`,
};
