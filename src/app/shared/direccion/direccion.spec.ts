import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Direccion } from './direccion';

@Component({
  imports: [Direccion],
  template: `<app-direccion idCampo="dir" [control]="control" />`,
})
class Anfitrion {
  control = new FormControl('', { nonNullable: true });
}

describe('Direccion', () => {
  async function montar(inicial = '') {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.control.setValue(inicial);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const cambiar = async (id: string, valor: string, evento: 'input' | 'change') => {
      const campo = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      campo.value = valor;
      campo.dispatchEvent(new Event(evento, { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, el, cambiar, control: fixture.componentInstance.control };
  }

  it('al principio no hay dirección ni error', async () => {
    const { el, control } = await montar();
    expect(control.value).toBe('');
    expect(control.valid).toBe(true);
    expect(el.querySelector('.vista')?.textContent).toContain('Elija el tipo de vía');
  });

  it('muestra cómo va quedando y deja en el control la dirección armada', async () => {
    const { el, cambiar, control } = await montar();
    await cambiar('dir-tipo', 'Carrera', 'change');
    // Desde el primer dato ya se ve cómo va quedando, sin avisos de error.
    expect(el.querySelector('.vista .enfasis')?.textContent).toBe('Carrera');
    await cambiar('dir-numero', '54', 'input');
    expect(el.querySelector('.vista .enfasis')?.textContent).toBe('Carrera 54');
    expect(el.querySelector('.vista')?.textContent).not.toContain('falta');
    expect(el.querySelector('#dir-error')).toBeNull();
    expect(control.value).toBe('');
    await cambiar('dir-cruce', '72', 'input');
    await cambiar('dir-placa', '30', 'input');
    await cambiar('dir-letra', 'B', 'change');
    expect(el.querySelector('.vista .enfasis')?.textContent).toBe('Carrera 54 B # 72 - 30');
    expect(control.value).toBe('Carrera 54 B # 72 - 30');
    expect(control.valid).toBe(true);
  });

  it('si queda a medias el control tiene error y nunca se envía una dirección incompleta', async () => {
    const { el, cambiar, control } = await montar();
    await cambiar('dir-tipo', 'Calle', 'change');
    expect(control.value).toBe('');
    expect(control.errors?.['direccion']).toContain('falta el número de la vía');
    control.markAsTouched();
    await cambiar('dir-numero', '72', 'input');
    expect(el.querySelector('#dir-error')?.textContent).toContain('falta el número del cruce');
  });

  it('solo acepta números en los campos numéricos', async () => {
    const { el, cambiar } = await montar();
    await cambiar('dir-numero', '7a2b', 'input');
    expect(el.querySelector<HTMLInputElement>('#dir-numero')?.value).toBe('72');
  });

  it('si ya trae una dirección estándar la reparte en sus campos', async () => {
    const { el, control } = await montar('Calle 72 B # 54 - 30, Apto 301');
    expect(el.querySelector<HTMLSelectElement>('#dir-tipo')?.value).toBe('Calle');
    expect(el.querySelector<HTMLInputElement>('#dir-numero')?.value).toBe('72');
    expect(el.querySelector<HTMLSelectElement>('#dir-letra')?.value).toBe('B');
    expect(el.querySelector<HTMLInputElement>('#dir-complemento')?.value).toBe('Apto 301');
    expect(control.value).toBe('Calle 72 B # 54 - 30, Apto 301');
  });
});
