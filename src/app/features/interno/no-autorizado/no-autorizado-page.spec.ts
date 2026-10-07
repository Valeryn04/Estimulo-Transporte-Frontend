import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoAutorizadoPage } from './no-autorizado-page';

describe('NoAutorizadoPage', () => {
  it('explica que el rol no tiene permiso y ofrece volver al inicio', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NoAutorizadoPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Acceso no autorizado');
    expect(el.textContent).toContain('no tiene permiso');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/interno');
  });
});
