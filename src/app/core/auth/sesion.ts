import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PerfilUsuario } from './modelos';

@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly router = inject(Router);
  private readonly _token = signal<string | null>(null);
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private inactividadMs = 0;

  readonly token = this._token.asReadonly();
  readonly perfil = signal<PerfilUsuario | null>(null);
  readonly autenticada = computed(() => this._token() !== null);
  readonly motivoCierre = signal('');

  iniciar(token: string, perfil: PerfilUsuario, inactividadMinutos = 30): void {
    this.motivoCierre.set('');
    this._token.set(token);
    this.perfil.set(perfil);
    this.inactividadMs = inactividadMinutos * 60_000;
    this.marcarActividad();
  }

  renovar(token: string): void {
    if (this._token()) this._token.set(token);
  }

  marcarActividad(): void {
    clearTimeout(this.temporizador);
    if (!this._token() || this.inactividadMs <= 0) return;
    this.temporizador = setTimeout(() => {
      this.cerrar('Su sesión expiró por inactividad. Ingrese de nuevo.');
      void this.router.navigate(['/interno/login']);
    }, this.inactividadMs);
  }

  cerrar(motivo = ''): void {
    clearTimeout(this.temporizador);
    this._token.set(null);
    this.perfil.set(null);
    this.motivoCierre.set(motivo);
  }

  tiene(permiso: string): boolean {
    return this.perfil()?.permisos.includes(permiso) ?? false;
  }

  tieneAlguno(...permisos: string[]): boolean {
    return permisos.some((p) => this.tiene(p));
  }
}
