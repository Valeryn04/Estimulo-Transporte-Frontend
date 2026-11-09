import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { LecturaVoz, PREGUNTA_INICIAL, describirControl, textoDePagina } from './lectura-voz';
import { LecturaVozBarra, RETRASO_ENTRADA } from './lectura-voz-barra';
import { ReconocimientoVoz, ResultadoEscucha } from './reconocimiento-voz';

/** Voz simulada: guarda lo que se «dice» y permite comprobar que se corta lo anterior. */
class Enunciado {
  lang = '';
  voice: unknown = null;
  rate = 1;
  volume = 0.5;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

const dichas: string[] = [];
const ajustes: { volume: number; voz: string }[] = [];
const cancelar = vi.fn();
/** Simula un navegador que no deja hablar antes del primer toque. */
let bloqueada = false;
const sintesis = {
  speak: (u: Enunciado) => {
    if (bloqueada) {
      u.onerror?.();
      return;
    }
    dichas.push(u.text);
    ajustes.push({ volume: u.volume, voz: (u.voice as { name: string } | null)?.name ?? '' });
    u.onstart?.();
    u.onend?.();
  },
  cancel: () => {
    cancelar();
  },
  getVoices: () => [
    { lang: 'en-US', name: 'Ingles' },
    { lang: 'es-MX', name: 'Mexico' },
    { lang: 'es-ES', name: 'Microsoft Elvira Online (Natural)' },
    { lang: 'es-CO', name: 'Colombia' },
  ],
};

/** Micrófono simulado: contesta lo que se le indique, en orden. */
const respuestas: ResultadoEscucha[] = [];
/** Lo que dice la persona, tal como lo devuelve el reconocimiento de voz. */
const dice = (texto: string): ResultadoEscucha => ({ ok: true, texto, alternativas: [texto] });
const reconocimiento = {
  soportado: true,
  parcial: signal(''),
  escuchar: vi.fn(() =>
    Promise.resolve(respuestas.shift() ?? ({ ok: false, motivo: 'sin-voz' } as ResultadoEscucha)),
  ),
  cancelar: vi.fn(),
};

@Component({ template: '' })
class Vacia {}

describe('lectura en voz alta', () => {
  beforeEach(() => {
    dichas.length = 0;
    ajustes.length = 0;
    respuestas.length = 0;
    bloqueada = false;
    reconocimiento.soportado = true;
    reconocimiento.escuchar.mockClear();
    reconocimiento.cancelar.mockClear();
    cancelar.mockClear();
    localStorage.clear();
    vi.stubGlobal('SpeechSynthesisUtterance', Enunciado);
    Object.defineProperty(window, 'speechSynthesis', { value: sintesis, configurable: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'speechSynthesis');
    document.body.innerHTML = '';
    // Otras pruebas comprueban que no quede nada guardado en el navegador.
    localStorage.clear();
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

    it('la etiqueta se lee limpia y la ayuda («?») se dice aparte, después del nombre', () => {
      const d = fragmento(`
        <app-campo>
          <label for="n">Nombre completo <span aria-hidden="true">*</span>
            <app-ayuda><button type="button" aria-label="Ayuda: nombre"></button>
              <span role="tooltip">Escriba el nombre como aparece en su documento.</span></app-ayuda>
          </label>
          <input id="n" type="text" />
        </app-campo>`);
      expect(describirControl(d.querySelector('input')!)).toBe(
        'Nombre completo, campo de texto. Ayuda: Escriba el nombre como aparece en su documento.',
      );
    });

    it('no repite «obligatorio» cuando la etiqueta ya lo trae', () => {
      const d = fragmento(
        '<label for="x">Nombre <span class="solo-lectores">(obligatorio)</span></label><input id="x" required />',
      );
      expect(describirControl(d.querySelector('input')!)).toBe(
        'Nombre, campo de texto, obligatorio',
      );
    });

    it('lee el valor ya escrito, salvo en contraseñas', () => {
      const d = fragmento(`
        <label for="n">Nombre</label><input id="n" type="text" value="María" />
        <label for="p">Clave</label><input id="p" type="password" value="secreta" />`);
      expect(describirControl(d.querySelector('#n')!)).toContain('escrito: María');
      expect(describirControl(d.querySelector('#p')!)).not.toContain('secreta');
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

  describe('textoDePagina', () => {
    it('junta títulos, preguntas y párrafos sin repetir', () => {
      const d = fragmento(
        '<h1>Preinscripción</h1><p>Complete sus datos.</p><label>Nombre</label><p>Complete sus datos.</p>',
      );
      expect(textoDePagina(d)).toBe('Preinscripción. Complete sus datos. Nombre.');
    });

    it('lee el título limpio y su ayuda a continuación', () => {
      const d = fragmento(
        '<h1>Preinscripción <app-ayuda><span role="tooltip">Es el primer paso.</span></app-ayuda></h1>',
      );
      expect(textoDePagina(d)).toBe('Preinscripción. Es el primer paso.');
    });
  });

  describe('servicio', () => {
    it('al principio no se sabe si la persona la necesita: se le pregunta', () => {
      const voz = TestBed.inject(LecturaVoz);
      expect(voz.decidida()).toBe(false);
      expect(voz.activa()).toBe(false);
    });

    it('recuerda lo que la persona respondió', () => {
      localStorage.setItem('lectura_voz_activa', '1');
      expect(TestBed.inject(LecturaVoz).activa()).toBe(true);
      expect(TestBed.inject(LecturaVoz).decidida()).toBe(true);
      localStorage.setItem('lectura_voz_activa', '0');
      TestBed.resetTestingModule();
      const voz = TestBed.inject(LecturaVoz);
      expect(voz.activa()).toBe(false);
      expect(voz.decidida()).toBe(true);
    });

    it('fijar guarda la respuesta; decir que no calla todo', () => {
      const voz = TestBed.inject(LecturaVoz);
      voz.fijar(true);
      expect(localStorage.getItem('lectura_voz_activa')).toBe('1');
      voz.asistenteSolicitado.set(true);
      voz.fijar(false);
      expect(voz.activa()).toBe(false);
      expect(voz.decidida()).toBe(true);
      expect(voz.asistenteSolicitado()).toBe(false);
      expect(localStorage.getItem('lectura_voz_activa')).toBe('0');
    });

    it('elige una voz en español y dice el texto cortando lo anterior', () => {
      TestBed.inject(LecturaVoz).hablar('Hola');
      expect(cancelar).toHaveBeenCalled();
      expect(dichas).toEqual(['Hola']);
    });

    it('habla al máximo volumen y prefiere una voz «Natural» o de la nube sobre la del sistema', () => {
      TestBed.inject(LecturaVoz).hablar('Hola');
      expect(ajustes).toEqual([{ volume: 1, voz: 'Microsoft Elvira Online (Natural)' }]);
    });

    it('un texto largo se parte en frases cortas', () => {
      const voz = TestBed.inject(LecturaVoz);
      voz.hablar(Array.from({ length: 12 }, (_, i) => `Esta es la frase número ${i}.`).join(' '));
      expect(dichas.length).toBeGreaterThan(1);
      expect(dichas.every((t) => t.length <= 190)).toBe(true);
    });

    it('decir devuelve una promesa que termina cuando acaba la voz', async () => {
      await expect(TestBed.inject(LecturaVoz).decir('Una pregunta.')).resolves.toBeUndefined();
      expect(dichas).toEqual(['Una pregunta.']);
    });

    it('sin voz en el navegador no falla', async () => {
      Reflect.deleteProperty(window, 'speechSynthesis');
      const voz = new (LecturaVoz as unknown as new () => LecturaVoz)();
      expect(voz.soportado).toBe(false);
      expect(() => voz.hablar('Hola')).not.toThrow();
      await expect(voz.decir('Hola')).resolves.toBeUndefined();
    });
  });

  describe('pregunta inicial y barra', () => {
    async function montar() {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '**', component: Vacia }]),
          { provide: ReconocimientoVoz, useValue: reconocimiento },
        ],
      });
      const main = document.createElement('main');
      document.body.appendChild(main);
      const fixture = TestBed.createComponent(LecturaVozBarra);
      document.body.appendChild(fixture.nativeElement);
      fixture.detectChanges();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const espera = (ms = RETRASO_ENTRADA + 150) => new Promise((r) => setTimeout(r, ms));
      return { fixture, el, main, espera, voz: TestBed.inject(LecturaVoz) };
    }

    const botones = (el: HTMLElement) => [
      ...el.querySelectorAll<HTMLButtonElement>('.tamiz button'),
    ];

    it('la primera vez muestra la pregunta con dos botones grandes y no habla de teclas', async () => {
      const { el } = await montar();
      expect(el.querySelector('[role="dialog"]')?.textContent).toContain(
        'persona con discapacidad visual',
      );
      expect(botones(el).map((b) => b.textContent!.trim())).toEqual([
        'Sí, necesito que me lean el formulario',
        'No, lo lleno yo',
      ]);
      expect(el.textContent).not.toMatch(/\bTab\b/);
    });

    it('al entrar la dice sola si el navegador lo permite, y escucha la respuesta', async () => {
      respuestas.push(dice('sí'));
      const { espera, voz } = await montar();
      await espera();
      expect(dichas.join(' ')).toContain(PREGUNTA_INICIAL);
      await espera(50);
      expect(voz.activa()).toBe(true);
      expect(voz.asistenteSolicitado()).toBe(true);
    });

    it('si el navegador la bloquea, la dice con el primer toque fuera de los botones', async () => {
      bloqueada = true;
      respuestas.push(dice('no gracias'));
      const { espera, voz } = await montar();
      await espera();
      expect(dichas).toEqual([]);
      bloqueada = false;
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await espera(100);
      expect(dichas.join(' ')).toContain(PREGUNTA_INICIAL);
      expect(voz.decidida()).toBe(true);
      expect(voz.activa()).toBe(false);
    });

    it('con la primera tecla también se presenta (quien usa teclado)', async () => {
      bloqueada = true;
      const { espera } = await montar();
      await espera();
      bloqueada = false;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await espera(50);
      expect(dichas.join(' ')).toContain(PREGUNTA_INICIAL);
    });

    it('un toque sobre un botón no cuenta como contacto: solo responde si se pulsa', async () => {
      bloqueada = true;
      const { el, espera, voz } = await montar();
      await espera();
      bloqueada = false;
      botones(el)[0]!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await espera(50);
      expect(dichas).toEqual([]);
      expect(voz.decidida()).toBe(false);
    });

    it('el botón «No» deja todo manual y en silencio, y lo recuerda', async () => {
      const { fixture, el, voz } = await montar();
      botones(el)[1]!.click();
      fixture.detectChanges();
      expect(voz.decidida()).toBe(true);
      expect(voz.activa()).toBe(false);
      expect(voz.asistenteSolicitado()).toBe(false);
      expect(el.querySelector('[role="dialog"]')).toBeNull();
      expect(localStorage.getItem('lectura_voz_activa')).toBe('0');
      expect(reconocimiento.cancelar).toHaveBeenCalled();
    });

    it('el botón «Sí» activa la lectura, pide el asistente y lo recuerda', async () => {
      const { fixture, el, voz } = await montar();
      botones(el)[0]!.click();
      fixture.detectChanges();
      expect(voz.activa()).toBe(true);
      expect(voz.asistenteSolicitado()).toBe(true);
      expect(localStorage.getItem('lectura_voz_activa')).toBe('1');
      expect(el.querySelector('[role="dialog"]')).toBeNull();
    });

    it('si no la entiende, vuelve a preguntar y al final le dice cómo usar los botones', async () => {
      respuestas.push(dice('qué dice'), { ok: false, motivo: 'sin-voz' });
      const { espera, voz } = await montar();
      await espera(RETRASO_ENTRADA + 400);
      expect(dichas.join(' ')).toContain('No le entendí. Diga sí o no.');
      expect(dichas.join(' ')).toContain('toque el botón de arriba');
      expect(voz.decidida()).toBe(false);
    });

    it('sin micrófono en el navegador no escucha, pero los botones siguen respondiendo', async () => {
      reconocimiento.soportado = false;
      const { el, espera, voz } = await montar();
      await espera(RETRASO_ENTRADA + 300);
      expect(reconocimiento.escuchar).not.toHaveBeenCalled();
      botones(el)[0]!.click();
      expect(voz.activa()).toBe(true);
    });

    it('Alt + Mayús + L contesta que sí desde el teclado', async () => {
      const { voz } = await montar();
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'L', altKey: true, shiftKey: true }),
      );
      expect(voz.activa()).toBe(true);
    });

    describe('cuando la persona ya dijo que sí', () => {
      beforeEach(() => localStorage.setItem('lectura_voz_activa', '1'));

      it('no vuelve a preguntar y no muestra botones: todo es por voz', async () => {
        const { el } = await montar();
        expect(el.querySelector('[role="dialog"]')).toBeNull();
        expect(el.querySelectorAll('button')).toHaveLength(0);
        expect(el.textContent).not.toContain('Desactivar lectura');
        expect(el.textContent).not.toContain('Leer esta página');
      });

      it('al entrar a una pantalla lee su título y su introducción (y la bienvenida la primera vez)', async () => {
        const { main, espera } = await montar();
        main.innerHTML =
          '<h1>Consulta <app-ayuda><span role="tooltip">Vea el estado.</span></app-ayuda></h1>' +
          '<p>Escriba su documento para consultar la solicitud.</p>';
        await espera();
        const dicho = dichas.join(' ');
        expect(dicho).toContain('Bienvenido de nuevo');
        expect(dicho).toContain('Consulta. Vea el estado.');
        expect(dicho).toContain('Escriba su documento para consultar la solicitud.');
        expect(dicho).not.toMatch(/\bTab\b/);
      });

      it('si la pantalla tiene asistente por voz, la lectura de entrada la hace él', async () => {
        const { main, espera, voz } = await montar();
        voz.asistenteEnPagina.set(true);
        main.innerHTML = '<h1>Preinscripción</h1>';
        await espera();
        expect(dichas).toEqual([]);
      });

      it('si el navegador bloquea la voz al entrar, la dice con el primer toque', async () => {
        bloqueada = true;
        const { main, espera } = await montar();
        main.innerHTML = '<h1>Consulta de estado</h1><p>Escriba su documento para consultar.</p>';
        await espera();
        expect(dichas).toEqual([]);
        bloqueada = false;
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(dichas.join(' ')).toContain('Consulta de estado');
      });

      it('al cambiar de pantalla dice su título', async () => {
        const { main, espera } = await montar();
        main.innerHTML = '<h1>Consulta de estado</h1>';
        await espera();
        dichas.length = 0;
        main.innerHTML = '<h1>Verificar el correo</h1>';
        await TestBed.inject(Router).navigateByUrl('/verificar');
        await espera();
        expect(dichas.join(' ')).toContain('Verificar el correo');
      });

      it('dice el nombre de cada campo al enfocarlo, con su ayuda', async () => {
        const { main, espera } = await montar();
        await espera();
        main.innerHTML =
          '<h1>Preinscripción</h1><label for="a">Nombre completo</label><input id="a" type="text" />';
        dichas.length = 0;
        main.querySelector('input')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        expect(dichas.join(' ')).toContain('Nombre completo, campo de texto');
      });

      it('en una pantalla que no es el menú, después de leerla pregunta si quiere volver al menú y vuelve', async () => {
        respuestas.push(dice('sí, por favor'));
        const { main, espera } = await montar();
        const router = TestBed.inject(Router);
        await router.navigateByUrl('/consulta');
        const ir = vi.spyOn(router, 'navigateByUrl');
        main.innerHTML = '<h1>Consultar el estado</h1><p>Escriba su documento para consultar.</p>';
        await espera(RETRASO_ENTRADA + 500);
        expect(dichas.join(' ')).toContain('¿Quiere volver al menú principal?');
        expect(ir).toHaveBeenCalledWith('/');
      });

      it('si dice que no, se queda y se lo vuelve a ofrecer con el siguiente toque', async () => {
        respuestas.push(dice('no'));
        const { main, espera } = await montar();
        await TestBed.inject(Router).navigateByUrl('/consulta');
        main.innerHTML = '<h1>Consultar el estado</h1><p>Escriba su documento para consultar.</p>';
        await espera(RETRASO_ENTRADA + 500);
        expect(dichas.join(' ')).toContain('me quedo aquí');
        dichas.length = 0;
        respuestas.push(dice('sí'));
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        await espera(200);
        expect(dichas.join(' ')).toContain('¿Quiere volver al menú principal?');
      });

      it('en el inicio no pregunta por el menú: ya está en él', async () => {
        const { main, espera } = await montar();
        main.innerHTML =
          '<h1>Estímulo Social de Transporte</h1><p>Programa de la Alcaldía de Barranquilla.</p>';
        await espera(RETRASO_ENTRADA + 300);
        expect(dichas.join(' ')).not.toContain('volver al menú');
      });

      it('lee los errores que aparecen mientras la lectura está activa', async () => {
        const { main, espera } = await montar();
        await espera();
        dichas.length = 0;
        const aviso = document.createElement('p');
        aviso.setAttribute('role', 'alert');
        aviso.textContent = 'Revise el correo electrónico';
        main.appendChild(aviso);
        await new Promise((r) => setTimeout(r));
        expect(dichas.join(' ')).toContain('Revise el correo electrónico');
      });

      it('el atajo Alt + Mayús + L la desactiva y vuelve a activarla', async () => {
        const { voz } = await montar();
        const atajo = () =>
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'L', altKey: true, shiftKey: true }),
          );
        atajo();
        expect(voz.activa()).toBe(false);
        atajo();
        expect(voz.activa()).toBe(true);
      });
    });

    it('si la persona dijo que no, no lee nada al entrar, pero puede activar la lectura', async () => {
      localStorage.setItem('lectura_voz_activa', '0');
      const { el, fixture, main, espera, voz } = await montar();
      expect(el.querySelector('.barra-voz button')?.textContent).toContain(
        'Activar lectura en voz alta',
      );
      el.querySelector<HTMLButtonElement>('.barra-voz button')!.click();
      fixture.detectChanges();
      expect(voz.activa()).toBe(true);
      expect(el.querySelectorAll('button')).toHaveLength(0);
      voz.desactivar();
      dichas.length = 0;
      main.innerHTML = '<h1>Consulta de estado</h1><p>Escriba su documento para consultar.</p>';
      await espera();
      expect(dichas).toEqual([]);
    });
  });
});
