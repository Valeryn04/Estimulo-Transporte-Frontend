import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from './api-error';
import { erroresInterceptor } from './errores.interceptor';

describe('manejo centralizado de errores', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroresInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('convierte el formato de error de la API en un ApiError con los campos a corregir', async () => {
    const promesa = new Promise<ApiError>((resolver) =>
      http.get('/x').subscribe({ error: resolver }),
    );
    ctrl.expectOne('/x').flush(
      {
        error: {
          codigo: 'VALIDACION',
          mensaje: 'Revise los datos',
          errores: [{ campo: 'celular', mensaje: 'mal' }],
        },
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    const e = await promesa;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.codigo).toBe('VALIDACION');
    expect(e.errores).toEqual([{ campo: 'celular', mensaje: 'mal' }]);
  });

  it('explica con claridad cuando no hay conexión', async () => {
    const promesa = new Promise<ApiError>((resolver) =>
      http.get('/x').subscribe({ error: resolver }),
    );
    ctrl.expectOne('/x').error(new ProgressEvent('error'), { status: 0 });
    const e = await promesa;
    expect(e.codigo).toBe('SIN_CONEXION');
    expect(e.message).toContain('No hay conexión');
  });

  it('lee el error aunque la respuesta llegue como archivo (descarga de constancia)', async () => {
    const promesa = new Promise<ApiError>((resolver) =>
      http.get('/pdf', { responseType: 'blob' }).subscribe({ error: resolver }),
    );
    const cuerpo = new Blob([
      JSON.stringify({ error: { codigo: 'SOLICITUD_NO_ENCONTRADA', mensaje: 'No existe' } }),
    ]);
    ctrl.expectOne('/pdf').flush(cuerpo, { status: 404, statusText: 'No encontrado' });
    expect((await promesa).codigo).toBe('SOLICITUD_NO_ENCONTRADA');
  });
});
