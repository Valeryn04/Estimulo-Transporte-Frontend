import { Component, OnInit, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { PublicoApi } from '../../../core/publico/publico-api';
import { ocultarTokenEnLaUrl } from '../../../shared/enlace';

type Resultado = 'verificando' | 'verificado' | 'ya-verificado' | 'vencido' | 'invalido' | 'error';

/** Destino del enlace del correo de verificación (RF-PRE-04). */
@Component({
  selector: 'app-verificar-correo-page',
  imports: [RouterLink],
  templateUrl: './verificar-correo-page.html',
})
export class VerificarCorreoPage implements OnInit {
  private readonly api = inject(PublicoApi);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  /** Parámetro de consulta `?token=` (enlazado por el enrutador). */
  readonly token = input<string>();
  protected readonly resultado = signal<Resultado>('verificando');
  protected readonly mensaje = signal('');

  async ngOnInit(): Promise<void> {
    const token = this.token();
    if (!token) {
      this.resultado.set('invalido');
      return;
    }
    ocultarTokenEnLaUrl(this.router, this.ruta);
    try {
      const r = await firstValueFrom(this.api.verificarCorreo(token));
      this.resultado.set(r.estado === 'VERIFICADO' ? 'verificado' : 'ya-verificado');
    } catch (e) {
      if (e instanceof ApiError && e.codigo === 'ENLACE_VENCIDO') this.resultado.set('vencido');
      else if (e instanceof ApiError && e.codigo === 'ENLACE_INVALIDO')
        this.resultado.set('invalido');
      else {
        this.resultado.set('error');
        this.mensaje.set(e instanceof ApiError ? e.message : 'No pudimos verificar el correo.');
      }
    }
  }
}
