import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../../../core/api/api';
import {
  AjusteCupos,
  Alerta,
  Beneficiario,
  CambioCupos,
  DatosEntrega,
  DetalleBeneficio,
  CuposConCatalogos,
  EstadoBeneficio,
  Propuesta,
  ResumenCupos,
} from './modelos-asignacion';

const ASIGNACION = `${API_BASE}/admin/asignacion`;

/** Cupos y presupuesto (RF-ASI-01), asignación (RF-ASI-02), lista de espera (RF-ASI-03) y avisos internos. */
@Injectable({ providedIn: 'root' })
export class AsignacionApi {
  private readonly http = inject(HttpClient);

  cupos(): Observable<CuposConCatalogos> {
    return this.http.get<CuposConCatalogos>(`${ASIGNACION}/cupos`);
  }

  /** Modifica cupos, valor, presupuesto o distribución; los cupos y el presupuesto exigen el soporte. */
  ajustarCupos(cambio: CambioCupos, soporte: File | null): Observable<CuposConCatalogos> {
    const form = new FormData();
    form.append('datos', JSON.stringify(cambio));
    if (soporte) form.append('archivo', soporte, soporte.name);
    return this.http.put<CuposConCatalogos>(`${ASIGNACION}/cupos`, form);
  }

  ajustes(): Observable<AjusteCupos[]> {
    return this.http
      .get<{ items: AjusteCupos[] }>(`${ASIGNACION}/cupos/ajustes`)
      .pipe(map((r) => r.items));
  }

  soporte(id: number): Observable<Blob> {
    return this.http.get(`${ASIGNACION}/cupos/ajustes/${id}/soporte`, { responseType: 'blob' });
  }

  propuesta(pagina: number, tamano: number): Observable<Propuesta> {
    const params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    return this.http.get<Propuesta>(`${ASIGNACION}/propuesta`, { params });
  }

  asignar(
    solicitudIds: number[],
    omisiones: { solicitudId: number; causa: string }[],
  ): Observable<{ asignados: number; resumen: ResumenCupos }> {
    return this.http.post<{ asignados: number; resumen: ResumenCupos }>(`${ASIGNACION}/asignar`, {
      solicitudIds,
      omisiones,
    });
  }

  enviarAListaEspera(): Observable<{ enListaDeEspera: number; radicados: string[] }> {
    return this.http.post<{ enListaDeEspera: number; radicados: string[] }>(
      `${ASIGNACION}/lista-espera`,
      {},
    );
  }

  beneficiarios(
    estado: EstadoBeneficio | undefined,
    q: string | undefined,
    pagina: number,
    tamano: number,
  ): Observable<{ items: Beneficiario[]; total: number }> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (estado) params = params.set('estado', estado);
    if (q) params = params.set('q', q);
    return this.http.get<{ items: Beneficiario[]; total: number }>(`${ASIGNACION}/beneficiarios`, {
      params,
    });
  }

  // ---- entrega y activación (RF-ASI-05)

  beneficio(id: number): Observable<DetalleBeneficio> {
    return this.http.get<DetalleBeneficio>(`${ASIGNACION}/beneficiarios/${id}`);
  }

  registrarEntrega(id: number, d: DatosEntrega, acta: File): Observable<DetalleBeneficio> {
    const form = new FormData();
    form.append('datos', JSON.stringify(d));
    form.append('archivo', acta, acta.name);
    return this.http.post<DetalleBeneficio>(`${ASIGNACION}/beneficiarios/${id}/entregas`, form);
  }

  activar(id: number, observacion: string): Observable<DetalleBeneficio> {
    return this.http.post<DetalleBeneficio>(`${ASIGNACION}/beneficiarios/${id}/activar`, {
      observacion,
    });
  }

  /** Planilla en PDF para que las personas firmen el día de la entrega. */
  actaDeEntrega(beneficios: number[]): Observable<Blob> {
    return this.http.get(`${ASIGNACION}/actas-entrega`, {
      params: { beneficios: beneficios.join(',') },
      responseType: 'blob',
    });
  }

  acta(entregaId: number): Observable<Blob> {
    return this.http.get(`${ASIGNACION}/entregas/${entregaId}/soporte`, { responseType: 'blob' });
  }

  // ---- avisos internos

  alertas(): Observable<Alerta[]> {
    return this.http
      .get<{ items: Alerta[] }>(`${API_BASE}/admin/alertas`)
      .pipe(map((r) => r.items));
  }

  atenderAlerta(id: number): Observable<void> {
    return this.http.post<void>(`${API_BASE}/admin/alertas/${id}/atender`, {});
  }
}
