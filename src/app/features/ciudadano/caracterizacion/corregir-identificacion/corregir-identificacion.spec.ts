import { API_BASE } from '../../../../core/api/api';
import {
  IdentificacionPersona,
  ItemLista,
  RespuestaCorreccionDocumento,
} from '../../../../core/publico/caracterizacion-api';
import { revisarAccesibilidad } from '../../../../testing/axe';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { CorregirIdentificacion } from './corregir-identificacion';

const URL = `${API_BASE}/publico/caracterizacion/identificacion`;

const tipos: ItemLista[] = [
  { id: 70, codigo: 'CC', nombre: 'Cédula de Ciudadanía' },
  { id: 71, codigo: 'TI', nombre: 'Tarjeta de Identidad' },
];
const actual: IdentificacionPersona = {
  nombre: 'María Pérez',
  tipoIdentificacion: { codigo: 'CC', nombre: 'Cédula de Ciudadanía' },
  numero: '1046730396',
};

const respuesta = (
  parcial: Partial<RespuestaCorreccionDocumento> = {},
): RespuestaCorreccionDocumento => ({
  cambio: true,
  pcd: {
    ...actual,
    tipoIdentificacion: { codigo: 'TI', nombre: 'Tarjeta de Identidad' },
    correo: 'a@b.co',
  },
  cuidador: null,
  regimen: { estado: 'SUBSIDIADO', mensaje: 'AC', consultadaAt: '2026-11-20T10:00:00Z' },
  version: 0,
  avance: { secciones: [], requeridos: 0, completados: 0, porcentaje: 0, completa: false },
  ...parcial,
});

describe('CorregirIdentificacion', () => {
  async function montar(entradas: Record<string, unknown> = {}) {
    const p = montarPantalla(CorregirIdentificacion, {
      persona: 'PCD',
      actual,
      tipos,
      editable: true,
      ...entradas,
    });
    await p.asentar();
    const q = <T extends Element>(s: string) => p.el.querySelector<T>(s);
    const abrir = async () => {
      q<HTMLButtonElement>('button.enlace')!.click();
      await p.asentar();
    };
    const elegirTipo = async (codigo: string) => {
      const select = q<HTMLSelectElement>('#corregir-tipo-PCD')!;
      const opcion = Array.from(select.options).find((o) => o.textContent?.startsWith(codigo))!;
      select.value = opcion.value;
      select.dispatchEvent(new Event('change'));
      await p.asentar();
    };
    return { ...p, q, abrir, elegirTipo };
  }

  it('ofrece corregir el documento y parte del tipo y número actuales', async () => {
    const p = await montar();
    expect(p.q('button.enlace')?.textContent).toContain('Corregir el documento');
    await p.abrir();
    expect(p.q<HTMLSelectElement>('#corregir-tipo-PCD')!.selectedOptions[0]?.textContent).toContain(
      'CC',
    );
    expect(p.q<HTMLInputElement>('#corregir-numero-PCD')!.value).toBe('1046730396');
  });

  it('no ofrece corregir cuando la solicitud ya no es editable', async () => {
    const p = await montar({ editable: false });
    expect(p.q('button.enlace')).toBeNull();
  });

  it('envía el tipo y el número corregidos y avisa para refrescar la pantalla', async () => {
    const p = await montar();
    const emitidos: RespuestaCorreccionDocumento[] = [];
    p.fixture.componentInstance.corregido.subscribe((r) => emitidos.push(r));
    await p.abrir();
    await p.elegirTipo('TI');
    p.escribir('#corregir-numero-PCD', '1.046.730-396');
    p.enviar('form');
    await p.asentar();
    const r = p.ctrl.expectOne(URL);
    expect(r.request.method).toBe('PATCH');
    expect(r.request.body).toEqual({
      persona: 'PCD',
      tipoIdentificacionId: 71,
      numero: '1046730396',
    });
    r.flush(respuesta());
    await p.asentar();
    expect(emitidos).toHaveLength(1);
    expect(p.q('.aviso.exito')?.textContent).toContain('Guardamos el documento corregido');
    expect(p.q('form')).toBeNull();
  });

  it('si no cambió nada, cierra sin llamar al servidor', async () => {
    const p = await montar();
    await p.abrir();
    p.enviar('form');
    await p.asentar();
    p.ctrl.expectNone(URL);
    expect(p.q('form')).toBeNull();
  });

  it('valida el número según el tipo antes de enviar', async () => {
    const p = await montar();
    await p.abrir();
    p.escribir('#corregir-numero-PCD', '12AB');
    p.enviar('form');
    await p.asentar();
    p.ctrl.expectNone(URL);
    expect(p.q('form')?.textContent).toContain('cédula de ciudadanía');
  });

  it('si el documento ya tiene solicitud muestra el mensaje y deja el formulario abierto', async () => {
    const p = await montar();
    await p.abrir();
    p.escribir('#corregir-numero-PCD', '1234567');
    p.enviar('form');
    await p.asentar();
    p.ctrl
      .expectOne(URL)
      .flush(errorApi('SOLICITUD_EXISTENTE', 'Ya existe una solicitud para esta persona.'), {
        status: 409,
        statusText: 'Conflict',
      });
    await p.asentar();
    expect(p.q('.aviso.error')?.textContent).toContain('Ya existe una solicitud');
    expect(p.q('form')).not.toBeNull();
  });

  it('avisa si con el nuevo documento la consulta no confirma el régimen subsidiado', async () => {
    const p = await montar();
    await p.abrir();
    p.escribir('#corregir-numero-PCD', '1234567');
    p.enviar('form');
    await p.asentar();
    p.ctrl.expectOne(URL).flush(
      respuesta({
        regimen: { estado: 'NO_SUBSIDIADO', mensaje: '', consultadaAt: '2026-11-20T10:00:00Z' },
      }),
    );
    await p.asentar();
    expect(p.q('.aviso.exito')?.textContent).toContain('no confirma el régimen subsidiado');
  });

  it('es accesible', async () => {
    const p = await montar();
    await p.abrir();
    await revisarAccesibilidad(p.el);
  });
});
