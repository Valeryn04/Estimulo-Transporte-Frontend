import { ActivatedRoute, Router } from '@angular/router';

/**
 * Los enlaces de los correos traen un `?token=` de un solo propósito. En cuanto la pantalla lo lee se quita de la
 * dirección: así no queda a la vista, en el historial del navegador ni en lo que se copia o se comparte. La pantalla
 * conserva el valor en memoria mientras lo necesite.
 */
export function ocultarTokenEnLaUrl(router: Router, ruta: ActivatedRoute): void {
  void router.navigate([], {
    relativeTo: ruta,
    queryParams: { token: null },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}
