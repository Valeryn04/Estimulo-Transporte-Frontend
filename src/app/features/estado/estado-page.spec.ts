import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from '../../core/api/api';
import { EstadoPage } from './estado-page';

describe('EstadoPage', () => {
  function crear() {
    TestBed.configureTestingModule({
      imports: [EstadoPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(EstadoPage);
    fixture.detectChanges();
    return { fixture, ctrl: TestBed.inject(HttpTestingController) };
  }

  it('muestra servicio disponible cuando la API y la base de datos responden', async () => {
    const { fixture, ctrl } = crear();
    ctrl.expectOne(`${API_BASE}/health`).flush({ estado: 'ok', baseDeDatos: 'ok' });
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('Servicio disponible');
    expect(texto).toContain('Base de datos conectada');
  });

  it('avisa cuando la API no responde', async () => {
    const { fixture, ctrl } = crear();
    ctrl.expectOne(`${API_BASE}/health`).error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No hay conexión');
  });
});
