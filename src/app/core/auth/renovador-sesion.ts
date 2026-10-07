import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AuthApi } from './auth-api';
import { Sesion } from './sesion';

@Injectable({ providedIn: 'root' })
export class RenovadorSesion {
  private readonly api = inject(AuthApi);
  private readonly sesion = inject(Sesion);
  private enCurso: Observable<string> | null = null;

  renovar(): Observable<string> {
    this.enCurso ??= this.api.refrescar().pipe(
      tap((r) => {
        if (this.sesion.autenticada()) {
          this.sesion.renovar(r.token);
          this.sesion.perfil.set(r.perfil);
          this.sesion.marcarActividad();
        } else {
          this.sesion.iniciar(r.token, r.perfil, r.inactividadMinutos);
        }
      }),
      map((r) => r.token),
      finalize(() => (this.enCurso = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.enCurso;
  }

  restaurar(): Observable<boolean> {
    return this.renovar().pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }
}
