import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { LecturaVoz } from '../../../../shared/lectura-voz/lectura-voz';
import {
  ReconocimientoVoz,
  ResultadoEscucha,
} from '../../../../shared/lectura-voz/reconocimiento-voz';
import { MenuVoz } from './menu-voz';

class Enunciado {
  lang = '';
  voice: unknown = null;
  rate = 1;
  volume = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

const dichas: string[] = [];
const sintesis = {
  speak: (u: Enunciado) => {
    dichas.push(u.text);
    u.onstart?.();
    u.onend?.();
  },
  cancel: () => undefined,
  getVoices: () => [],
};

const respuestas: ResultadoEscucha[] = [];
const reconocimiento = {
  soportado: true,
  parcial: signal(''),
  escuchar: vi.fn(() =>
    Promise.resolve(respuestas.shift() ?? ({ ok: false, motivo: 'sin-voz' } as ResultadoEscucha)),
  ),
  cancelar: vi.fn(),
};
const dice = (texto: string): ResultadoEscucha => ({ ok: true, texto, alternativas: [texto] });

describe('MenuVoz', () => {
  beforeEach(() => {
    dichas.length = 0;
    respuestas.length = 0;
    reconocimiento.soportado = true;
    reconocimiento.escuchar.mockClear();
    localStorage.clear();
    localStorage.setItem('lectura_voz_activa', '1');
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

  async function montar() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ReconocimientoVoz, useValue: reconocimiento }],
    });
    const router = TestBed.inject(Router);
    const ir = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(MenuVoz);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const voz = TestBed.inject(LecturaVoz);
    voz.gestoHecho = true;
    const hasta = async (condicion: () => boolean, ms = 3000) => {
      const limite = Date.now() + ms;
      while (!condicion() && Date.now() < limite) {
        fixture.detectChanges();
        await new Promise((r) => setTimeout(r, 10));
      }
      fixture.detectChanges();
    };
    const empezar = () => {
      voz.asistenteSolicitado.set(true);
      fixture.detectChanges();
    };
    return { fixture, el, ir, voz, hasta, empezar };
  }

  it('lee el menú con sus seis opciones y escucha la elección', async () => {
    respuestas.push(dice('consultar el estado de mi solicitud'));
    const { el, ir, hasta, empezar } = await montar();
    empezar();
    await hasta(() => ir.mock.calls.length > 0);
    const todo = dichas.join(' ');
    expect(todo).toContain('la preinscripción no equivale a la aprobación del beneficio');
    expect(todo).toContain('¿Qué desea hacer?');
    for (const parte of [
      '1, preinscribirse',
      '2, continuar con la caracterización y los documentos',
      '3, consultar el estado de su solicitud',
      '4, recibir de nuevo el correo de verificación',
      '5, escuchar la guía paso a paso',
      '6, apagar la voz',
    ]) {
      expect(todo, parte).toContain(parte);
    }
    expect(todo).toContain('Abriendo: Consultar el estado de mi solicitud.');
    expect(ir).toHaveBeenCalledWith('/consulta');
    expect(el.querySelector('.menu')).toBeNull();
  });

  it('se elige también por el número', async () => {
    respuestas.push(dice('uno'));
    const { ir, hasta, empezar } = await montar();
    empezar();
    await hasta(() => ir.mock.calls.length > 0);
    expect(ir).toHaveBeenCalledWith('/preinscripcion');
  });

  it('«apagar la voz» deja todo manual y no abre ninguna pantalla', async () => {
    respuestas.push(dice('apagar la voz'));
    const { el, ir, voz, hasta, empezar } = await montar();
    empezar();
    await hasta(() => !voz.activa());
    expect(voz.activa()).toBe(false);
    expect(ir).not.toHaveBeenCalled();
    expect(el.querySelector('.menu')).toBeNull();
  });

  it('si no la entiende, vuelve a preguntar; al final le dice que use los botones, que también funcionan', async () => {
    respuestas.push(dice('qué'), dice('mmm'), dice('no sé'));
    const { el, ir, hasta, empezar } = await montar();
    empezar();
    await hasta(() => dichas.join(' ').includes('Use los botones grandes'));
    expect(dichas.join(' ')).toContain('No le entendí.');
    const botones = [...el.querySelectorAll<HTMLButtonElement>('.lista button')];
    expect(botones).toHaveLength(6);
    botones[3]!.click();
    await hasta(() => ir.mock.calls.length > 0);
    expect(ir).toHaveBeenCalledWith('/reenviar-verificacion');
  });

  it('si el micrófono falla (permiso, internet…), le dice cuál es el problema y sigue con los botones', async () => {
    respuestas.push({ ok: false, motivo: 'permiso' });
    const { el, ir, hasta, empezar } = await montar();
    empezar();
    await hasta(() => dichas.join(' ').includes('No tengo permiso para usar el micrófono'));
    expect(dichas.join(' ')).toContain('toque Permitir');
    expect(dichas.join(' ')).not.toContain('No le entendí');
    // Ya no sigue intentando escuchar: se escoge con los botones.
    await hasta(() => el.querySelectorAll('.lista button').length === 6);
    el.querySelectorAll<HTMLButtonElement>('.lista button')[2]!.click();
    await hasta(() => ir.mock.calls.length > 0);
    expect(ir).toHaveBeenCalledWith('/consulta');
    expect(reconocimiento.escuchar).toHaveBeenCalledTimes(1);
  });

  it('usa todas las interpretaciones del navegador: si la primera no se entiende, prueba la siguiente', async () => {
    respuestas.push({ ok: true, texto: 'tras', alternativas: ['tras', 'tres'] });
    const { ir, hasta, empezar } = await montar();
    empezar();
    await hasta(() => ir.mock.calls.length > 0);
    expect(ir).toHaveBeenCalledWith('/consulta');
  });

  it('sin micrófono no escucha: se escoge con los botones grandes', async () => {
    reconocimiento.soportado = false;
    const { el, ir, hasta, empezar } = await montar();
    empezar();
    await hasta(() => el.querySelectorAll('.lista button').length === 6);
    expect(reconocimiento.escuchar).not.toHaveBeenCalled();
    el.querySelectorAll<HTMLButtonElement>('.lista button')[4]!.click();
    await hasta(() => ir.mock.calls.length > 0);
    expect(ir).toHaveBeenCalledWith('/ayuda');
  });

  it('avisa a la barra que aquí habla el menú, para que no lea la pantalla dos veces', async () => {
    const { voz } = await montar();
    expect(voz.asistenteEnPagina()).toBe(true);
  });

  it('si la persona ya había pedido la lectura, el menú empieza con su primer toque', async () => {
    respuestas.push(dice('tres'));
    const { ir, hasta, voz } = await montar();
    voz.gestoHecho = false;
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await hasta(() => ir.mock.calls.length > 0);
    expect(ir).toHaveBeenCalledWith('/consulta');
  });
});
