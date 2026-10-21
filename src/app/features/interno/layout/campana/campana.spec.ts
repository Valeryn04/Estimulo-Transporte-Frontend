import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { API_BASE } from '../../../../core/api/api';
import { montarPantalla } from '../../../../testing/config';
import { Campana } from './campana';

const URL = `${API_BASE}/admin/alertas`;

const alerta = (id: number, titulo: string, enlace: string | null = '/interno/asignacion') => ({
  id,
  tipo: 'CUPO_LIBERADO',
  titulo,
  mensaje: 'El siguiente caso en el orden es EST-2026-000003.',
  enlace,
  solicitudId: 1,
  creadaAt: '2026-10-06T10:00:00Z',
});

describe('Campana de alertas', () => {
  async function montar(items = [alerta(1, 'Se liberó un cupo'), alerta(2, 'Venció un plazo')]) {
    const p = montarPantalla(Campana, {}, []);
    p.ctrl.expectOne(URL).flush({ items });
    await p.asentar();
    return p;
  }

  it('muestra cuántas alertas hay sin leer', async () => {
    const a = await montar();
    expect(a.el.querySelector('.contador')?.textContent?.trim()).toBe('2');
  });

  it('sin alertas no muestra contador', async () => {
    const b = await montar([]);
    expect(b.el.querySelector('.contador')).toBeNull();
  });

  it('al abrirla lista las alertas y, al abrir una, la marca como leída y lleva a donde se atiende', async () => {
    const p = await montar();
    const ir = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    p.el.querySelector<HTMLButtonElement>('.disparador')!.click();
    p.ctrl
      .expectOne(URL)
      .flush({ items: [alerta(1, 'Se liberó un cupo'), alerta(2, 'Venció un plazo')] });
    await p.asentar();
    expect(p.el.querySelectorAll('.alerta')).toHaveLength(2);
    p.el.querySelector<HTMLButtonElement>('.alerta')!.click();
    p.ctrl.expectOne(`${URL}/1/atender`).flush(null);
    await p.asentar();
    expect(ir).toHaveBeenCalledWith('/interno/asignacion');
    expect(p.el.querySelector('.contador')?.textContent?.trim()).toBe('1');
    expect(p.el.querySelector('#panel-alertas')).toBeNull();
  });

  it('permite marcar todas como leídas', async () => {
    const p = await montar();
    p.el.querySelector<HTMLButtonElement>('.disparador')!.click();
    p.ctrl.expectOne(URL).flush({ items: [alerta(1, 'Una'), alerta(2, 'Otra')] });
    await p.asentar();
    p.el.querySelector<HTMLButtonElement>('.cabecera .enlace')!.click();
    p.ctrl.expectOne(`${URL}/1/atender`).flush(null);
    await p.asentar();
    p.ctrl.expectOne(`${URL}/2/atender`).flush(null);
    await p.asentar();
    expect(p.el.querySelector('.contador')).toBeNull();
    expect(p.el.querySelector('.vacio')?.textContent).toContain('No tiene alertas sin leer');
  });

  it('si no se puede marcar, la alerta sigue contando y se avisa', async () => {
    const p = await montar([alerta(1, 'Una', null)]);
    p.el.querySelector<HTMLButtonElement>('.disparador')!.click();
    p.ctrl.expectOne(URL).flush({ items: [alerta(1, 'Una', null)] });
    await p.asentar();
    p.el.querySelector<HTMLButtonElement>('.alerta')!.click();
    p.ctrl.expectOne(`${URL}/1/atender`).flush(null, { status: 500, statusText: 'Error' });
    await p.asentar();
    expect(p.el.querySelector('.error')?.textContent).toContain('No pudimos marcar');
    expect(p.el.querySelector('.contador')?.textContent?.trim()).toBe('1');
  });

  it('se cierra con Escape', async () => {
    const p = await montar();
    p.el.querySelector<HTMLButtonElement>('.disparador')!.click();
    p.ctrl.expectOne(URL).flush({ items: [alerta(1, 'Una')] });
    await p.asentar();
    expect(p.el.querySelector('#panel-alertas')).not.toBeNull();
    p.fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await p.asentar();
    expect(p.el.querySelector('#panel-alertas')).toBeNull();
  });
});
