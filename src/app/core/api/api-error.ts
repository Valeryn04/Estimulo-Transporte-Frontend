import { HttpErrorResponse } from '@angular/common/http';

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export class ApiError extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly errores: ErrorCampo[] = [],
    readonly detalle?: unknown,
  ) {
    super(mensaje);
    this.name = 'ApiError';
  }
}

interface CuerpoError {
  error?: { codigo?: string; mensaje?: string; errores?: ErrorCampo[]; detalle?: unknown };
}

function desdeCuerpo(estado: number, cuerpo: CuerpoError | null): ApiError {
  const e = cuerpo?.error;
  if (e?.codigo && e.mensaje) {
    return new ApiError(estado, e.codigo, e.mensaje, e.errores ?? [], e.detalle);
  }
  if (estado === 0) {
    return new ApiError(
      0,
      'SIN_CONEXION',
      'No hay conexión con el servidor. Revise su internet e intente de nuevo.',
    );
  }
  return new ApiError(
    estado,
    'ERROR_INESPERADO',
    'Ocurrió un error inesperado. Intente de nuevo en unos minutos.',
  );
}

export async function aApiError(error: unknown): Promise<ApiError> {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    let cuerpo: unknown = error.error;
    if (cuerpo instanceof Blob) {
      try {
        cuerpo = JSON.parse(await cuerpo.text());
      } catch {
        cuerpo = null;
      }
    }
    return desdeCuerpo(error.status, (cuerpo ?? null) as CuerpoError | null);
  }
  return new ApiError(0, 'ERROR_INESPERADO', 'Ocurrió un error inesperado.');
}
