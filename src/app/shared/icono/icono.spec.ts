import { TestBed } from '@angular/core/testing';
import { Icono, NombreIcono } from './icono';

describe('Icono', () => {
  function pintar(nombre: NombreIcono) {
    const fixture = TestBed.createComponent(Icono);
    fixture.componentRef.setInput('nombre', nombre);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dibuja un SVG decorativo oculto a los lectores de pantalla', () => {
    const svg = pintar('editar').querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelector('path')!.getAttribute('d')).toBeTruthy();
  });

  it('cada icono tiene su propio trazado', () => {
    const nombres: NombreIcono[] = [
      'editar',
      'llave',
      'papelera',
      'apagar',
      'usuarioX',
      'menu',
      'salir',
    ];
    const trazados = nombres.map((n) => pintar(n).querySelector('path')!.getAttribute('d'));
    expect(new Set(trazados).size).toBe(nombres.length);
  });
});
