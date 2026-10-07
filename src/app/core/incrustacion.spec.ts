import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Incrustacion, estaIncrustado, noIncrustableGuard } from './incrustacion';

describe('incrustación en la página institucional', () => {
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

  describe('noIncrustableGuard (el portal interno nunca dentro de otra página)', () => {
    const correr = (url: string, incrustado: boolean) => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      vi.spyOn(TestBed.inject(Incrustacion), 'incrustado').mockReturnValue(incrustado);
      return TestBed.runInInjectionContext(() =>
        noIncrustableGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
      );
    };

    it('deja pasar cuando se abre directamente en el navegador', () => {
      expect(correr('/interno/login', false)).toBe(true);
    });

    it('dentro de un iframe lleva al mensaje de que no se puede incrustar', () => {
      const r = correr('/interno/login', true);
      expect(r).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/interno/no-incrustable');
    });

    it('el propio mensaje sí se muestra (no se entra en un ciclo)', () => {
      expect(correr('/interno/no-incrustable', true)).toBe(true);
    });
  });
});
