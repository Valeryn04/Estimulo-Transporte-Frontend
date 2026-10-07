import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('se crea correctamente', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });

  it('la raíz abre el portal ciudadano con su enlace de salto para teclado', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('a.saltar')?.getAttribute('href')).toBe('#contenido');
    expect(el.querySelector('h1')?.textContent).toContain('Estímulo Social de Transporte');
  });

  it('una dirección inexistente muestra «Página no encontrada»', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/no-existe');
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'Página no encontrada',
    );
  });

  it('el portal interno está registrado en /interno antes del comodín del portal ciudadano', () => {
    const rutas = routes.map((r) => r.path);
    expect(rutas.indexOf('interno')).toBeGreaterThanOrEqual(0);
    expect(rutas.indexOf('interno')).toBeLessThan(rutas.indexOf(''));
  });
});
