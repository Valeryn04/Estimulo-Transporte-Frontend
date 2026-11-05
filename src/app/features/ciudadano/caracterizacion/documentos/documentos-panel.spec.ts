import { vi } from 'vitest';
import { API_BASE } from '../../../../core/api/api';
import {
  DocumentoSolicitud,
  DocumentosSolicitud,
} from '../../../../core/publico/caracterizacion-api';
import { errorApi, montarPantalla } from '../../../../testing/config';
import { DocumentosPanel } from './documentos-panel';

const URL = `${API_BASE}/publico/caracterizacion/documentos`;

const doc = (parcial: Partial<DocumentoSolicitud> & { id: number }): DocumentoSolicitud => ({
  codigo: `DOC_${parcial.id}`,
  nombre: `Documento ${parcial.id}`,
  descripcion: 'Copia legible.',
  aplicaA: 'PCD',
  obligatorio: true,
  estado: 'PENDIENTE',
  reemplazos: 0,
  archivo: null,
  tieneModelo: false,
  generado: false,
  automatico: false,
  consulta: null,
  documentoConsultado: null,
  hojasMinimas: 1,
  ...parcial,
});

const lista = (documentos: DocumentoSolicitud[], maxMb = 5): DocumentosSolicitud => {
  const obligatorios = documentos.filter((d) => d.obligatorio);
  const cargados = obligatorios.filter((d) => d.estado === 'CARGADO').length;
  return {
    editable: true,
    documentosEditables: null,
    reglas: { formatos: ['pdf', 'jpg', 'png'], maxMb },
    documentos,
    resumen: {
      obligatorios: obligatorios.length,
      cargados,
      completo: cargados === obligatorios.length,
    },
  };
};

const archivoCargado = (nombre: string) => ({
  nombre,
  formato: 'pdf' as const,
  tamanoBytes: 2048,
  sha256: 'abcdef0123456789'.repeat(4),
  cargadoAt: '2026-10-07T02:00:00Z',
});

describe('DocumentosPanel', () => {
  async function montar(datos: DocumentosSolicitud, editable = true) {
    const p = montarPantalla(DocumentosPanel, { editable });
    p.ctrl.expectOne(URL).flush(datos);
    await p.asentar();
    const q = <T extends Element>(s: string) => p.el.querySelector<T>(s);
    const elegir = async (indice: number, archivo: File) => {
      const entrada = p.el.querySelectorAll<HTMLInputElement>('.documento input[type="file"]')[
        indice
      ]!;
      Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
      entrada.dispatchEvent(new Event('change'));
      await p.asentar();
    };
    return { ...p, q, elegir };
  }

  const pdf = (nombre = 'cedula.pdf', relleno = 'x') =>
    new File([`%PDF-1.4 ${relleno}`], nombre, { type: 'application/pdf' });

  it('agrupa los documentos por a quién aplican y muestra el estado de cada uno', async () => {
    const p = await montar(
      lista([
        doc({
          id: 1,
          nombre: 'Documento de identidad',
          estado: 'CARGADO',
          archivo: archivoCargado('id.pdf'),
        }),
        doc({ id: 2, nombre: 'Certificado de discapacidad' }),
        doc({ id: 3, nombre: 'Documento del cuidador', aplicaA: 'CUIDADOR' }),
        doc({ id: 4, nombre: 'Carta de solicitud', aplicaA: 'COMUN', tieneModelo: true }),
      ]),
    );
    const grupos = [...p.el.querySelectorAll('.grupo h3')].map((h) => h.textContent!.trim());
    expect(grupos).toEqual([
      'Documentos de la persona con discapacidad',
      'Documentos del cuidador o asistente personal',
      'Cartas que genera el sistema',
    ]);
    const estados = [...p.el.querySelectorAll('.documento .estado')].map((e) =>
      e.textContent!.trim(),
    );
    expect(estados).toEqual(['Cargado', 'Pendiente', 'Pendiente', 'Pendiente']);
    expect(p.q('.resumen p')?.textContent).toContain('1 de 4 documentos obligatorios cargados');
    expect(p.q('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
  });

  it('muestra los formatos y el tamaño máximo vigentes', async () => {
    const p = await montar(lista([doc({ id: 1 })], 8));
    expect(p.q('.reglas')?.textContent).toContain('PDF, JPG o PNG');
    expect(p.q('.reglas')?.textContent).toContain('8 MB');
    expect(p.q<HTMLInputElement>('input[type="file"]')!.accept).toBe('.pdf,.jpg,.jpeg,.png');
  });

  it('el documento cargado muestra su archivo, su fecha y su huella de integridad', async () => {
    const p = await montar(
      lista([
        doc({ id: 1, estado: 'CARGADO', reemplazos: 2, archivo: archivoCargado('mi cédula.pdf') }),
      ]),
    );
    const t = p.q('.archivo')!.textContent!.replace(/\s+/g, ' ');
    expect(t).toContain('mi cédula.pdf');
    expect(t).toContain('PDF · 2 KB');
    expect(t).toContain('06/10/2026 21:00');
    expect(t).toContain('Huella de integridad: abcdef012345');
    expect(t).toContain('Reemplazado 2 veces');
    expect(p.q('.documento .acciones label')?.textContent).toContain('Reemplazar archivo');
  });

  it('el modelo de carta solo aparece en los documentos que lo tienen', async () => {
    const p = await montar(lista([doc({ id: 1 }), doc({ id: 4, tieneModelo: true })]));
    const enlaces = p.el.querySelectorAll<HTMLAnchorElement>('.documento a[download]');
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]!.getAttribute('href')).toBe(`${API_BASE}/publico/documentos/4/modelo`);
  });

  it('la carta que genera el sistema no se carga: se ve con los datos escritos', async () => {
    const p = await montar(
      lista([
        doc({ id: 1 }),
        doc({ id: 4, nombre: 'Carta de solicitud', aplicaA: 'COMUN', generado: true }),
      ]),
    );
    const cartas = p.el.querySelectorAll('.documento');
    expect(cartas[1]!.querySelector('input[type="file"]')).toBeNull();
    // No aparece como «pendiente»: se genera y se adjunta sola.
    expect(cartas[1]!.querySelector('.estado')?.textContent).toContain('Se genera sola al enviar');
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:carta');
    globalThis.URL.revokeObjectURL = vi.fn();
    cartas[1]!.querySelector<HTMLButtonElement>('button')!.click();
    p.ctrl.expectOne(`${URL}/4/carta`).flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    await p.asentar();
    expect(abrir).toHaveBeenCalledWith('blob:carta', '_blank', 'noopener');
  });

  it('avisa cuántas hojas debe traer un documento de varias hojas', async () => {
    const p = await montar(lista([doc({ id: 2, hojasMinimas: 2 })]));
    expect(p.q('.documento')?.textContent).toContain('Debe traer 2 hojas');
  });

  describe('filtro de régimen subsidiado', () => {
    const afiliacion = (c: Partial<DocumentoSolicitud> = {}) =>
      doc({
        id: 3,
        codigo: 'PCD_AFILIACION_SUBSIDIADO',
        nombre: 'Soporte de afiliación al régimen subsidiado',
        automatico: true,
        ...c,
      });

    it('consulta sola con el documento y, si es subsidiada, adjunta la constancia sin pedir archivo', async () => {
      const p = montarPantalla(DocumentosPanel, { editable: true });
      p.ctrl.expectOne(URL).flush(lista([afiliacion()]));
      await p.asentar();
      p.ctrl.expectOne(`${API_BASE}/publico/caracterizacion/regimen`).flush({
        consulta: { estado: 'SUBSIDIADO', mensaje: 'AC', consultadaAt: '2026-11-04T10:00:00Z' },
      });
      await p.asentar();
      p.ctrl.expectOne(URL).flush(
        lista([
          afiliacion({
            estado: 'CARGADO',
            archivo: archivoCargado('constancia-regimen-subsidiado.pdf'),
            consulta: { estado: 'SUBSIDIADO', mensaje: 'AC', consultadaAt: '2026-11-04T10:00:00Z' },
          }),
        ]),
      );
      await p.asentar();
      const caja = p.el.querySelector('.consulta')!;
      expect(caja.textContent).toContain('Confirmado');
      expect(caja.textContent).toContain('no tiene que subir');
      expect(p.el.querySelector('.documento input[type="file"]')).toBeNull();
      expect(p.el.querySelector('.consulta button')).toBeNull();
    });

    it('si no es subsidiada lo dice y permite volver a consultar, sin cargar archivo', async () => {
      const p = montarPantalla(DocumentosPanel, { editable: true });
      p.ctrl.expectOne(URL).flush(lista([afiliacion()]));
      await p.asentar();
      p.ctrl.expectOne(`${API_BASE}/publico/caracterizacion/regimen`).flush({
        consulta: { estado: 'NO_SUBSIDIADO', mensaje: 'no', consultadaAt: '2026-11-04T10:00:00Z' },
      });
      await p.asentar();
      p.ctrl.expectOne(URL).flush(
        lista([
          afiliacion({
            consulta: {
              estado: 'NO_SUBSIDIADO',
              mensaje: 'no',
              consultadaAt: '2026-11-04T10:00:00Z',
            },
          }),
        ]),
      );
      await p.asentar();
      expect(p.el.querySelector('.consulta')?.getAttribute('role')).toBe('status');
      expect(p.el.querySelector('.consulta .error')?.textContent).toContain('régimen subsidiado');
      expect(p.el.querySelector('.documento input[type="file"]')).toBeNull();
      p.el.querySelector<HTMLButtonElement>('.consulta button')!.click();
      p.ctrl.expectOne(`${API_BASE}/publico/caracterizacion/regimen`);
    });
  });

  it('carga un archivo, lo envía por el formulario y actualiza la lista', async () => {
    const p = await montar(lista([doc({ id: 1 }), doc({ id: 2 })]));
    await p.elegir(0, pdf('cedula.pdf'));
    const req = p.ctrl.expectOne(`${URL}/1`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('archivo')).toBeInstanceOf(File);
    expect(((req.request.body as FormData).get('archivo') as File).name).toBe('cedula.pdf');
    expect(req.request.headers.get('Authorization')).toContain('Bearer');
    req.flush(doc({ id: 1, estado: 'CARGADO', archivo: archivoCargado('cedula.pdf') }), {
      status: 201,
      statusText: 'Creado',
    });
    await p.asentar();
    p.ctrl
      .expectOne(URL)
      .flush(
        lista([
          doc({ id: 1, estado: 'CARGADO', archivo: archivoCargado('cedula.pdf') }),
          doc({ id: 2 }),
        ]),
      );
    await p.asentar();
    expect(p.q('.documento .estado')?.textContent).toContain('Cargado');
    expect(p.q('.documento .exito')?.textContent).toContain('Se cargó «cedula.pdf»');
    expect(p.q('.resumen p')?.textContent).toContain('1 de 2');
  });

  it('avisa a la pantalla cuando cambia la lista de documentos', async () => {
    const p = montarPantalla(DocumentosPanel, { editable: true });
    const avisos: DocumentosSolicitud[] = [];
    p.fixture.componentInstance.actualizado.subscribe((d) => avisos.push(d));
    p.ctrl.expectOne(URL).flush(lista([doc({ id: 1 })]));
    await p.asentar();
    expect(avisos).toHaveLength(1);
    expect(avisos[0]!.resumen.obligatorios).toBe(1);
  });

  describe('validación en el equipo, antes de enviar', () => {
    it('rechaza un formato que no se acepta sin llamar al servidor', async () => {
      const p = await montar(lista([doc({ id: 1 })]));
      await p.elegir(0, new File(['hola'], 'nota.txt', { type: 'text/plain' }));
      p.ctrl.expectNone(`${URL}/1`);
      expect(p.q('.documento .error')?.textContent).toContain(
        'Solo se aceptan archivos PDF, JPG o PNG',
      );
    });

    it('rechaza un archivo demasiado pesado y dice cuánto pesa y cuál es el máximo', async () => {
      const p = await montar(lista([doc({ id: 1 })], 1));
      const grande = new File([new Uint8Array(1_300_000)], 'grande.pdf', {
        type: 'application/pdf',
      });
      await p.elegir(0, grande);
      p.ctrl.expectNone(`${URL}/1`);
      const t = p.q('.documento .error')!.textContent!;
      expect(t).toContain('pesa 1,2 MB');
      expect(t).toContain('máximo permitido es 1 MB');
    });

    it('rechaza un archivo vacío', async () => {
      const p = await montar(lista([doc({ id: 1 })]));
      await p.elegir(0, new File([], 'vacio.pdf', { type: 'application/pdf' }));
      p.ctrl.expectNone(`${URL}/1`);
      expect(p.q('.documento .error')?.textContent).toContain('está vacío');
    });

    it('acepta «.jpeg» cuando se permite JPG', async () => {
      const p = await montar(lista([doc({ id: 1 })]));
      await p.elegir(0, new File(['x'], 'foto.JPEG', { type: 'image/jpeg' }));
      p.ctrl.expectOne(`${URL}/1`);
    });
  });

  it('muestra el mensaje del servidor cuando rechaza el archivo', async () => {
    const p = await montar(lista([doc({ id: 1 })]));
    await p.elegir(0, pdf());
    p.ctrl
      .expectOne(`${URL}/1`)
      .flush(
        errorApi('VALIDACION', 'Revise', [
          { campo: 'archivo', mensaje: 'El archivo no corresponde a su extensión (.pdf).' },
        ]),
        { status: 422, statusText: 'Inválido' },
      );
    await p.asentar();
    expect(p.q('.documento .error')?.textContent).toContain('no corresponde a su extensión');
    expect(p.q('.documento .estado')?.textContent).toContain('Pendiente');
  });

  it('con la solicitud ya radicada no ofrece cargar ni reemplazar', async () => {
    const p = await montar(
      lista([doc({ id: 1, estado: 'CARGADO', archivo: archivoCargado('a.pdf') })]),
      false,
    );
    expect(p.q('.documento input[type="file"]')).toBeNull();
    expect(p.q('.documento .archivo button')?.textContent).toContain('Ver mi archivo');
  });

  it('un error al cargar la lista permite intentar de nuevo', async () => {
    const p = montarPantalla(DocumentosPanel, { editable: true });
    p.ctrl.expectOne(URL).flush(errorApi('ERROR_INTERNO', 'Falla'), {
      status: 500,
      statusText: 'Error',
    });
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('Falla');
    p.el.querySelector<HTMLButtonElement>('button')!.click();
    await p.asentar();
    p.ctrl.expectOne(URL).flush(lista([doc({ id: 1 })]));
    await p.asentar();
    expect(p.el.querySelectorAll('.documento')).toHaveLength(1);
  });
});
