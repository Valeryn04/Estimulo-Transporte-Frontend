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

@Component({
  selector: 'app-sin-ayuda-prueba',
  imports: [Campo, CampoControl, ReactiveFormsModule],
  template: `
    <app-campo idCampo="nombre" etiqueta="Nombre" [control]="control">
      <input appCampoControl [formControl]="control" />
    </app-campo>
  `,
})
class SinAyuda {
  control = new FormControl('');
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

  it('la ayuda es un tooltip con icono: aparece al tocar el botón y se cierra con Escape o al tocar afuera', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const boton = el.querySelector<HTMLButtonElement>('.ayuda-boton')!;
    const tooltip = el.querySelector('[role="tooltip"]')!;
    expect(boton.getAttribute('aria-label')).toBe('Ayuda: Número de celular');
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(tooltip.textContent).toContain('10 dígitos');
    expect(tooltip.classList.contains('visible')).toBe(false);
    // El botón no está dentro de la etiqueta: tocarlo no debe activar el campo.
    expect(el.querySelector('label')?.contains(boton)).toBe(false);
    boton.click();
    await fixture.whenStable();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(tooltip.classList.contains('visible')).toBe(true);
    boton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(tooltip.classList.contains('visible')).toBe(false);
    boton.click();
    await fixture.whenStable();
    document.body.click();
    await fixture.whenStable();
    expect(tooltip.classList.contains('visible')).toBe(false);
  });

  it('sin ayuda no dibuja el botón', async () => {
    const fixture = TestBed.createComponent(SinAyuda);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ayuda-boton')).toBeNull();
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
