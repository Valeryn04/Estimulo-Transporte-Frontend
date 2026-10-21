import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AuthApi } from '../../../../core/auth/auth-api';
import { PERMISO } from '../../../../core/auth/modelos';
import { Sesion } from '../../../../core/auth/sesion';
import { Icono } from '../../../../shared/icono/icono';
import { LockupDependencia } from '../../../../shared/lockup-dependencia/lockup-dependencia';
import { SECCIONES } from '../../../../shared/pestanas/secciones';
import { Campana } from '../campana/campana';
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
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    Icono,
    LockupDependencia,
    MenuUsuario,
    Campana,
  ],
  templateUrl: './interno-shell.html',
  styleUrl: './interno-shell.scss',
  host: {
    '(document:keydown.escape)': 'escape()',
    '(change)': 'cambioFiltro($event)',
    '(input)': 'escribeFiltro($event)',
  },
})
export class InternoShell implements OnInit {
  protected readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  private readonly api = inject(AuthApi);
  private readonly destruir = inject(DestroyRef);
  protected readonly PERMISO = PERMISO;

  protected readonly esMovil = signal(false);
  private readonly url = signal('');

  /**
   * Menú lateral: cada entrada agrupa las pantallas relacionadas de una sección (que se recorren con pestañas) y
   * lleva a la primera que el rol puede ver. Lo que el rol no puede ver no aparece.
   */
  protected readonly grupos = computed(() => {
    const url = this.url();
    const sueltas: {
      nombre: string;
      entradas: { texto: string; ruta: string; activa: boolean }[];
    }[] = [];
    const agregar = (grupo: string, texto: string, ruta: string, activa: boolean) => {
      let g = sueltas.find((x) => x.nombre === grupo);
      if (!g) sueltas.push((g = { nombre: grupo, entradas: [] }));
      g.entradas.push({ texto, ruta, activa });
    };
    const esta = (rutas: readonly string[]) =>
      rutas.some((r) => url === r || url.startsWith(`${r}/`) || url.startsWith(`${r}?`));
    if (this.sesion.tiene(PERMISO.validacionVer)) {
      agregar(
        'Proceso',
        'Validación de solicitudes',
        '/interno/validacion',
        esta(['/interno/validacion']),
      );
    }
    for (const s of Object.values(SECCIONES)) {
      const visibles = s.pestanas.filter((p) => this.sesion.tieneAlguno(...p.permisos));
      if (visibles.length === 0) continue;
      agregar(s.grupo, s.titulo, visibles[0]!.ruta, esta(visibles.map((p) => p.ruta)));
    }
    const orden = ['Proceso', 'Control', 'Configuración', 'Seguridad'];
    return sueltas.sort((a, b) => orden.indexOf(a.nombre) - orden.indexOf(b.nombre));
  });
  protected readonly menuAbierto = signal(true);

  ngOnInit(): void {
    this.configurarPantalla();
    this.url.set(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
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

  private esperaFiltro: ReturnType<typeof setTimeout> | undefined;

  /** Los filtros se aplican solos al elegir una opción, sin tener que pulsar «Buscar». */
  protected cambioFiltro(e: Event): void {
    const el = e.target;
    const aplica =
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'date'));
    if (aplica) this.enviarFiltro(el);
  }

  /** Al escribir en un buscador se espera un momento a que la persona termine y se filtra. */
  protected escribeFiltro(e: Event): void {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== 'search') return;
    clearTimeout(this.esperaFiltro);
    this.esperaFiltro = setTimeout(() => this.enviarFiltro(el), 450);
  }

  private enviarFiltro(el: HTMLElement): void {
    const f = el.closest('form.filtros');
    if (f instanceof HTMLFormElement && !f.hasAttribute('data-manual') && f.checkValidity()) {
      f.requestSubmit();
    }
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
