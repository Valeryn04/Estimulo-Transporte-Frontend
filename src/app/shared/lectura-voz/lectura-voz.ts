import { Injectable, signal } from '@angular/core';

const CLAVE = 'lectura_voz_activa';

/** Viene activada de entrada: solo se apaga si la persona la desactivó antes (quien no la necesita la apaga una vez). */
const leerPreferencia = (): boolean => {
  try {
    return localStorage.getItem(CLAVE) !== '0';
  } catch {
    return true;
  }
};

const guardarPreferencia = (activa: boolean): void => {
  try {
    localStorage.setItem(CLAVE, activa ? '1' : '0');
  } catch {
    // Sin almacenamiento (modo privado): la preferencia solo dura mientras la pestaña esté abierta.
  }
};

const limpio = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim();

/**
 * Texto que se ve de un elemento: sin el icono de ayuda «?» (cuyo texto va escondido), sin el asterisco decorativo y
 * sin lo marcado como oculto. La ayuda se dice aparte, después del nombre.
 */
export function textoVisible(el: Element): string {
  const copia = el.cloneNode(true) as Element;
  copia
    .querySelectorAll('app-ayuda, [role="tooltip"], [aria-hidden="true"]')
    .forEach((n) => n.remove());
  return limpio(copia.textContent);
}

/** Texto de ayuda («?») del campo o de la pregunta a la que pertenece un control. */
function ayudaDeCampo(el: HTMLElement): string {
  if (el.closest('app-ayuda')) return '';
  const contenedor = el.closest('app-campo') ?? el.closest('fieldset');
  return limpio(contenedor?.querySelector('app-ayuda [role="tooltip"]')?.textContent);
}

/** Texto de los elementos a los que apunta un atributo con ids separados por espacios (aria-labelledby, aria-describedby). */
function textoDeIds(el: Element, atributo: string): string {
  const ids = (el.getAttribute(atributo) ?? '').split(/\s+/).filter(Boolean);
  return ids
    .map((id) => limpio(el.ownerDocument.getElementById(id)?.textContent))
    .filter(Boolean)
    .join('. ');
}

const TIPOS_ENTRADA: Record<string, string> = {
  text: 'campo de texto',
  search: 'campo de búsqueda',
  email: 'campo de correo electrónico',
  tel: 'campo de teléfono',
  number: 'campo numérico',
  password: 'campo de contraseña',
  date: 'campo de fecha',
  file: 'selector de archivo',
  checkbox: 'casilla',
  radio: 'opción',
  submit: 'botón',
  button: 'botón',
};

/** Nombre que tiene un control para una persona: su etiqueta, el grupo al que pertenece o su texto. */
function nombreDe(el: HTMLElement): string {
  const aria = limpio(el.getAttribute('aria-label'));
  if (aria) return aria;
  const por = textoDeIds(el, 'aria-labelledby');
  if (por) return por;
  const id = el.getAttribute('id');
  if (id) {
    const etiqueta = el.ownerDocument.querySelector(
      `label[for="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id}"]`,
    );
    if (etiqueta) {
      // La etiqueta puede traer el «obligatorio» o el icono de ayuda: se lee solo su texto visible.
      const t = textoVisible(etiqueta);
      if (t) return t;
    }
  }
  const envolvente = el.closest('label');
  if (envolvente) {
    const t = textoVisible(envolvente);
    if (t) return t;
  }
  const texto = textoVisible(el);
  if (texto && ['BUTTON', 'A', 'SUMMARY'].includes(el.tagName)) return texto;
  return limpio(el.getAttribute('title')) || limpio(el.getAttribute('placeholder')) || 'sin nombre';
}

/**
 * Lo que se dice al enfocar un control: su nombre, qué es, si es obligatorio, su valor o estado y su ayuda o error.
 * Una opción de grupo («Sí» / «No») dice primero la pregunta del grupo.
 */
export function describirControl(el: HTMLElement): string {
  const etiqueta = el.tagName.toLowerCase();
  // La etiqueta puede traer «(obligatorio)» para lectores de pantalla: aquí se dice una sola vez, más abajo.
  let nombre = nombreDe(el)
    .replace(/\s*\(obligatorio\)/gi, '')
    .trim();
  let tipo: string;
  let estado = '';
  if (etiqueta === 'input') {
    const t = (el as HTMLInputElement).type;
    tipo = TIPOS_ENTRADA[t] ?? 'campo';
    if (t === 'checkbox' || t === 'radio') {
      estado = (el as HTMLInputElement).checked ? 'marcada' : 'sin marcar';
      const legend = el.closest('fieldset')?.querySelector('legend');
      const grupo = legend ? textoVisible(legend) : '';
      if (t === 'radio' && grupo) nombre = `${grupo}: ${nombre}`;
    } else if (t !== 'password' && t !== 'file' && (el as HTMLInputElement).value) {
      estado = `escrito: ${(el as HTMLInputElement).value}`;
    }
  } else if (etiqueta === 'select') {
    tipo = 'lista desplegable';
    const sel = (el as HTMLSelectElement).selectedOptions[0];
    estado = sel ? `seleccionado: ${limpio(sel.textContent)}` : '';
  } else if (etiqueta === 'textarea') {
    tipo = 'área de texto';
    if ((el as HTMLTextAreaElement).value) estado = `escrito: ${(el as HTMLTextAreaElement).value}`;
  } else if (etiqueta === 'a') {
    tipo = 'enlace';
  } else if (etiqueta === 'button' || el.getAttribute('role') === 'button') {
    tipo = 'botón';
    const presionado = el.getAttribute('aria-pressed');
    if (presionado !== null) estado = presionado === 'true' ? 'activado' : 'desactivado';
  } else {
    tipo = '';
  }
  const requerido =
    (el as HTMLInputElement).required === true || el.getAttribute('aria-required') === 'true';
  const invalido = el.getAttribute('aria-invalid') === 'true';
  const ayuda = textoDeIds(el, 'aria-describedby');
  const ayudaCampo = ayudaDeCampo(el);
  const partes = [nombre, tipo, requerido ? 'obligatorio' : '', estado].filter(Boolean).join(', ');
  const extra = [
    invalido && ayuda ? `Error: ${ayuda}` : ayuda,
    ayudaCampo ? `Ayuda: ${ayudaCampo}` : '',
  ]
    .filter(Boolean)
    .join('. ');
  return extra ? `${partes}. ${extra}` : partes;
}

/** Texto de la página para leerla de corrido: títulos, preguntas, párrafos y avisos, en el orden en que aparecen. */
export function textoDePagina(raiz: ParentNode): string {
  const vistos = new Set<string>();
  const partes: string[] = [];
  for (const n of Array.from(raiz.querySelectorAll('h1, h2, h3, legend, label, p, li, .aviso'))) {
    // Los títulos, las preguntas y las etiquetas llevan su ayuda («?») a continuación.
    const base = textoVisible(n);
    const ayuda = limpio(n.querySelector('app-ayuda [role="tooltip"]')?.textContent);
    const t = ayuda ? `${base}${/[.!?:;]$/.test(base) ? '' : '.'} ${ayuda}` : base;
    if (t && !vistos.has(t)) {
      vistos.add(t);
      // Cada bloque termina en punto (si no lo trae) para que la voz haga su pausa.
      partes.push(/[.!?:;]$/.test(t) ? t : `${t}.`);
    }
  }
  return partes.join(' ');
}

/** Parte el texto en frases cortas: el navegador corta las lecturas muy largas. */
function frases(texto: string): string[] {
  const salida: string[] = [];
  let actual = '';
  for (const f of texto.split(/(?<=[.!?:;])\s+/)) {
    if ((actual + ' ' + f).length > 180 && actual) {
      salida.push(actual);
      actual = f;
    } else {
      actual = actual ? `${actual} ${f}` : f;
    }
  }
  if (actual) salida.push(actual);
  return salida;
}

/**
 * Lectura en voz alta del portal para las personas con discapacidad visual que no tienen lector de pantalla: usa la
 * voz que trae el navegador (Web Speech API). Dice dónde está el foco, lee la página y avisa los errores.
 */
@Injectable({ providedIn: 'root' })
export class LecturaVoz {
  private readonly sintesis: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

  readonly soportado = this.sintesis !== null;
  readonly activa = signal(leerPreferencia());
  readonly hablando = signal(false);
  /** Ya se presentó (una sola vez por visita, con el primer toque de la persona). */
  saludada = false;
  /** Mientras se dice la presentación, lo que se enfoca se dice a continuación y no la corta. */
  readonly saludando = signal(false);

  private elegirVoz(): SpeechSynthesisVoice | null {
    const voces = this.sintesis?.getVoices() ?? [];
    const es = voces.filter((v) => v.lang.toLowerCase().startsWith('es'));
    for (const preferida of ['es-co', 'es-mx', 'es-us', 'es-419', 'es-es']) {
      const v = es.find((x) => x.lang.toLowerCase().replace('_', '-') === preferida);
      if (v) return v;
    }
    return es[0] ?? null;
  }

  /** Dice el texto; por defecto corta lo que se estaba leyendo (al cambiar de foco no se acumulan). */
  hablar(texto: string, anadir = false): void {
    const sintesis = this.sintesis;
    const dicho = limpio(texto);
    if (!sintesis || !dicho) return;
    if (!anadir) sintesis.cancel();
    const partes = frases(dicho);
    const voz = this.elegirVoz();
    partes.forEach((parte, i) => {
      const u = new SpeechSynthesisUtterance(parte);
      u.lang = voz?.lang ?? 'es-CO';
      if (voz) u.voice = voz;
      u.rate = 0.95;
      if (i === 0) u.onstart = () => this.hablando.set(true);
      if (i === partes.length - 1) {
        u.onend = () => this.hablando.set(false);
      }
      u.onerror = () => this.hablando.set(false);
      sintesis.speak(u);
    });
  }

  detener(): void {
    this.sintesis?.cancel();
    this.hablando.set(false);
  }

  /**
   * Se presenta sola con el primer toque o tecla de la persona (los navegadores no dejan hablar antes). Dice cómo
   * recorrer el formulario y cómo apagar la lectura si no se necesita.
   */
  saludar(): void {
    if (!this.soportado || !this.activa() || this.saludada) return;
    this.saludada = true;
    this.saludando.set(true);
    this.hablar(
      'Bienvenido. La lectura en voz alta está activada: use la tecla Tab para recorrer el formulario y escuchará cada campo. ' +
        'Si no la necesita, pulse Alt, Mayús y L para desactivarla.',
    );
    // La presentación termina cuando la voz deja de hablar.
    const espera = setInterval(() => {
      if (!this.hablando()) {
        this.saludando.set(false);
        clearInterval(espera);
      }
    }, 300);
  }

  activar(): void {
    this.saludada = true;
    this.activa.set(true);
    guardarPreferencia(true);
    this.hablar(
      'Lectura en voz alta activada. Use la tecla Tab para recorrer el formulario: se dirá el nombre de cada campo. ' +
        'Pulse el botón Leer esta página para escuchar todo el contenido.',
    );
  }

  desactivar(): void {
    this.detener();
    this.saludando.set(false);
    this.activa.set(false);
    guardarPreferencia(false);
  }

  alternar(): void {
    if (this.activa()) this.desactivar();
    else this.activar();
  }
}
