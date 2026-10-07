import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Campo } from './campo';
import { CampoControl } from './campo-control';

@Component({
  selector: 'app-anfitrion-prueba',
  imports: [Campo, CampoControl, ReactiveFormsModule],
  template: `
    <app-campo
      idCampo="celular"
      etiqueta="Número de celular"
      ayuda="10 dígitos"
      [control]="control"
    >
      <input appCampoControl [formControl]="control" />
    </app-campo>
  `,
})
class Anfitrion {
  control = new FormControl('', [Validators.required, Validators.minLength(10)]);
}

describe('Campo', () => {
  it('conecta etiqueta, ayuda y error con el campo para lectores de pantalla', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    expect(el.querySelector('label')?.getAttribute('for')).toBe('celular');
    expect(input.id).toBe('celular');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('celular-ayuda');
    expect(el.querySelector('.error')).toBeNull();
  });

  it('muestra el campo y la corrección esperada solo después de tocarlo', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const error = el.querySelector('.error');
    expect(error?.textContent).toContain('Número de celular: complete este dato');
    expect(error?.getAttribute('role')).toBe('alert');
    const input = el.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('celular-ayuda celular-error');

    fixture.componentInstance.control.setValue('123');
    await fixture.whenStable();
    expect(el.querySelector('.error')?.textContent).toContain('escriba al menos 10 caracteres');
  });

  it('marca el campo como obligatorio aunque el validador se agregue después de crearlo', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.control.clearValidators();
    fixture.componentInstance.control.updateValueAndValidity();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.obl')).toBeNull();
    fixture.componentInstance.control.setValidators([Validators.required]);
    fixture.componentInstance.control.updateValueAndValidity();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.obl')).not.toBeNull();
    expect((el.querySelector('input') as HTMLInputElement).getAttribute('aria-required')).toBe(
      'true',
    );
  });
});
