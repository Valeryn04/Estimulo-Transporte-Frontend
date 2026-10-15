import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { API_BASE } from '../../../core/api/api';
import { FormularioPreinscripcion } from '../../../core/publico/publico-api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { PreinscripcionPage } from './preinscripcion-page';

const FORMULARIO: FormularioPreinscripcion = {
  abierta: true,
  anio: 2026,
  tiposIdentificacion: [
    { id: 1, codigo: 'CC', nombre: 'Cédula de Ciudadanía' },
    { id: 4, codigo: 'CE', nombre: 'Cédula de Extranjería' },
  ],
  localidades: [
    { id: 10, nombre: 'Riomar' },
    { id: 11, nombre: 'Sur Oriente' },
  ],
  barrios: [
    { id: 100, nombre: 'Altamira', localidadId: 10 },
    { id: 101, nombre: 'Betania', localidadId: 11 },
  ],
  autorizacion: { version: 1, contenido: 'AUTORIZACIÓN. Ley 1581 de 2012.' },
  formularioToken: 'token.del.formulario',
};

describe('PreinscripcionPage', () => {
  async function montar(formulario: FormularioPreinscripcion = FORMULARIO) {
    const p = montarPantalla(PreinscripcionPage);
    p.ctrl.expectOne(`${API_BASE}/publico/preinscripcion/formulario`).flush(formulario);
    await p.asentar();
    const elegir = (selector: string, texto: string) => {
      const s = p.el.querySelector<HTMLSelectElement>(selector)!;
      const o = [...s.options].find((x) => x.textContent!.includes(texto))!;
      s.value = o.value;
      s.dispatchEvent(new Event('change'));
    };
    const llenar = async () => {
      p.escribir('#pcd-nombre', 'María Fernanda Pérez');
      elegir('#pcd-tipo', 'CC');
      p.escribir('#pcd-numero', '1.234.567');
      p.escribir('#cui-nombre', 'Carlos López');
      elegir('#cui-tipo', 'CC');
      p.escribir('#cui-numero', '98765432');
      p.escribir('#correo', 'familia@correo.com');
      p.escribir('#correo-confirmacion', 'familia@correo.com');
      p.el.querySelector<HTMLInputElement>('#acepta')!.click();
      await p.asentar();
    };
    const enviar = () => p.enviar('form');
    return { ...p, elegir, llenar, enviar };
  }

  it('muestra la aclaración de que la preinscripción no equivale a la aprobación', async () => {
    const { el } = await montar();
    expect(el.querySelector('.aviso')?.textContent).toContain(
      'no equivale a la aprobación del beneficio',
    );
  });

  it('contiene todos los campos del documento y marca los obligatorios', async () => {
    const { el } = await montar();
    const etiquetas = [...el.querySelectorAll('label, legend')].map((l) =>
      l.textContent!.replace(/\s+/g, ' ').trim(),
    );
    for (const e of [
      'Nombre completo *',
      'Tipo de identificación *',
      'Número de identificación *',
      'Dirección de residencia',
      'Localidad',
      'Barrio',
      'Correo electrónico *',
    ]) {
      expect(
        etiquetas.some((x) => x.startsWith(e)),
        e,
      ).toBe(true);
    }
    expect(el.textContent).toContain('Ley 1581 de 2012');
  });

  it('el texto de la autorización se puede recorrer con el teclado y la aceptación es obligatoria', async () => {
    const { el } = await montar();
    const region = el.querySelector('.texto-autorizacion')!;
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.getAttribute('role')).toBe('region');
    expect(el.querySelector('#acepta')?.getAttribute('aria-required')).toBe('true');
  });

  it('enviar vacío no llama a la API y muestra un resumen de errores con enlaces a cada campo', async () => {
    const { el, ctrl, enviar, asentar } = await montar();
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    const resumen = el.querySelector('.resumen')!;
    expect(resumen.getAttribute('role')).toBe('alert');
    const items = [...resumen.querySelectorAll('li')].map((l) => l.textContent!.trim());
    expect(items).toContain('Nombre completo de la persona con discapacidad: complete este dato');
    expect(items).toContain(
      'Autorización de tratamiento de datos: debe aceptarla para poder enviar la preinscripción',
    );
    expect(resumen.querySelector('a')!.getAttribute('href')).toBe('#pcd-nombre');
    expect(el.querySelector('#pcd-nombre')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('valida el número según el tipo de documento', async () => {
    const { el, escribir, elegir, enviar, asentar } = await montar();
    elegir('#pcd-tipo', 'CC');
    escribir('#pcd-numero', 'ABC123');
    enviar();
    await asentar();
    expect(el.querySelector('#pcd-numero-error')?.textContent).toContain(
      'cédula de ciudadanía tiene entre 5 y 10 dígitos',
    );
    elegir('#pcd-tipo', 'CE');
    await asentar();
    expect(el.querySelector('#pcd-numero-error')).toBeNull();
  });

  it('el barrio solo se habilita al elegir la localidad y muestra solo los barrios de esa localidad', async () => {
    const { el, elegir, asentar } = await montar();
    expect(el.querySelector<HTMLSelectElement>('#barrio')!.disabled).toBe(true);
    elegir('#localidad', 'Riomar');
    await asentar();
    const barrio = el.querySelector<HTMLSelectElement>('#barrio')!;
    expect(barrio.disabled).toBe(false);
    expect([...barrio.options].map((o) => o.textContent!.trim())).toEqual([
      'Seleccione',
      'Altamira',
    ]);
  });

  it('el campo trampa está fuera del orden de tabulación y oculto a lectores de pantalla', async () => {
    const { el } = await montar();
    const trampa = el.querySelector('.trampa')!;
    expect(trampa.getAttribute('aria-hidden')).toBe('true');
    expect(trampa.querySelector('input')!.getAttribute('tabindex')).toBe('-1');
  });

  it('envía los datos normalizados con la versión de la autorización y navega a la confirmación', async () => {
    const { ctrl, llenar, elegir, enviar, asentar } = await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await llenar();
    elegir('#localidad', 'Riomar');
    await asentar();
    elegir('#barrio', 'Altamira');
    enviar();
    const req = ctrl.expectOne(`${API_BASE}/publico/preinscripciones`);
    expect(req.request.body).toMatchObject({
      pcdNombre: 'María Fernanda Pérez',
      pcdTipoIdentificacionId: 1,
      pcdNumero: '1.234.567',
      cuidadorNumero: '98765432',
      localidadId: 10,
      barrioId: 100,
      direccion: null,
      correo: 'familia@correo.com',
      correoConfirmacion: 'familia@correo.com',
      aceptaAutorizacion: true,
      autorizacionVersion: 1,
      formularioToken: 'token.del.formulario',
      contactoAlterno: '',
    });
    req.flush(
      { correoEnmascarado: 'f****@correo.com', horasVigenciaEnlace: 72 },
      { status: 201, statusText: 'Creado' },
    );
    await asentar();
    expect(navegar).toHaveBeenCalledWith(['/preinscripcion/enviada'], {
      state: { correo: 'f****@correo.com', horas: 72 },
    });
  });

  it('el correo se escribe dos veces: si son diferentes lo dice en el campo y no se envía', async () => {
    const { el, ctrl, llenar, escribir, enviar, asentar } = await montar();
    await llenar();
    escribir('#correo-confirmacion', 'famlia@correo.com');
    await asentar();
    expect(el.querySelector('#correo-confirmacion-error')?.textContent).toContain(
      'los dos correos no coinciden',
    );
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    const items = [...el.querySelectorAll('.resumen li')].map((l) => l.textContent!.trim());
    expect(
      items.some((t) => t.includes('Confirmación del correo: los dos correos no coinciden')),
    ).toBe(true);
    // Al corregirlo (o al cambiar el primero para que coincida) el error desaparece.
    escribir('#correo', 'famlia@correo.com');
    await asentar();
    expect(el.querySelector('#correo-confirmacion-error')).toBeNull();
  });

  it('la dirección se arma por partes con el formato estándar y se envía ya armada', async () => {
    const { ctrl, el, llenar, elegir, escribir, enviar, asentar } = await montar();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await llenar();
    elegir('#direccion-tipo', 'Carrera');
    escribir('#direccion-numero', '54');
    elegir('#direccion-letra', 'B');
    escribir('#direccion-cruce', '72');
    escribir('#direccion-placa', '30');
    escribir('#direccion-complemento', 'Apto 301');
    await asentar();
    expect(el.querySelector('.vista strong')?.textContent).toBe('Carrera 54 B # 72 - 30, Apto 301');
    enviar();
    const req = ctrl.expectOne(`${API_BASE}/publico/preinscripciones`);
    expect(req.request.body).toMatchObject({ direccion: 'Carrera 54 B # 72 - 30, Apto 301' });
  });

  it('una dirección a medias no se envía y el resumen dice qué falta', async () => {
    const { el, ctrl, llenar, elegir, escribir, enviar, asentar } = await montar();
    await llenar();
    elegir('#direccion-tipo', 'Calle');
    escribir('#direccion-numero', '72');
    await asentar();
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    const items = [...el.querySelectorAll('.resumen li')].map((l) => l.textContent!.trim());
    expect(items).toContain(
      'Dirección de residencia: falta el número del cruce y el número de la placa',
    );
  });

  it('si ya existe una solicitud lo informa y ofrece consultar el estado', async () => {
    const { el, ctrl, llenar, enviar, asentar } = await montar();
    await llenar();
    enviar();
    ctrl
      .expectOne(`${API_BASE}/publico/preinscripciones`)
      .flush(
        errorApi(
          'SOLICITUD_EXISTENTE',
          'Ya existe una solicitud para esta persona en la vigencia actual. Puede consultar su estado.',
        ),
        { status: 409, statusText: 'Conflicto' },
      );
    await asentar();
    const aviso = el.querySelector('.aviso[role="alert"]')!;
    expect(aviso.textContent).toContain('Ya existe una solicitud');
    expect(aviso.querySelector('a')!.getAttribute('href')).toBe('/consulta');
  });

  it('si el texto de la autorización cambió, vuelve a cargarlo y pide aceptarlo de nuevo', async () => {
    const { el, ctrl, llenar, enviar, asentar } = await montar();
    await llenar();
    enviar();
    ctrl
      .expectOne(`${API_BASE}/publico/preinscripciones`)
      .flush(
        errorApi(
          'AUTORIZACION_CAMBIO',
          'El texto de la autorización de datos cambió. Léalo de nuevo.',
        ),
        { status: 409, statusText: 'Conflicto' },
      );
    await asentar();
    ctrl
      .expectOne(`${API_BASE}/publico/preinscripcion/formulario`)
      .flush({ ...FORMULARIO, autorizacion: { version: 2, contenido: 'TEXTO NUEVO' } });
    await asentar();
    expect(el.querySelector('.texto-autorizacion')?.textContent).toContain('TEXTO NUEVO');
    expect(el.querySelector<HTMLInputElement>('#acepta')!.checked).toBe(false);
    expect(el.querySelector('.aviso[role="alert"]')?.textContent).toContain('cambió');
  });

  it('lleva a cada campo el error de validación que devuelve la API', async () => {
    const { el, ctrl, llenar, enviar, asentar } = await montar();
    await llenar();
    enviar();
    ctrl.expectOne(`${API_BASE}/publico/preinscripciones`).flush(
      errorApi('VALIDACION', 'Revise', [
        {
          campo: 'cuidadorNumero',
          mensaje:
            'Número de identificación del cuidador: no puede ser el mismo de la persona con discapacidad',
        },
      ]),
      { status: 422, statusText: 'Inválido' },
    );
    await asentar();
    expect(el.querySelector('#cui-numero-error')?.textContent).toContain('no puede ser el mismo');
    expect(el.querySelector('.resumen')?.textContent).toContain('no puede ser el mismo');
  });

  it('cuando la vigencia no está abierta muestra el aviso y no el formulario', async () => {
    const { el } = await montar({ ...FORMULARIO, abierta: false });
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).toContain('no están abiertas');
  });
});
