import { TestBed } from '@angular/core/testing';
import { LockupDependencia } from './lockup-dependencia';

describe('LockupDependencia', () => {
  function pintar(entradas: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(LockupDependencia);
    for (const [k, v] of Object.entries(entradas)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sobre fondo oscuro usa el logo negativo, con el nombre de la dependencia', () => {
    const el = pintar();
    const logo = el.querySelector('img')!;
    expect(logo.getAttribute('src')).toBe('identidad/alcaldia-negativo.svg');
    expect(logo.getAttribute('alt')).toBe('Alcaldía de Barranquilla');
    expect(el.querySelector('.dependencia')?.textContent).toContain(
      'Gerencia de Desarrollo Social',
    );
    expect(el.classList).toContain('fondo-oscuro');
  });

  it('sobre fondo claro usa el logo positivo', () => {
    const el = pintar({ fondo: 'claro', tamano: 'grande' });
    expect(el.querySelector('img')!.getAttribute('src')).toBe('identidad/alcaldia-positivo.svg');
    expect(el.classList).toContain('fondo-claro');
    expect(el.classList).toContain('tamano-grande');
  });

  it('el logo no se deforma: conserva su proporción original', () => {
    const logo = pintar().querySelector('img')!;
    expect(Number(logo.getAttribute('width')) / Number(logo.getAttribute('height'))).toBeCloseTo(
      446 / 38,
      1,
    );
  });
});
