import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CiudadanoShell } from './ciudadano-shell';

@Component({ template: '' })
class Vacia {}

describe('CiudadanoShell', () => {
  async function montar() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Vacia },
          { path: 'consulta', component: Vacia },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    const fixture = TestBed.createComponent(CiudadanoShell);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, router, el: fixture.nativeElement as HTMLElement };
  }

  it('en el inicio no muestra «Volver al inicio»', async () => {
    const { el } = await montar();
    expect(el.querySelector('.volver')).toBeNull();
  });

  it('en las demás pantallas muestra la flecha para volver al inicio', async () => {
    const { fixture, router, el } = await montar();
    await router.navigateByUrl('/consulta?token=abc');
    await fixture.whenStable();
    fixture.detectChanges();
    const volver = el.querySelector<HTMLAnchorElement>('a.volver');
    expect(volver?.textContent).toContain('Volver al inicio');
    expect(volver?.getAttribute('href')).toBe('/');
  });
});
