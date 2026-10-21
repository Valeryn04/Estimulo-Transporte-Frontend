import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { API_BASE } from '../../../../core/api/api';
import { Sesion } from '../../../../core/auth/sesion';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { CambiarPasswordPage } from './cambiar-password-page';

const URL = `${API_BASE}/auth/cambiar-password`;
const RESPUESTA = {
  token: 'nuevo',
  inactividadMinutos: 15,
  perfil: {
    id: 1,
    usuario: 'ana',
    nombres: 'Ana',
    correo: 'ana@alcaldia.test',
    roles: [],
    permisos: [],
    debeCambiarPassword: false,
  },
};

function montar(debeCambiar: boolean) {
  const p = montarPantalla(CambiarPasswordPage, {}, []);
  const sesion = TestBed.inject(Sesion);
  sesion.perfil.update((x) => (x ? { ...x, usuario: 'ana', debeCambiarPassword: debeCambiar } : x));
  p.fixture.detectChanges();
  return p;
}

describe('CambiarPasswordPage', () => {
  it('con la contraseña temporal no pide la actual', async () => {
    const p = montar(true);
    await p.asentar();
    expect(p.el.querySelector('#actual')).toBeNull();
    expect(p.el.textContent).toContain('No necesita escribir la temporal');
  });

  it('con la temporal cambia la contraseña sin enviar la actual', async () => {
    const p = montar(true);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await p.asentar();
    p.escribir('#nueva', 'Definitiva#2026ab');
    p.escribir('#confirmacion', 'Definitiva#2026ab');
    p.enviar('form');
    const r = p.ctrl.expectOne(URL);
    expect(r.request.body).toEqual({ passwordNueva: 'Definitiva#2026ab' });
    r.flush(RESPUESTA);
    await p.asentar();
  });

  it('en un cambio voluntario sí pide la contraseña actual y la envía', async () => {
    const p = montar(false);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await p.asentar();
    expect(p.el.querySelector('#actual')).not.toBeNull();
    p.enviar('form');
    await p.asentar();
    p.ctrl.expectNone(URL);
    p.escribir('#actual', 'Anterior#2026ab');
    p.escribir('#nueva', 'Definitiva#2026ab');
    p.escribir('#confirmacion', 'Definitiva#2026ab');
    p.enviar('form');
    const r = p.ctrl.expectOne(URL);
    expect(r.request.body).toEqual({
      passwordActual: 'Anterior#2026ab',
      passwordNueva: 'Definitiva#2026ab',
    });
    r.flush(
      errorApi('VALIDACION', 'Revise', [
        { campo: 'passwordActual', mensaje: 'Contraseña actual: no es correcta' },
      ]),
      {
        status: 422,
        statusText: 'No procesable',
      },
    );
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')).not.toBeNull();
  });
});
