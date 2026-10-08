import { API_BASE } from '../../../../core/api/api';
import { montarPantalla } from '../../../../testing/config';
import { DocumentosPage } from './documentos-page';

const doc = (c: object) => ({
  id: 1,
  codigo: 'PCD_SISBEN',
  nombre: 'Soporte SISBÉN IV',
  descripcion: 'Grupo A, B o C',
  aplicaA: 'PCD',
  obligatorio: true,
  orden: 4,
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
    escribir('#doc-orden', '9');
    enviar();
    const req = ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos`);
    expect(req.request.body).toEqual({
      nombre: 'Registro RLCPD',
      descripcion: '',
      aplicaA: 'COMUN',
      obligatorio: true,
      orden: 9,
    });
    req.flush(doc({ id: 3 }), { status: 201, statusText: 'Creado' });
    await asentar();
    ctrl
      .expectOne(`${API_BASE}/admin/documentos-requeridos`)
      .flush({ items: [doc({ id: 3, nombre: 'Registro RLCPD' })] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('Registro RLCPD');
  });

  it('propone la última posición y avisa quién ocupa la que se escriba', async () => {
    const { el, escribir, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('.encabezado .boton')!.click();
    await asentar();
    expect(el.querySelector<HTMLInputElement>('#doc-orden')?.value).toBe('3');
    expect(el.querySelector('dialog')?.textContent).toContain('Quedará al final de la lista');
    escribir('#doc-orden', '4');
    await asentar();
    expect(el.querySelector('dialog')?.textContent).toContain(
      'La posición 4 la tiene «Soporte SISBÉN IV»',
    );
  });

  it('cambia el orden con las flechas: lleva el documento a la posición vecina y recarga', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('button[title="Subir Soporte SISBÉN IV"]')!.click();
    const req = ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos/1/mover`);
    expect(req.request.body).toEqual({ orden: 3 });
    req.flush(doc({ orden: 3 }));
    await asentar();
    ctrl.expectOne(`${API_BASE}/admin/documentos-requeridos`).flush({ items: [doc({ orden: 3 })] });
    await asentar();
    expect(el.querySelector('.aviso.exito')?.textContent).toContain('quedó en la posición 3');
    expect(el.querySelector('button[title="Bajar Soporte SISBÉN IV"]')).not.toBeNull();
  });

  it('activa y desactiva sin borrar', async () => {
    const { el, ctrl, asentar } = await montar();
    el.querySelector<HTMLButtonElement>('button[title="Activar Carta de cuidado"]')!.click();
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
          doc({ id: 2, nombre: 'Soporte SISBÉN IV' }),
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
