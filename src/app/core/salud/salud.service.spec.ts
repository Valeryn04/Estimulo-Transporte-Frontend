import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from '../api/api';
import { SaludService } from './salud.service';

describe('SaludService', () => {
  it('consulta el estado del servicio en /api/v1/health', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const ctrl = TestBed.inject(HttpTestingController);
    let recibido: unknown;
    TestBed.inject(SaludService)
      .consultar()
      .subscribe((e) => (recibido = e));
    const req = ctrl.expectOne(`${API_BASE}/health`);
    expect(req.request.method).toBe('GET');
    req.flush({ estado: 'ok', baseDeDatos: 'ok' });
    expect(recibido).toEqual({ estado: 'ok', baseDeDatos: 'ok' });
  });
});
