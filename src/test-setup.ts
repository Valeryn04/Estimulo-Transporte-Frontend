import { TestBed } from '@angular/core/testing';
import { beforeEach } from 'vitest';
import { Alertas } from './app/shared/alertas/alertas';
import { AlertasPrueba } from './app/testing/alertas';

// Las ventanas de SweetAlert2 no se dibujan en las pruebas: se confirma de inmediato.
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [{ provide: Alertas, useClass: AlertasPrueba }] });
});
