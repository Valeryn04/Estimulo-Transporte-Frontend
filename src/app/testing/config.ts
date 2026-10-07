import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { erroresInterceptor } from '../core/api/errores.interceptor';
import { asentar } from './asentar';
import './locale';

/** Monta una pantalla con HttpClient de pruebas (con el manejo de errores real) y rutas vacías. */
export function montarPantalla<T>(componente: Type<T>, entradas: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([erroresInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: LOCALE_ID, useValue: 'es-CO' },
    ],
  });
  const fixture = TestBed.createComponent(componente);
  for (const [k, v] of Object.entries(entradas)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    ctrl: TestBed.inject(HttpTestingController),
    asentar: () => asentar(fixture),
    escribir(selector: string, valor: string) {
      const campo = el.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        selector,
      )!;
      campo.value = valor;
      campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input'));
    },
    enviar(selector = 'dialog form') {
      el.querySelector<HTMLFormElement>(selector)!.dispatchEvent(new Event('submit'));
    },
    boton(titulo: string) {
      return el.querySelector<HTMLButtonElement>(`button[title="${titulo}"]`)!;
    },
  };
}

/** Respuesta de error con el formato estándar de la API. */
export const errorApi = (
  codigo: string,
  mensaje: string,
  errores?: { campo: string; mensaje: string }[],
) => ({
  error: { codigo, mensaje, ...(errores ? { errores } : {}) },
});
