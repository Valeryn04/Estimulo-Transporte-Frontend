import { API_BASE } from '../../../../core/api/api';
import { montarPantalla } from '../../../../testing/config';
import { DocumentosPage } from './documentos-page';
import { esperarTareas } from '../../../../testing/asentar';

const doc = (c: object) => ({
  id: 1,
  codigo: 'PCD_CERTIFICADO_DISCAPACIDAD',
  nombre: 'Certificado de discapacidad',
  descripcion: 'Vigente y completo',
  aplicaA: 'PCD',
  obligatorio: true,
  hojasMinimas: 1,
  generado: null,
  activo: true,
  version: 1,
  ...c,
});

describe('DocumentosPage', () => {
  async function montar() {
    const p = montarPantalla(DocumentosPage);
    p.ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos`).flush({
      items: [
        doc({}),
        doc({
          id: 2,
          nombre: 'Carta de cuidado',
          aplicaA: 'CUIDADOR',
          obligatorio: false,
          activo: false,
        }),
      ],
    });
    await p.asentar();
    return p;
  }

  it('lista los documentos con a quién aplican, si son obligatorios y su estado', async () => {
    const { el } = await montar();
    const filas = el.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('Persona con discapacidad');
    expect(filas[0]?.textContent).toContain('Obligatorio');
    expect(filas[1]?.textContent).toContain('Cuidador');
    expect(filas[1]?.textContent).toContain('Opcional');
    expect(filas[1]?.textContent).toContain('Inactivo');
  });

  it('crea un documento con sus datos y recarga la lista', async () => {
    const { el, ctrl, escribir, enviar, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    enviar();
    await asentar();
    ctrl.expectNone((r) => r.method === 'POST');
    escribir('#doc-nombre', 'Registro RLCPD');
    escribir('#doc-aplica', 'COMUN');
    escribir('#doc-hojas', '2');
    enviar();
    const req = ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos`);
    expect(req.request.body).toEqual({
      nombre: 'Registro RLCPD',
      descripcion: '',
      aplicaA: 'COMUN',
      obligatorio: true,
      hojasMinimas: 2,
    });
    req.flush(doc({ id: 3 }), { status: 201, statusText: 'Creado' });
    await asentar();
    ctrl
      .expectOne(`${API_BASE}/admin/documentos-requeridos`)
      .flush({ items: [doc({ id: 3, nombre: 'Registro RLCPD' })] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('Registro RLCPD');
  });

  it('activa y desactiva sin borrar', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('button[title="Activar Carta de cuidado"]')!.click();
    await esperarTareas();
    ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos/2/activar`).flush(doc({ id: 2 }));
    await asentar();
    ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos`).flush({ items: [doc({})] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('activado');
  });

  describe('modelo descargable (RF-CAR-03)', () => {
    const elegir = (el: HTMLElement, indice: number, archivo: File) => {
      const entrada = el.querySelectorAll<HTMLInputElement>('td.modelo input[type="file"]')[
        indice
      ]!;
      Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
      entrada.dispatchEvent(new Event('change'));
    };

    it('muestra qué documentos tienen modelo y cuáles no', async () => {
      const p = montarPantalla(DocumentosPage);
      p.ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos`).flush({
        items: [
          doc({
            id: 8,
            nombre: 'Carta de solicitud',
            modelo: {
              nombre: 'Carta.pdf',
              formato: 'pdf',
              tamanoBytes: 2_048,
              cargadoAt: '2026-10-07T00:00:00Z',
            },
          }),
          doc({ id: 2, nombre: 'Certificado de discapacidad' }),
        ],
      });
      await p.asentar();
      const celdas = [...p.el.querySelectorAll('td.modelo')].map((c) =>
        c.textContent!.replace(/\s+/g, ' ').trim(),
      );
      expect(celdas[0]).toContain('Carta.pdf');
      expect(celdas[0]).toContain('PDF · 2 KB');
      expect(celdas[0]).toContain('Reemplazar');
      expect(celdas[1]).toContain('Sin modelo');
      expect(celdas[1]).toContain('Cargar modelo');
    });

    it('publica el modelo, avisa y recarga la lista', async () => {
      const p = await montar();
      const modelo = new File(['%PDF-1.4'], 'Carta de solicitud.pdf', { type: 'application/pdf' });
      elegir(p.el, 0, modelo);
      const req = p.ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos/1/modelo`);
      expect(req.request.method).toBe('PUT');
      expect((req.request.body as FormData).get('archivo')).toBeInstanceOf(File);
      req.flush({ documentoId: 1, nombre: 'Carta de solicitud.pdf' });
      await p.asentar();
      p.ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos`).flush({ items: [doc({})] });
      await p.asentar();
      expect(p.el.querySelector('.aviso.exito')?.textContent).toContain('Se publicó el modelo');
    });

    it('muestra el motivo cuando el servidor rechaza el archivo', async () => {
      const p = await montar();
      elegir(p.el, 0, new File(['texto'], 'carta.txt', { type: 'text/plain' }));
      p.ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos/1/modelo`).flush(
        {
          error: {
            codigo: 'VALIDACION',
            mensaje: 'Revise',
            errores: [
              {
                campo: 'archivo',
                mensaje: 'El formato no es válido. Solo se aceptan modelos en PDF, DOCX u ODT.',
              },
            ],
          },
        },
        { status: 422, statusText: 'Inválido' },
      );
      await p.asentar();
      expect(p.el.querySelector('.aviso.error')?.textContent).toContain('PDF, DOCX u ODT');
    });
  });
});
