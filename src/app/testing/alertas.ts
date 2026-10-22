import { Alertas, OpcionesConfirmacion } from '../shared/alertas/alertas';

/** Alertas de pruebas: confirman de inmediato (o rechazan) sin dibujar nada, y guardan lo que se preguntó. */
export class AlertasPrueba extends Alertas {
  respuesta = true;
  preguntas: OpcionesConfirmacion[] = [];
  avisos: string[] = [];

  override async confirmar(o: OpcionesConfirmacion): Promise<boolean> {
    this.preguntas.push(o);
    return this.respuesta;
  }

  override aviso(_tipo: string, titulo: string): void {
    this.avisos.push(titulo);
  }

  override async problema(titulo: string): Promise<void> {
    this.avisos.push(titulo);
  }

  // En las pruebas no hay barra de carga.
  override iniciarCarga(): void {
    return;
  }

  override terminarCarga(): void {
    return;
  }
}
