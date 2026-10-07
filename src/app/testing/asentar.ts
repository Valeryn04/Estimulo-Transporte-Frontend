import { ComponentFixture } from '@angular/core/testing';

/**
 * Espera a que terminen las tareas pendientes de una pantalla (respuestas HTTP simuladas, promesas y
 * señales que se actualizan después) y vuelve a pintarla, para poder comprobar el resultado final.
 */
export async function asentar(
  fixture: Pick<ComponentFixture<unknown>, 'detectChanges' | 'whenStable'>,
): Promise<void> {
  await esperarTareas();
  fixture.detectChanges();
  await fixture.whenStable();
}

/** Deja correr todas las microtareas pendientes (conversión de errores, promesas encadenadas). */
export function esperarTareas(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, 0));
}
