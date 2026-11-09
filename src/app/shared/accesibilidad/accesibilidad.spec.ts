import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import axe from 'axe-core';
import { Accesibilidad } from './accesibilidad';
import { ModoAccesible } from './modo-accesible';

@Component({ template: '' })
class Vacia {}

describe('accesibilidad del portal ciudadano', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-modo-accesible');
  });
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-modo-accesible');
    // Otras pruebas comprueban que no quede nada guardado en el navegador.
    localStorage.clear();
  });

  async function montar() {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Vacia }])],
    });
    // El marco de la página: lo que se deja inerte mientras la pregunta está abierta.
    document.body.innerHTML =
      '<a class="saltar" href="#c">Saltar</a><header>Cabecera</header><main id="c"><h1>Inicio</h1></main>';
    const fixture = TestBed.createComponent(Accesibilidad);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));
    return { fixture, el, espera, modo: TestBed.inject(ModoAccesible) };
  }

  describe('la pregunta inicial', () => {
    it('el foco va al título de la pregunta y el lector lee solo lo que dice: sin rol de «ventana»', async () => {
      const { el, espera } = await montar();
      await espera();
      const titulo = el.querySelector('h2')!;
      expect(titulo.textContent).toContain('¿Es usted una persona con discapacidad visual?');
      expect(document.activeElement).toBe(titulo);
      // Nada que el lector anuncie de más: ni «ventana», ni regiones, ni avisos en vivo.
      expect(el.querySelector('[role], [aria-modal], [aria-live], [aria-label]')).toBeNull();
      const texto = el.querySelector('p')!.textContent!;
      expect(texto).toContain('VoiceOver');
      expect(texto).toContain('TalkBack');
      expect([...el.querySelectorAll('button')].map((b) => b.textContent!.trim())).toEqual([
        'Sí, activar el modo accesible',
        'No, continuar normalmente',
      ]);
    });

    it('mientras está abierta, el resto de la página queda inerte (no se alcanza ni se lee)', async () => {
      const { el, fixture } = await montar();
      fixture.detectChanges();
      for (const s of ['header', 'main', '.saltar']) {
        expect(document.querySelector(s)!.hasAttribute('inert'), s).toBe(true);
      }
      el.querySelectorAll<HTMLButtonElement>('button')[1]!.click();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 20));
      for (const s of ['header', 'main', '.saltar']) {
        expect(document.querySelector(s)!.hasAttribute('inert'), s).toBe(false);
      }
    });

    it('no habla ni usa teclas: no pone su propia voz encima de la del lector de pantalla', async () => {
      const { el } = await montar();
      expect(el.textContent).not.toMatch(/\b(Alt|Mayús|Tab)\b/);
    });

    it('con «Sí» activa el modo accesible, lo recuerda y devuelve el foco al título de la página, sin avisos aparte', async () => {
      const { el, fixture, espera, modo } = await montar();
      el.querySelectorAll<HTMLButtonElement>('button')[0]!.click();
      fixture.detectChanges();
      await espera(200);
      expect(modo.activo()).toBe(true);
      expect(localStorage.getItem('modo_accesible')).toBe('1');
      expect(document.documentElement.hasAttribute('data-modo-accesible')).toBe(true);
      expect(el.querySelector('h2')).toBeNull();
      expect(el.querySelector('[aria-live], [role="status"]')).toBeNull();
      expect(document.activeElement).toBe(document.querySelector('main h1'));
    });

    it('con «No» sigue todo normal, lo recuerda y deja un enlace para activarlo después', async () => {
      const { el, fixture, modo } = await montar();
      el.querySelectorAll<HTMLButtonElement>('button')[1]!.click();
      fixture.detectChanges();
      expect(modo.activo()).toBe(false);
      expect(modo.respondida()).toBe(true);
      expect(localStorage.getItem('modo_accesible')).toBe('0');
      expect(document.documentElement.hasAttribute('data-modo-accesible')).toBe(false);
      const enlace = [...el.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Activar el modo accesible'),
      )!;
      enlace.click();
      fixture.detectChanges();
      expect(modo.activo()).toBe(true);
    });

    it('si ya contestó, no vuelve a preguntar y aplica lo que eligió', async () => {
      localStorage.setItem('modo_accesible', '1');
      const { el, modo } = await montar();
      expect(modo.respondida()).toBe(true);
      expect(el.querySelector('h2')).toBeNull();
      expect(document.documentElement.hasAttribute('data-modo-accesible')).toBe(true);
    });
  });

  describe('cambio de pantalla', () => {
    it('pasa el foco al título de la pantalla nueva, y no agrega un aviso que lo repita', async () => {
      localStorage.setItem('modo_accesible', '0');
      const { el, espera } = await montar();
      document.title = 'Consultar el estado · Estímulo Social de Transporte';
      document.querySelector('main')!.innerHTML = '<h1>Consultar el estado</h1>';
      await TestBed.inject(Router).navigateByUrl('/consulta');
      await espera(350);
      expect(document.activeElement).toBe(document.querySelector('main h1'));
      expect(el.querySelector('[aria-live], [role="status"]')).toBeNull();
    });
  });

  describe('la revisión automática detecta fallos de verdad', () => {
    it('un campo sin etiqueta y un botón sin nombre se detectan', async () => {
      const div = document.createElement('div');
      div.innerHTML = '<input type="text" /><button></button><img src="x.png" />';
      document.body.appendChild(div);
      const r = await axe.run(div, {
        runOnly: { type: 'tag', values: ['wcag2a'] },
        rules: { 'color-contrast': { enabled: false } },
      });
      const ids = r.violations.map((v) => v.id);
      expect(ids).toEqual(expect.arrayContaining(['label', 'button-name', 'image-alt']));
    });
  });
});
