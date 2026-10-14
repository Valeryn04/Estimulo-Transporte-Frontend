import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Incrustacion, estaIncrustado, noIncrustableGuard } from './no-incrustable';

describe('portal que no se abre dentro de otra página', () => {
  describe('estaIncrustado', () => {
    it('es falso cuando la ventana es la superior', () => {
      const w: { self?: unknown; top?: unknown } = {};
      w.self = w;
      w.top = w;
      expect(estaIncrustado(w as unknown as Window)).toBe(false);
    });

    it('es verdadero cuando hay una ventana superior distinta (iframe)', () => {
      expect(estaIncrustado({ self: {}, top: {} } as unknown as Window)).toBe(true);
    });

    it('si el navegador no deja comparar con la ventana superior, se considera incrustado', () => {
      const w = {
        get top(): never {
          throw new Error('bloqueado');
        },
        self: {},
      };
      expect(estaIncrustado(w as unknown as Window)).toBe(true);
    });

    it('sin ventana (servidor) no está incrustado', () => {
      expect(estaIncrustado(null)).toBe(false);
    });
  });

  describe('noIncrustableGuard', () => {
    const correr = (url: string, incrustado: boolean) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      vi.spyOn(TestBed.inject(Incrustacion), 'incrustado').mockReturnValue(incrustado);
      return TestBed.runInInjectionContext(() =>
        noIncrustableGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
      );
    };

    it('deja pasar cuando se abre directamente en el navegador', () => {
      expect(correr('/preinscripcion', false)).toBe(true);
      expect(correr('/interno/login', false)).toBe(true);
    });

    it('dentro de un iframe lleva al aviso, sea el portal ciudadano o el interno', () => {
      for (const url of ['/preinscripcion', '/interno/login']) {
        const r = correr(url, true);
        expect(r).toBeInstanceOf(UrlTree);
        expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/no-incrustable');
      }
    });

    it('el propio aviso sí se muestra (no se entra en un ciclo)', () => {
      expect(correr('/no-incrustable', true)).toBe(true);
    });
  });
});
