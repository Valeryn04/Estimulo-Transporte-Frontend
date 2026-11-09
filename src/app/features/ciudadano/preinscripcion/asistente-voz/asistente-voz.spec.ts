import { ComponentRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { vi } from 'vitest';
import { LecturaVoz } from '../../../../shared/lectura-voz/lectura-voz';
import {
  ReconocimientoVoz,
  ResultadoEscucha,
} from '../../../../shared/lectura-voz/reconocimiento-voz';
import { AsistenteVoz, ControlesPreinscripcion } from './asistente-voz';

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

const TIPOS = [
  { id: 1, codigo: 'CC', nombre: 'Cédula de Ciudadanía' },
  { id: 2, codigo: 'TI', nombre: 'Tarjeta de Identidad' },
  { id: 3, codigo: 'PA', nombre: 'Pasaporte' },
];

const crearFormulario = () =>
  new FormGroup({
    diligencia: new FormControl<'PCD' | 'CUIDADOR' | null>(null),
    agregaCuidador: new FormControl<boolean | null>(null),
    pcdNombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    pcdTipoIdentificacionId: new FormControl<number | null>(null),
    pcdNumero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6,12}$/)],
    }),
    cuidadorNombre: new FormControl('', { nonNullable: true }),
    cuidadorTipoIdentificacionId: new FormControl<number | null>(null),
    cuidadorNumero: new FormControl('', { nonNullable: true }),
    cuidadorEsPcd: new FormControl<boolean | null>(null),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    correoConfirmacion: new FormControl('', { nonNullable: true }),
    aceptaAutorizacion: new FormControl(false, { nonNullable: true }),
  });

/** Toca «Salir del asistente». */
const salir = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLButtonElement>('.fila button')]
    .find((b) => b.textContent?.includes('Salir'))
    ?.click();

describe('AsistenteVoz', () => {
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

  async function montar(autorizacion: string | null = null) {
    TestBed.configureTestingModule({
      providers: [{ provide: ReconocimientoVoz, useValue: reconocimiento }],
    });
    const form = crearFormulario();
    const fixture = TestBed.createComponent(AsistenteVoz);
    const ref = fixture.componentRef as ComponentRef<AsistenteVoz>;
    ref.setInput('form', form as unknown as ControlesPreinscripcion);
    ref.setInput('tipos', TIPOS);
    ref.setInput('autorizacion', autorizacion);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const enviar = vi.fn();
    fixture.componentInstance.enviar.subscribe(enviar);
    const hasta = async (condicion: () => boolean, ms = 3000) => {
      const limite = Date.now() + ms;
      while (!condicion() && Date.now() < limite) {
        fixture.detectChanges();
        await new Promise((r) => setTimeout(r, 10));
      }
      fixture.detectChanges();
    };
    /** Escribe en el recuadro de un dato sensible y toca «Listo». */
    const escribir = async (valor: string) => {
      await hasta(() => !!el.querySelector('#as-sensible'));
      const input = el.querySelector<HTMLInputElement>('#as-sensible')!;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
      [...el.querySelectorAll<HTMLButtonElement>('button')]
        .find((b) => b.textContent?.includes('Listo'))!
        .click();
    };
    return { fixture, form, el, enviar, hasta, escribir, voz: TestBed.inject(LecturaVoz) };
  }

  it('si la persona pidió la lectura, ofrece el botón para empezar; si dijo que no, no aparece', async () => {
    const { el } = await montar();
    expect(el.textContent).toContain('Llenar la preinscripción con ayuda de voz');
    localStorage.setItem('lectura_voz_activa', '0');
    TestBed.resetTestingModule();
    const otro = await montar();
    expect(otro.el.textContent).not.toContain('ayuda de voz');
  });

  it('hace la preinscripción completa hablando, salvo el número de documento que se escribe', async () => {
    respuestas.push(
      dice('sí'), // ¿es la persona con discapacidad?
      dice('no'), // ¿agrega cuidador?
      dice('maría fernanda pérez'),
      dice('sí'), // confirma el nombre
      dice('cédula de ciudadanía'),
      dice('sí'), // confirma el tipo
      dice('sí'), // confirma el número escrito
      dice('maria arroba gmail punto com'),
      dice('sí'), // confirma el correo
      dice('sí'), // autoriza los datos
      dice('sí'), // envía
    );
    const { fixture, form, el, enviar, hasta, escribir, voz } = await montar(
      'Autorizo el tratamiento de mis datos personales.',
    );
    el.querySelector<HTMLButtonElement>('.lanzador button')!.click();
    fixture.detectChanges();
    await escribir('1045678901');
    // La lectura de la autorización se puede saltar con su botón.
    await hasta(() => !!el.textContent?.includes('Saltar la lectura'));
    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Saltar la lectura'))
      ?.click();
    await hasta(() => enviar.mock.calls.length > 0, 5000);

    const v = form.getRawValue();
    expect(v).toMatchObject({
      diligencia: 'PCD',
      agregaCuidador: false,
      pcdNombre: 'María Fernanda Pérez',
      pcdTipoIdentificacionId: 1,
      pcdNumero: '1045678901',
      correo: 'maria@gmail.com',
      correoConfirmacion: 'maria@gmail.com',
      aceptaAutorizacion: true,
    });
    expect(enviar).toHaveBeenCalledTimes(1);
    const todo = dichas.join(' ');
    // La cédula nunca se pidió por voz: se pidió escribirla y se repitió dígito por dígito.
    expect(todo).toContain('Por su seguridad, este dato no lo escucho');
    expect(todo).toContain('Escribió: 1, 0, 4, 5, 6, 7, 8, 9, 0, 1');
    expect(todo).toContain(
      'Entendí: maría fernanda pérez'.replace('maría fernanda pérez', 'María Fernanda Pérez'),
    );
    expect(todo).toContain('Entendí: m, a, r, i, a, arroba');
    expect(voz.asistenteEnPagina()).toBe(true);
  });

  it('si no entiende, vuelve a preguntar y no llena nada con lo que no entendió', async () => {
    respuestas.push(dice('qué'), dice('sí'), dice('no'));
    const { form, el, hasta } = await montar();
    el.querySelector<HTMLButtonElement>('.lanzador button')!.click();
    await hasta(() => form.controls.agregaCuidador.value === false);
    salir(el);
    expect(dichas.join(' ')).toContain('No le entendí.');
    expect(form.controls.diligencia.value).toBe('PCD');
  });

  it('también se contesta con los botones grandes, sin hablar', async () => {
    reconocimiento.soportado = false;
    const { fixture, form, el, hasta } = await montar();
    el.querySelector<HTMLButtonElement>('.lanzador button')!.click();
    fixture.detectChanges();
    const tocar = async (texto: string) => {
      await hasta(() =>
        [...el.querySelectorAll('.grande')].some((b) => b.textContent?.trim() === texto),
      );
      [...el.querySelectorAll<HTMLButtonElement>('.grande')]
        .find((b) => b.textContent?.trim() === texto)!
        .click();
    };
    await tocar('No'); // no es la persona con discapacidad: es el cuidador
    await hasta(() => form.controls.diligencia.value === 'CUIDADOR');
    expect(form.controls.diligencia.value).toBe('CUIDADOR');
    expect(reconocimiento.escuchar).not.toHaveBeenCalled();
    salir(el);
  });

  it('un dato sensible inválido se rechaza y se pide de nuevo', async () => {
    respuestas.push(
      dice('sí'),
      dice('no'),
      dice('Ana Gómez'),
      dice('sí'),
      dice('pasaporte'),
      dice('sí'),
      dice('sí'),
    );
    const { form, el, hasta, escribir } = await montar();
    el.querySelector<HTMLButtonElement>('.lanzador button')!.click();
    await escribir('12'); // muy corto
    await hasta(() => dichas.join(' ').includes('Ese dato no es válido'));
    expect(dichas.join(' ')).toContain('Ese dato no es válido');
    await escribir('987654321');
    await hasta(() => form.controls.pcdNumero.value === '987654321');
    expect(form.controls.pcdNumero.valid).toBe(true);
    salir(el);
  });

  it('si el micrófono no sirve, lo dice con claridad y sigue con botones, sin repetir «no le entendí»', async () => {
    respuestas.push({ ok: false, motivo: 'red' });
    const { el, form, hasta } = await montar();
    el.querySelector<HTMLButtonElement>('.lanzador button')!.click();
    await hasta(() => dichas.join(' ').includes('necesita conexión a internet'));
    expect(dichas.join(' ')).not.toContain('No le entendí');
    await hasta(() => !!el.querySelector('.par .grande'));
    [...el.querySelectorAll<HTMLButtonElement>('.par .grande')]
      .find((b) => b.textContent?.trim() === 'Sí')!
      .click();
    await hasta(() => form.controls.diligencia.value === 'PCD');
    expect(form.controls.diligencia.value).toBe('PCD');
    expect(reconocimiento.escuchar).toHaveBeenCalledTimes(1);
    salir(el);
  });

  it('prueba todas las interpretaciones: «tras» no se entiende pero la alternativa «sí» sí', async () => {
    respuestas.push({ ok: true, texto: 'ci', alternativas: ['ci', 'sí'] });
    const { el, form, hasta } = await montar();
    el.querySelector<HTMLButtonElement>('.lanzador button')!.click();
    await hasta(() => form.controls.diligencia.value === 'PCD');
    expect(form.controls.diligencia.value).toBe('PCD');
    salir(el);
  });

  it('«Salir del asistente» lo cierra y deja el formulario como estaba', async () => {
    respuestas.push(dice('sí'));
    const { fixture, form, el, hasta } = await montar();
    el.querySelector<HTMLButtonElement>('.lanzador button')!.click();
    fixture.detectChanges();
    await hasta(() => !!el.querySelector('.asistente'));
    [...el.querySelectorAll<HTMLButtonElement>('.fila button')]
      .find((b) => b.textContent?.includes('Salir'))!
      .click();
    await hasta(() => !el.querySelector('.asistente'));
    expect(el.querySelector('.asistente')).toBeNull();
    expect(form.controls.pcdNombre.value).toBe('');
  });

  it('«Apagar la voz y llenar yo» cierra el asistente y deja la lectura apagada', async () => {
    respuestas.push(dice('sí'));
    const { el, hasta, voz } = await montar();
    el.querySelector<HTMLButtonElement>('.lanzador button')!.click();
    await hasta(() => !!el.querySelector('.asistente'));
    [...el.querySelectorAll<HTMLButtonElement>('.fila button')]
      .find((b) => b.textContent?.includes('Apagar la voz'))!
      .click();
    await hasta(() => !el.querySelector('.asistente'));
    expect(voz.activa()).toBe(false);
    expect(localStorage.getItem('lectura_voz_activa')).toBe('0');
  });

  it('si la persona acaba de decir que sí en la pregunta inicial, el asistente empieza solo', async () => {
    respuestas.push(dice('sí'), dice('sí'));
    const { fixture, el, hasta, voz } = await montar();
    voz.asistenteSolicitado.set(true);
    fixture.detectChanges();
    await hasta(() => !!el.querySelector('.asistente'));
    expect(el.querySelector('.asistente')).not.toBeNull();
    expect(voz.asistenteSolicitado()).toBe(false);
    salir(el);
  });
});
