import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AuthApi } from '../../../../core/auth/auth-api';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Icono } from '../../../../shared/icono/icono';
import { LockupDependencia } from '../../../../shared/lockup-dependencia/lockup-dependencia';
import { MenuUsuario } from '../menu-usuario/menu-usuario';

/** Preferencia de la persona (solo de presentación, no es información de la sesión). */
const CLAVE_MENU = 'estimulo.menu-lateral';
const PANTALLA_ANGOSTA = '(max-width: 900px)';

function leerPreferencia(): 'abierto' | 'cerrado' {
  try {
    return localStorage.getItem(CLAVE_MENU) === 'cerrado' ? 'cerrado' : 'abierto';
  } catch {
    return 'abierto'; // almacenamiento bloqueado: se usa el valor por defecto
  }
}

function guardarPreferencia(valor: 'abierto' | 'cerrado'): void {
  try {
    localStorage.setItem(CLAVE_MENU, valor);
  } catch {
    /* sin almacenamiento: la preferencia vale solo para esta visita */
  }
}

/**
 * Marco del portal interno: barra superior (menú lateral, identificador y menú de la persona) y menú
 * lateral según permisos. En pantallas anchas el menú se puede ocultar y se recuerda la preferencia; en
 * pantallas angostas es un cajón que se abre sobre el contenido y se cierra al navegar (RNF-01).
 */
@Component({
  selector: 'app-interno-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icono, LockupDependencia, MenuUsuario],
  templateUrl: './interno-shell.html',
  styleUrl: './interno-shell.scss',
  host: { '(document:keydown.escape)': 'escape()' },
})
export class InternoShell implements OnInit {
  protected readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  private readonly api = inject(AuthApi);
  private readonly destruir = inject(DestroyRef);
  protected readonly PERMISO = PERMISO;

  protected readonly esMovil = signal(false);
  protected readonly menuAbierto = signal(true);

  ngOnInit(): void {
    this.configurarPantalla();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.esMovil()) this.menuAbierto.set(false); // el cajón se cierra al ir a otra pantalla
      });
  }

  private configurarPantalla(): void {
    if (typeof matchMedia !== 'function') {
      this.menuAbierto.set(leerPreferencia() === 'abierto');
      return;
    }
    const consulta = matchMedia(PANTALLA_ANGOSTA);
    const aplicar = (angosta: boolean) => {
      this.esMovil.set(angosta);
      this.menuAbierto.set(angosta ? false : leerPreferencia() === 'abierto');
    };
    aplicar(consulta.matches);
    const alCambiar = (e: MediaQueryListEvent) => aplicar(e.matches);
    consulta.addEventListener('change', alCambiar);
    this.destruir.onDestroy(() => consulta.removeEventListener('change', alCambiar));
  }

  protected alternarMenu(): void {
    const abrir = !this.menuAbierto();
    this.menuAbierto.set(abrir);
    if (!this.esMovil()) guardarPreferencia(abrir ? 'abierto' : 'cerrado');
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
    if (!this.esMovil()) guardarPreferencia('cerrado');
  }

  protected escape(): void {
    if (this.esMovil() && this.menuAbierto()) this.menuAbierto.set(false);
  }

  protected async cerrarSesion(): Promise<void> {
    try {
      // Revoca el refresh token en el servidor y borra la cookie; si falla igual se cierra en este equipo.
      await firstValueFrom(this.api.cerrarSesion());
    } catch {
      /* sin conexión: la sesión del servidor vence sola por inactividad */
    }
    this.sesion.cerrar('Cerró su sesión correctamente.');
    await this.router.navigate(['/interno/login']);
  }
}
