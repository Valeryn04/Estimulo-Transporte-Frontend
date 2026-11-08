import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { LecturaVoz, describirControl, textoDePagina } from './lectura-voz';
import { LecturaVozBarra } from './lectura-voz-barra';

/** Voz simulada: guarda lo que se «dice» y permite comprobar que se corta lo anterior. */
class Enunciado {
  lang = '';
  voice: unknown = null;
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

const dichas: string[] = [];
const cancelar = vi.fn();
const sintesis = {
  speak: (u: Enunciado) => {
    dichas.push(u.text);
    u.onstart?.();
    u.onend?.();
  },
  cancel: () => {
    cancelar();
  },
  getVoices: () => [
    { lang: 'en-US', name: 'Ingles' },
    { lang: 'es-MX', name: 'Mexico' },
    { lang: 'es-CO', name: 'Colombia' },
  ],
};

@Component({ template: '' })
class Vacia {}

describe('lectura en voz alta', () => {
  beforeEach(() => {
    dichas.length = 0;
    cancelar.mockClear();
    localStorage.clear();
    vi.stubGlobal('SpeechSynthesisUtterance', Enunciado);
    Object.defineProperty(window, 'speechSynthesis', { value: sintesis, configurable: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'speechSynthesis');
    document.body.innerHTML = '';
  });

  const fragmento = (html: string): HTMLElement => {
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    return div;
  };

  describe('describirControl', () => {
    it('dice la etiqueta, qué es, si es obligatorio y la ayuda o el error enlazados', () => {
      const d = fragmento(`
        <label for="correo">Correo electrónico</label>
        <input id="correo" type="email" required aria-invalid="true" aria-describedby="err" />
        <span id="err">escriba un correo válido</span>`);
      const dicho = describirControl(d.querySelector('input')!);
      expect(dicho).toContain('Correo electrónico, campo de correo electrónico, obligatorio');
      expect(dicho).toContain('Error: escriba un correo válido');
    });

    it('no repite «obligatorio» cuando la etiqueta ya lo trae', () => {
      const d = fragmento(
        '<label for="x">Nombre <span class="solo-lectores">(obligatorio)</span></label><input id="x" required />',
      );
      expect(describirControl(d.querySelector('input')!)).toBe('Nombre, campo, obligatorio');
    });

    it('lee el valor ya escrito, salvo en contraseñas', () => {
      const d = fragmento(`
        <label for="n">Nombre</label><input id="n" type="text" value="María" />
        <label for="p">Clave</label><input id="p" type="password" value="secreta" />`);
      expect(describirControl(d.querySelector('#n')!)).toContain('escrito: María');
      expect(describirControl(d.querySelector('#p')!)).not.toContain('secreta');
    });

    it('la etiqueta se lee limpia y la ayuda («?») se dice aparte, después del nombre', () => {
      const d = fragmento(`
        <app-campo>
          <label for="n">Nombre completo <span aria-hidden="true">*</span>
            <app-ayuda><button type="button" aria-label="Ayuda: nombre"></button>
              <span role="tooltip">Escriba el nombre como aparece en su documento.</span></app-ayuda>
          </label>
          <input id="n" type="text" />
        </app-campo>`);
      const dicho = describirControl(d.querySelector('input')!);
      expect(dicho).toBe(
        'Nombre completo, campo de texto. Ayuda: Escriba el nombre como aparece en su documento.',
      );
    });

    it('en una opción de grupo dice primero la pregunta y su estado', () => {
      const d = fragmento(`
        <fieldset><legend>¿Va a agregar un cuidador?</legend>
          <label><input type="radio" name="c" checked /> <span>Sí</span></label>
          <label><input type="radio" name="c" /> <span>No</span></label>
        </fieldset>`);
      const radios = d.querySelectorAll('input');
      expect(describirControl(radios[0]!)).toBe('¿Va a agregar un cuidador?: Sí, opción, marcada');
      expect(describirControl(radios[1]!)).toContain('sin marcar');
    });

    it('dice qué opción está elegida en una lista y el nombre de un botón', () => {
      const d = fragmento(`
        <label for="t">Tipo</label>
        <select id="t"><option>Elija</option><option selected>Cédula</option></select>
        <button type="button" aria-pressed="true">Activar</button>`);
      expect(describirControl(d.querySelector('select')!)).toBe(
        'Tipo, lista desplegable, seleccionado: Cédula',
      );
      expect(describirControl(d.querySelector('button')!)).toBe('Activar, botón, activado');
    });
  });

  it('textoDePagina junta títulos, preguntas y párrafos sin repetir', () => {
    const d = fragmento(
      '<h1>Preinscripción</h1><p>Complete sus datos.</p><label>Nombre</label><p>Complete sus datos.</p>',
    );
    expect(textoDePagina(d)).toBe('Preinscripción. Complete sus datos. Nombre.');
  });

  it('textoDePagina lee el título limpio y su ayuda a continuación', () => {
    const d = fragmento(
      '<h1>Preinscripción <app-ayuda><span role="tooltip">Es el primer paso.</span></app-ayuda></h1>',
    );
    expect(textoDePagina(d)).toBe('Preinscripción. Es el primer paso.');
  });

  describe('servicio', () => {
    it('elige una voz en español y dice el texto cortando lo anterior', () => {
      const voz = TestBed.inject(LecturaVoz);
      voz.hablar('Hola');
      expect(cancelar).toHaveBeenCalled();
      expect(dichas).toEqual(['Hola']);
    });

    it('un texto largo se parte en frases cortas', () => {
      const voz = TestBed.inject(LecturaVoz);
      voz.hablar(Array.from({ length: 12 }, (_, i) => `Esta es la frase número ${i}.`).join(' '));
      expect(dichas.length).toBeGreaterThan(1);
      expect(dichas.every((t) => t.length <= 190)).toBe(true);
    });

    it('activar y desactivar guardan la preferencia y avisan de cómo usarla', () => {
      const voz = TestBed.inject(LecturaVoz);
      voz.activar();
      expect(voz.activa()).toBe(true);
      expect(localStorage.getItem('lectura_voz_activa')).toBe('1');
      expect(dichas.join(' ')).toContain('Lectura en voz alta activada');
      voz.desactivar();
      expect(voz.activa()).toBe(false);
      expect(localStorage.getItem('lectura_voz_activa')).toBe('0');
    });

    it('sin voz en el navegador no falla', () => {
      Reflect.deleteProperty(window, 'speechSynthesis');
      const voz = new (LecturaVoz as unknown as new () => LecturaVoz)();
      expect(voz.soportado).toBe(false);
      expect(() => voz.hablar('Hola')).not.toThrow();
    });
  });

  describe('barra', () => {
    async function montar() {
      TestBed.configureTestingModule({
        providers: [provideRouter([{ path: '**', component: Vacia }])],
      });
      const main = document.createElement('main');
      document.body.appendChild(main);
      const fixture = TestBed.createComponent(LecturaVozBarra);
      document.body.appendChild(fixture.nativeElement);
      fixture.detectChanges();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      return { fixture, el, main };
    }

    it('el botón activa y desactiva la lectura y lo dice con aria-pressed', async () => {
      const { fixture, el } = await montar();
      const boton = el.querySelector<HTMLButtonElement>('button')!;
      expect(boton.getAttribute('aria-pressed')).toBe('false');
      expect(boton.textContent).toContain('Activar lectura en voz alta');
      boton.click();
      fixture.detectChanges();
      expect(boton.getAttribute('aria-pressed')).toBe('true');
      expect(el.textContent).toContain('Leer esta página');
      boton.click();
      fixture.detectChanges();
      expect(el.textContent).not.toContain('Leer esta página');
    });

    it('activada, dice el nombre de cada campo del contenido al enfocarlo; apagada, calla', async () => {
      const { fixture, main } = await montar();
      main.innerHTML = '<label for="a">Nombre completo</label><input id="a" type="text" />';
      const input = main.querySelector('input')!;
      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(dichas).toEqual([]);
      TestBed.inject(LecturaVoz).activar();
      dichas.length = 0;
      fixture.detectChanges();
      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(dichas.join(' ')).toContain('Nombre completo, campo de texto');
    });

    it('lee la página completa con el botón', async () => {
      const { fixture, el, main } = await montar();
      main.innerHTML = '<h1>Preinscripción</h1><p>Complete sus datos.</p>';
      TestBed.inject(LecturaVoz).activar();
      fixture.detectChanges();
      dichas.length = 0;
      const botones = [...el.querySelectorAll<HTMLButtonElement>('button')];
      botones.find((b) => b.textContent?.includes('Leer esta página'))!.click();
      expect(dichas.join(' ')).toContain('Preinscripción. Complete sus datos.');
    });

    it('el atajo Alt + Mayús + L alterna la lectura', async () => {
      await montar();
      const voz = TestBed.inject(LecturaVoz);
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'L', altKey: true, shiftKey: true }),
      );
      expect(voz.activa()).toBe(true);
    });

    it('lee los errores que aparecen mientras la lectura está activa', async () => {
      const { main } = await montar();
      TestBed.inject(LecturaVoz).activar();
      dichas.length = 0;
      const aviso = document.createElement('p');
      aviso.setAttribute('role', 'alert');
      aviso.textContent = 'Revise el correo electrónico';
      main.appendChild(aviso);
      await Promise.resolve();
      await new Promise((r) => setTimeout(r));
      expect(dichas.join(' ')).toContain('Revise el correo electrónico');
    });

    it('al cambiar de pantalla dice su título', async () => {
      const { main } = await montar();
      main.innerHTML = '<h1>Consulta de estado</h1>';
      TestBed.inject(LecturaVoz).activar();
      dichas.length = 0;
      await TestBed.inject(Router).navigateByUrl('/consulta');
      await new Promise((r) => setTimeout(r, 450));
      expect(dichas.join(' ')).toContain('Consulta de estado');
    });
  });
});
