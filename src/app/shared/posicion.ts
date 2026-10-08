export interface EntradaPosicion {
  /** Posición que la persona escribió (null si aún no escribe nada). */
  posicion: number | null;
  /** Cuántos elementos hay hoy en la lista (o en el grupo, por ejemplo los barrios de una localidad). */
  total: number;
  /** Se está creando un elemento (la lista puede crecer una posición más). */
  esNuevo: boolean;
  /** Quién ocupa hoy esa posición, si alguien. */
  ocupante: { id: number; nombre: string } | null;
  /** Elemento que se está editando. */
  propioId?: number;
}

/**
 * Texto de ayuda para el campo «Orden»: cada elemento ocupa una posición propia, así que al pedir una ocupada
 * se avisa quién la tiene y que los demás se corren (el servidor nunca deja dos con el mismo número).
 */
export function ayudaPosicion(e: EntradaPosicion): string {
  const base = 'Posición en la lista (1 es la primera). Cada elemento tiene una posición propia.';
  const p = e.posicion;
  if (p === null || !Number.isInteger(p) || p < 1) return base;
  const ultima = e.esNuevo ? e.total + 1 : e.total;
  if (e.ocupante && e.ocupante.id === e.propioId)
    return 'Es su posición actual: el orden no cambia.';
  if (e.ocupante) {
    return (
      `La posición ${p} la tiene «${e.ocupante.nombre}». Al guardar se corren «${e.ocupante.nombre}» ` +
      'y los siguientes para que no se repita el número.'
    );
  }
  if (p >= ultima) return `Quedará al final de la lista (posición ${ultima}).`;
  return base;
}
