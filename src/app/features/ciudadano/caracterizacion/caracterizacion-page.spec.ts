import { TestBed } from '@angular/core/testing';
import { API_BASE } from '../../../core/api/api';
import {
  Avance,
  Caracterizacion,
  CaracterizacionGuardada,
  DatosCaracterizacion,
  SesionCiudadano,
} from '../../../core/publico/caracterizacion-api';
import { errorApi, montarPantalla } from '../../../testing/config';
import { CAMPOS } from './caracterizacion-datos';
import { CaracterizacionPage } from './caracterizacion-page';

const URL = `${API_BASE}/publico/caracterizacion`;
const DOCS = `${URL}/documentos`;

const documentos = (cargados = 0) => ({
  editable: true,
  reglas: { formatos: ['pdf', 'jpg', 'png'], maxMb: 5 },
  documentos: [
    {
      id: 1,
      codigo: 'PCD_DOCUMENTO_IDENTIDAD',
      nombre: 'Documento de identidad',
      descripcion: 'Copia legible.',
      aplicaA: 'PCD',
      obligatorio: true,
      estado: cargados > 0 ? 'CARGADO' : 'PENDIENTE',
      reemplazos: 0,
      archivo: null,
      tieneModelo: false,
      generado: false,
      automatico: false,
      consulta: null,
      documentoConsultado: null,
      hojasMinimas: 1,
    },
    {
      id: 2,
      codigo: 'COMUN_CARTA_SOLICITUD',
      nombre: 'Carta de solicitud',
      descripcion: 'Firmada por ambos.',
      aplicaA: 'COMUN',
      obligatorio: true,
      estado: cargados > 1 ? 'CARGADO' : 'PENDIENTE',
      reemplazos: 0,
      archivo: null,
      tieneModelo: false,
      generado: true,
      automatico: false,
      consulta: null,
      hojasMinimas: 1,
    },
  ],
  resumen: { obligatorios: 2, cargados, completo: cargados === 2 },
});

const item = (id: number, nombre: string) => ({ id, codigo: nombre.toUpperCase(), nombre });

const vacios = (): DatosCaracterizacion =>
  Object.fromEntries(CAMPOS.map((c) => [c, null])) as unknown as DatosCaracterizacion;

const avance = (parcial: Partial<Avance> = {}): Avance => ({
  secciones: [
    {
      codigo: 'datos-personales',
      nombre: 'Datos personales',
      requeridos: 2,
      completados: 0,
      completa: false,
      faltantes: [
        { campo: 'generoId', mensaje: 'Género: elija una opción' },
        { campo: 'celular', mensaje: 'Celular: escriba su número' },
      ],
    },
    {
      codigo: 'situacion',
      nombre: 'Su situación',
      requeridos: 1,
      completados: 0,
      completa: false,
      faltantes: [{ campo: 'ocupacionId', mensaje: 'Ocupación: elija una opción' }],
    },
    {
      codigo: 'salud-apoyos',
      nombre: 'Salud y apoyos',
      requeridos: 3,
      completados: 0,
      completa: false,
      faltantes: [],
    },
    {
      codigo: 'transporte',
      nombre: 'Transporte',
      requeridos: 1,
      completados: 0,
      completa: false,
      faltantes: [],
    },
  ],
  requeridos: 7,
  completados: 0,
  porcentaje: 0,
  completa: false,
  ...parcial,
});

const respuesta = (cambios: Partial<Caracterizacion> = {}): Caracterizacion => ({
  solicitud: {
    vigencia: 2026,
    estado: { codigo: 'CORREO_VERIFICADO', nombre: 'Correo verificado' },
    editable: true,
    explicacion: 'Su correo está verificado.',
    siguientePaso: 'Complete la caracterización.',
    radicado: null,
    radicadaAt: null,
  },
  pcd: {
    nombre: 'María Fernanda Pérez',
    tipoIdentificacion: { codigo: 'CC', nombre: 'Cédula de Ciudadanía' },
    numero: '1045678901',
    correo: 'familia@correo.com',
  },
  cuidador: {
    nombre: 'Carlos López',
    tipoIdentificacion: { codigo: 'CC', nombre: 'Cédula de Ciudadanía' },
    numero: '1045678902',
    nombreEditable: true,
  },
  datos: vacios(),
  subsanacion: null,
  avance: avance(),
  version: 0,
  guardadoAt: null,
  catalogos: {
    generos: [item(1, 'Femenino'), item(2, 'Masculino'), item(3, 'Otro'), item(4, 'N/A')],
    estadosCiviles: [item(10, 'Soltero/a'), item(11, 'Casado/a')],
    etnias: [item(20, 'Raizal'), item(21, 'Ninguna')],
    escolaridades: [item(30, 'Educación inicial'), item(31, 'Doctorado')],
    ocupaciones: [item(40, 'Ama de casa'), item(41, 'Estudiante')],
    eps: [item(50, 'Sanitas'), item(51, 'Nueva EPS')],
    tiposTransporte: [item(60, 'Transmetro'), item(61, 'SiBus')],
  },
  ...cambios,
});

const guardada = (
  datos: Partial<DatosCaracterizacion>,
  version = 1,
  a: Avance = avance({ porcentaje: 29, completados: 2 }),
): CaracterizacionGuardada => ({
  version,
  guardadoAt: '2026-10-07T01:47:00Z',
  pcdNombre: 'María Fernanda Pérez',
  cuidadorNombre: 'Carlos López',
  datos: { ...vacios(), ...datos },
  avance: a,
});

describe('CaracterizacionPage', () => {
  async function montar(
    datos: Caracterizacion = respuesta(),
    opciones: { token?: string; sesion?: boolean } = {},
  ) {
    const conSesion = !opciones.token && opciones.sesion !== false;
    if (conSesion) {
      // La persona ya validó su acceso en la consulta: la sesión existe antes de abrir esta pantalla.
      TestBed.configureTestingModule({
        providers: [
          {
            provide: SesionCiudadano,
            useFactory: () => {
              const s = new SesionCiudadano();
              s.establecer('sesion-ciudadano');
              return s;
            },
          },
        ],
      });
    }
    const p = montarPantalla(CaracterizacionPage, opciones.token ? { token: opciones.token } : {});
    if (opciones.token) {
      p.ctrl
        .expectOne(`${API_BASE}/publico/consulta/enlace`)
        .flush({ token: 'sesion-ciudadano', expiraEnMinutos: 30 });
      await p.asentar();
    }
    if (opciones.token || conSesion) {
      p.ctrl.expectOne(URL).flush(datos);
      await p.asentar();
      // Al abrir el formulario se trae el resumen de documentos para el menú.
      for (const r of p.ctrl.match(DOCS)) r.flush(documentos());
      await p.asentar();
    }
    const q = <T extends Element>(s: string) => p.el.querySelector<T>(s);
    const paso = async (nombre: string) => {
      [...p.el.querySelectorAll<HTMLButtonElement>('.paso')]
        .find((b) => b.textContent!.includes(nombre))!
        .click();
      await p.asentar();
    };
    const elegir = async (selector: string, texto: string) => {
      const s = q<HTMLSelectElement>(selector)!;
      s.value = [...s.options].find((o) => o.textContent!.includes(texto))!.value;
      s.dispatchEvent(new Event('change'));
      await p.asentar();
    };
    const marcar = async (selector: string) => {
      q<HTMLInputElement>(selector)!.click();
      await p.asentar();
    };
    const guardarYa = async () => {
      [...p.el.querySelectorAll<HTMLButtonElement>('.acciones button')]
        .find((b) => b.textContent!.includes('Guardar avance'))!
        .click();
      await p.asentar();
    };
    return { ...p, q, paso, elegir, marcar, guardarYa };
  }

  it('sin sesión ni enlace pide validar la identidad y no llama a la API', async () => {
    const p = await montar(respuesta(), { sesion: false });
    expect(p.q('h1')?.textContent).toContain('Complete su caracterización');
    expect(p.q('a[href="/consulta"]')).not.toBeNull();
    p.ctrl.expectNone(URL);
  });

  it('con el enlace seguro del correo abre la sesión y muestra el formulario precargado', async () => {
    const p = await montar(respuesta(), { token: 'enlace-seguro-del-correo-12345' });
    expect(p.el.textContent).toContain('María Fernanda Pérez');
    expect(p.el.textContent).toContain('CC 1045678901');
    expect(p.q<HTMLInputElement>('#car-pcdNombre')!.value).toBe('María Fernanda Pérez');
    expect(p.el.textContent).toContain('familia@correo.com');
    expect(p.el.textContent).toContain('no equivale a la aprobación');
    const opciones = [...p.el.querySelectorAll('#car-generoId option')].map((o) =>
      o.textContent!.trim(),
    );
    expect(opciones).toEqual(['Seleccione', 'Femenino', 'Masculino', 'Otro', 'N/A']);
  });

  it('un enlace vencido explica cómo seguir', async () => {
    const p = montarPantalla(CaracterizacionPage, { token: 'enlace-vencido-del-correo-12345' });
    p.ctrl
      .expectOne(`${API_BASE}/publico/consulta/enlace`)
      .flush(
        errorApi('ENLACE_VENCIDO', 'El enlace venció. Ingrese con su documento y un código.'),
        {
          status: 401,
          statusText: 'No autorizado',
        },
      );
    await p.asentar();
    expect(p.el.querySelector('.aviso.error')?.textContent).toContain('El enlace venció');
    expect(p.el.querySelector('a[href="/consulta"]')).not.toBeNull();
  });

  it('muestra los pasos con el indicador de avance y marca las secciones completas', async () => {
    const a = avance({ porcentaje: 29, completados: 2 });
    a.secciones[0] = { ...a.secciones[0]!, completados: 2, completa: true, faltantes: [] };
    const p = await montar(
      respuesta({ avance: a, version: 1, guardadoAt: '2026-10-07T01:47:00Z' }),
      {},
    );
    const barra = p.q('[role="progressbar"]')!;
    expect(barra.getAttribute('aria-valuenow')).toBe('29');
    expect(p.q('.avance-texto')?.textContent).toContain('29 %');
    expect(p.q('.avance-texto')?.textContent).toContain('2 de 7 datos obligatorios');
    const pasos = [...p.el.querySelectorAll('.paso .nombre')].map((n) =>
      n.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(pasos[0]).toContain('(completa)');
    expect(pasos[1]).toContain('1 dato pendiente');
    expect(pasos[2]).toContain('Salud y apoyos');
    expect(pasos).toHaveLength(6); // sin cuidador, la sección no aparece
    expect(p.q('.guardado')?.textContent).toContain('Avance guardado');
  });

  describe('campos condicionales (RF-CAR-01, RF-CAR-02)', () => {
    it('hijos: la cantidad y las edades solo aparecen si tiene hijos, una casilla por hijo', async () => {
      const p = await montar();
      await p.paso('Su situación');
      expect(p.q('#car-hijosCantidad')).toBeNull();
      await p.marcar('input[formcontrolname="tieneHijos"]');
      expect(p.q('#car-hijosCantidad')).not.toBeNull();
      p.escribir('#car-hijosCantidad', '3');
      await p.asentar();
      expect(p.el.querySelectorAll('[id^="car-hijo-"]')).toHaveLength(3);
      p.escribir('#car-hijosCantidad', '2');
      await p.asentar();
      expect(p.el.querySelectorAll('[id^="car-hijo-"]')).toHaveLength(2);
      // Al decir que no tiene hijos desaparecen.
      const no = p.el.querySelectorAll<HTMLInputElement>('input[formcontrolname="tieneHijos"]')[1]!;
      no.click();
      await p.asentar();
      expect(p.q('#car-hijosCantidad')).toBeNull();
    });

    it('gestación y subsidio: aparecen solo cuando aplican', async () => {
      const p = await montar();
      await p.paso('Salud y apoyos');
      expect(p.q('#car-semanasGestacion')).toBeNull();
      expect(p.q('#car-subsidioCual')).toBeNull();
      await p.marcar('input[formcontrolname="embarazo"][value="SI"]');
      await p.marcar('input[formcontrolname="recibeSubsidios"]');
      expect(p.q('#car-semanasGestacion')).not.toBeNull();
      expect(p.q('#car-subsidioCual')).not.toBeNull();
      await p.marcar('input[formcontrolname="embarazo"][value="NO"]');
      expect(p.q('#car-semanasGestacion')).toBeNull();
    });

    it('el embarazo se ajusta al género: masculino solo «No aplica», femenino sin «No aplica»', async () => {
      const p = await montar();
      const opciones = () =>
        [...p.el.querySelectorAll<HTMLInputElement>('input[formcontrolname="embarazo"]')].map(
          (i) => i.value,
        );
      await p.paso('Datos personales');
      await p.elegir('#car-generoId select, select[formcontrolname="generoId"]', 'Masculino');
      await p.paso('Salud y apoyos');
      expect(opciones()).toEqual(['NO_APLICA']);
      expect(
        p.q<HTMLInputElement>('input[formcontrolname="embarazo"][value="NO_APLICA"]')!.checked,
      ).toBe(true);
      await p.paso('Datos personales');
      await p.elegir('select[formcontrolname="generoId"]', 'Femenino');
      await p.paso('Salud y apoyos');
      expect(opciones()).toEqual(['NO', 'SI']);
      expect(p.q<HTMLInputElement>('input[formcontrolname="embarazo"]:checked')).toBeNull();
      await p.paso('Datos personales');
      await p.elegir('select[formcontrolname="generoId"]', 'Otro');
      await p.paso('Salud y apoyos');
      expect(opciones()).toEqual(['NO', 'SI', 'NO_APLICA']);
    });

    it('la sección del cuidador solo aparece si requiere el servicio', async () => {
      const p = await montar();
      const nombres = () =>
        [...p.el.querySelectorAll('.paso .nombre')].map((n) => n.textContent!.trim());
      expect(nombres().some((n) => n.includes('Cuidador'))).toBe(false);
      await p.paso('Transporte');
      await p.marcar('input[formcontrolname="requiereCuidador"]');
      expect(nombres().some((n) => n.includes('Cuidador'))).toBe(true);
      await p.paso('Cuidador');
      expect(p.q('#car-cuidadorCelular')).not.toBeNull();
      expect(p.el.textContent).toContain('1045678902');
      await p.paso('Transporte');
      p.el
        .querySelectorAll<HTMLInputElement>('input[formcontrolname="requiereCuidador"]')[1]!
        .click();
      await p.asentar();
      expect(nombres().some((n) => n.includes('Cuidador'))).toBe(false);
    });

    it('si el cuidador figura en otra solicitud, su nombre no se puede editar', async () => {
      const base = respuesta();
      const p = await montar(
        respuesta({
          cuidador: { ...base.cuidador!, nombreEditable: false },
          datos: { ...vacios(), requiereCuidador: true },
        }),
      );
      await p.paso('Cuidador');
      expect(p.q('#car-cuidadorNombre')).toBeNull();
      expect(p.el.textContent).toContain('Carlos López');
    });
  });

  describe('validación mientras escribe', () => {
    it('un celular mal escrito explica cómo corregirlo y no se envía', async () => {
      const p = await montar();
      p.escribir('#car-celular', '12345');
      p.q<HTMLInputElement>('#car-celular')!.dispatchEvent(new Event('blur'));
      await p.asentar();
      expect(p.q('#car-celular-error')?.textContent).toContain('empiece por 3');
      await p.guardarYa();
      p.ctrl.expectNone(URL);
    });

    it('un celular con indicativo y espacios se acepta', async () => {
      const p = await montar();
      p.escribir('#car-celular', '+57 300 123 4567');
      await p.asentar();
      expect(p.q('#car-celular-error')).toBeNull();
    });

    it('la fecha de nacimiento futura se rechaza', async () => {
      const p = await montar();
      p.escribir('#car-fechaNacimiento', '2999-01-01');
      p.q<HTMLInputElement>('#car-fechaNacimiento')!.dispatchEvent(new Event('blur'));
      await p.asentar();
      expect(p.q('#car-fechaNacimiento-error')?.textContent).toContain('fecha futura');
    });

    it('los obligatorios muestran el asterisco', async () => {
      const p = await montar();
      expect(p.q('label[for="car-celular"]')?.textContent).toContain('*');
      expect(p.q('label[for="car-telefonoFijo"]')?.textContent).not.toContain('*');
    });
  });

  describe('guardado de avance (RF-CAR-04)', () => {
    it('«Guardar avance» envía solo lo que cambió, con la versión, y muestra el avance nuevo', async () => {
      const p = await montar();
      p.escribir('#car-celular', '300 123 4567');
      await p.elegir('#car-generoId', 'Femenino');
      await p.guardarYa();
      const req = p.ctrl.expectOne(URL);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.headers.get('Authorization')).toBe('Bearer sesion-ciudadano');
      expect(req.request.body).toEqual({ version: 0, celular: '3001234567', generoId: 1 });
      req.flush(guardada({ celular: '3001234567', generoId: 1 }));
      await p.asentar();
      expect(p.q('.avance-texto')?.textContent).toContain('29 %');
      expect(p.q('.guardado')?.textContent).toContain('Avance guardado');
      // Guardar de nuevo sin cambios no llama a la API.
      await p.guardarYa();
      p.ctrl.expectNone(URL);
    });

    it('se guarda solo después de una pausa al escribir', async () => {
      const p = await montar();
      p.escribir('#car-celular', '3001234567');
      await p.asentar();
      expect(p.q('.guardado')?.textContent).toContain('Hay cambios sin guardar');
      p.ctrl.expectNone(URL);
      await new Promise((r) => setTimeout(r, 1500));
      const req = p.ctrl.expectOne(URL);
      expect(req.request.body).toEqual({ version: 0, celular: '3001234567' });
      req.flush(guardada({ celular: '3001234567' }));
      await p.asentar();
      expect(p.q('.guardado')?.textContent).toContain('Avance guardado');
    });

    it('al cambiar de sección guarda lo escrito', async () => {
      const p = await montar();
      p.escribir('#car-celular', '3001234567');
      await p.paso('Su situación');
      const req = p.ctrl.expectOne(URL);
      expect(req.request.body.celular).toBe('3001234567');
      req.flush(guardada({ celular: '3001234567' }));
      await p.asentar();
    });

    it('borrar un dato obligatorio ya guardado también se guarda', async () => {
      const datos = { ...vacios(), celular: '3001234567', generoId: 1 };
      const p = await montar(respuesta({ datos, version: 3, guardadoAt: '2026-10-07T01:47:00Z' }));
      p.escribir('#car-celular', '');
      await p.guardarYa();
      const req = p.ctrl.expectOne(URL);
      expect(req.request.body).toEqual({ version: 3, celular: null });
      req.flush(guardada({ generoId: 1 }, 4));
      await p.asentar();
    });

    it('lo que ya no aplica no se envía: al decir que no tiene hijos se envía solo esa respuesta', async () => {
      const p = await montar();
      await p.paso('Su situación');
      p.el.querySelectorAll<HTMLInputElement>('input[formcontrolname="tieneHijos"]')[1]!.click();
      await p.asentar();
      await p.guardarYa();
      const req = p.ctrl.expectOne(URL);
      expect(req.request.body).toEqual({ version: 0, tieneHijos: false });
      req.flush(guardada({ tieneHijos: false }));
      await p.asentar();
    });

    it('los errores del servidor se marcan en el campo y lo demás se sigue guardando', async () => {
      const p = await montar();
      p.escribir('#car-celular', '3001234567');
      p.escribir('#car-telefonoFijo', '6051234567');
      await p.guardarYa();
      p.ctrl
        .expectOne(URL)
        .flush(
          errorApi('VALIDACION', 'Revise los datos ingresados', [
            { campo: 'telefonoFijo', mensaje: 'Teléfono fijo: ese número no es válido' },
          ]),
          { status: 422, statusText: 'Inválido' },
        );
      await p.asentar();
      expect(p.q('#car-telefonoFijo-error')?.textContent).toContain('no es válido');
      expect(p.q('.guardado')?.textContent).toContain('Revise los datos marcados');
      // La siguiente vuelta guarda el celular y deja fuera el campo con error.
      await new Promise((r) => setTimeout(r, 50));
      const req = p.ctrl.expectOne(URL);
      expect(req.request.body).toEqual({ version: 0, celular: '3001234567' });
      req.flush(guardada({ celular: '3001234567' }));
      await p.asentar();
    });

    it('si se guardó en otra ventana, avisa y ofrece recargar lo último', async () => {
      const p = await montar();
      p.escribir('#car-celular', '3001234567');
      await p.guardarYa();
      p.ctrl
        .expectOne(URL)
        .flush(
          errorApi('CONFLICTO_VERSION', 'La información cambió en otra ventana o dispositivo.'),
          { status: 409, statusText: 'Conflicto' },
        );
      await p.asentar();
      expect(p.q('.aviso.error')?.textContent).toContain('cambió en otra ventana');
      const recargar = [...p.el.querySelectorAll<HTMLButtonElement>('.aviso button')][0]!;
      recargar.click();
      await p.asentar();
      p.ctrl.expectOne(URL).flush(respuesta({ version: 5 }));
      await p.asentar();
      expect(p.q('.aviso.error')).toBeNull();
    });

    it('sin conexión muestra el aviso y reintenta sin perder lo escrito', async () => {
      const p = await montar();
      p.escribir('#car-celular', '3001234567');
      await p.guardarYa();
      p.ctrl.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });
      await p.asentar();
      expect(p.q('.guardado')?.textContent).toContain('Sin conexión');
      expect(p.q<HTMLInputElement>('#car-celular')!.value).toBe('3001234567');
    });

    it('si la sesión venció conserva lo escrito y explica cómo continuar', async () => {
      const p = await montar();
      p.escribir('#car-celular', '3001234567');
      await p.guardarYa();
      p.ctrl.expectOne(URL).flush(errorApi('NO_AUTENTICADO', 'Debe validar su acceso'), {
        status: 401,
        statusText: 'No autorizado',
      });
      await p.asentar();
      expect(p.q('.aviso.error')?.textContent).toContain('sesión venció');
      expect(p.q<HTMLInputElement>('#car-celular')!.value).toBe('3001234567');
    });

    it('corregir el nombre se envía como pcdNombre', async () => {
      const p = await montar();
      p.escribir('#car-pcdNombre', 'María Fernanda Pérez Gómez');
      await p.guardarYa();
      const req = p.ctrl.expectOne(URL);
      expect(req.request.body).toEqual({ version: 0, pcdNombre: 'María Fernanda Pérez Gómez' });
      req.flush({ ...guardada({}), pcdNombre: 'María Fernanda Pérez Gómez' });
      await p.asentar();
      expect(p.el.textContent).toContain('María Fernanda Pérez Gómez');
    });
  });

  it('una solicitud que ya no admite cambios muestra el aviso y no guarda', async () => {
    const base = respuesta();
    const p = await montar(respuesta({ solicitud: { ...base.solicitud, editable: false } }));
    expect(p.q('.aviso.advertencia')?.textContent).toContain('ya no admite cambios');
    expect(p.q('fieldset.seccion')?.hasAttribute('disabled')).toBe(true);
    expect(
      [...p.el.querySelectorAll('.acciones button')].some((b) =>
        b.textContent!.includes('Guardar'),
      ),
    ).toBe(false);
  });

  describe('documentos, revisión y envío (RF-CAR-03, RF-CAR-04)', () => {
    const revisionIncompleta = {
      completo: false,
      datos: [
        { campo: 'ocupacionId', seccion: 'situacion', mensaje: 'Ocupación: elija una opción' },
      ],
      documentos: [
        {
          campo: 'documento:2',
          seccion: 'documentos',
          mensaje: 'Falta cargar: Carta de solicitud',
        },
      ],
    };
    const revisionCompleta = { completo: true, datos: [], documentos: [] };

    /** Abre la revisión: la pantalla guarda lo pendiente y consulta al servidor qué falta. */
    async function abrirRevision(p: Awaited<ReturnType<typeof montar>>, revision: object) {
      await p.paso('Revisión');
      await p.asentar();
      p.ctrl.expectOne(`${URL}/revision`).flush(revision);
      await p.asentar();
    }

    async function confirmarEnvio(p: Awaited<ReturnType<typeof montar>>) {
      p.q<HTMLButtonElement>('.enviar')!.click();
      await p.asentar();
      [...p.el.querySelectorAll<HTMLButtonElement>('dialog button')]
        .find((b) => b.textContent!.includes('Sí, enviar'))!
        .click();
      await p.asentar();
    }

    it('el menú incluye «Documentos» con cuántos faltan', async () => {
      const p = await montar();
      const pasos = [...p.el.querySelectorAll('.paso .nombre')].map((n) =>
        n.textContent!.replace(/\s+/g, ' ').trim(),
      );
      expect(pasos.at(-2)).toContain('Documentos (2 documentos pendientes)');
      expect(pasos.at(-1)).toContain('Revisión y envío');
    });

    it('el paso «Documentos» muestra el panel de carga', async () => {
      const p = await montar();
      await p.paso('Documentos');
      p.ctrl.expectOne(DOCS).flush(documentos());
      await p.asentar();
      expect(p.el.querySelectorAll('.documento')).toHaveLength(2);
      expect(p.el.textContent).toContain('Carta de solicitud');
    });

    it('al cargar los documentos el menú los marca como completos', async () => {
      const p = await montar();
      await p.paso('Documentos');
      p.ctrl.expectOne(DOCS).flush(documentos(2));
      await p.asentar();
      const pasos = [...p.el.querySelectorAll('.paso .nombre')].map((n) =>
        n.textContent!.replace(/\s+/g, ' ').trim(),
      );
      expect(pasos.at(-2)).toContain('(completa)');
    });

    it('la revisión dice qué falta y no deja enviar', async () => {
      const p = await montar();
      await abrirRevision(p, revisionIncompleta);
      expect(p.q('.aviso.advertencia')?.textContent).toContain('Todavía faltan datos o documentos');
      expect(p.el.textContent).toContain('Ocupación: elija una opción');
      expect(p.el.textContent).toContain('Falta cargar: Carta de solicitud');
      expect(p.q<HTMLButtonElement>('.enviar')!.disabled).toBe(true);
    });

    it('desde la revisión se puede ir a completar lo que falta', async () => {
      const p = await montar();
      await abrirRevision(p, revisionIncompleta);
      p.q<HTMLButtonElement>('.faltantes .enlace')!.click();
      await p.asentar();
      expect(p.q('#car-ocupacionId')).not.toBeNull();
    });

    it('con todo completo pide confirmar antes de enviar', async () => {
      const p = await montar();
      await abrirRevision(p, revisionCompleta);
      expect(p.q('.aviso.exito')?.textContent).toContain('Su solicitud está completa');
      const enviar = p.q<HTMLButtonElement>('.enviar')!;
      expect(enviar.disabled).toBe(false);
      enviar.click();
      await p.asentar();
      expect(p.q('dialog h2')?.textContent).toContain('¿Enviar su solicitud?');
      p.ctrl.expectNone(`${URL}/radicar`);
    });

    it('al confirmar radica y muestra el número de radicado, el estado y el siguiente paso', async () => {
      const p = await montar();
      await abrirRevision(p, revisionCompleta);
      await confirmarEnvio(p);
      p.ctrl.expectOne(`${URL}/radicar`).flush(
        {
          radicado: 'EST-2026-000123',
          radicadaAt: '2026-10-07T02:30:00Z',
          estado: { codigo: 'RADICADA', nombre: 'Radicada' },
          explicacion: 'Recibimos su caracterización y sus documentos.',
          siguientePaso: 'Espere la verificación de requisitos.',
          aviso: 'Importante: el registro no equivale a la aprobación del beneficio.',
        },
        { status: 201, statusText: 'Creado' },
      );
      await p.asentar();
      expect(p.q('h1')?.textContent).toContain('Su solicitud fue radicada');
      expect(p.q('.numero')?.textContent).toContain('EST-2026-000123');
      expect(p.q('.comprobante')?.textContent).toContain('06/10/2026 21:30');
      expect(p.q('.comprobante')?.textContent).toContain('Radicada');
      expect(p.el.textContent).toContain('Espere la verificación de requisitos');
      expect(p.el.textContent).toContain('no equivale a la aprobación');
      expect(p.q('a[href="/consulta"]')).not.toBeNull();
      expect(p.q('form')).toBeNull();
    });

    it('si el servidor dice que aún falta algo, lo explica y vuelve a mostrar la lista', async () => {
      const p = await montar();
      await abrirRevision(p, revisionCompleta);
      await confirmarEnvio(p);
      p.ctrl
        .expectOne(`${URL}/radicar`)
        .flush(
          errorApi('VALIDACION', 'Revise los datos ingresados', [
            { campo: 'documento:2', mensaje: 'Falta cargar: Carta de solicitud' },
          ]),
          { status: 422, statusText: 'Inválido' },
        );
      await p.asentar();
      p.ctrl.expectOne(`${URL}/revision`).flush(revisionIncompleta);
      await p.asentar();
      expect(p.q('.aviso.error')?.textContent).toContain('Todavía faltan datos o documentos');
      expect(p.q('dialog[open]')).toBeNull();
      expect(p.q<HTMLButtonElement>('.enviar')!.disabled).toBe(true);
    });

    it('«Volver a revisar» cierra la confirmación sin enviar', async () => {
      const p = await montar();
      await abrirRevision(p, revisionCompleta);
      p.q<HTMLButtonElement>('.enviar')!.click();
      await p.asentar();
      [...p.el.querySelectorAll<HTMLButtonElement>('dialog button')]
        .find((b) => b.textContent!.includes('Volver a revisar'))!
        .click();
      await p.asentar();
      p.ctrl.expectNone(`${URL}/radicar`);
    });

    it('una solicitud ya radicada abre directamente el comprobante, sin formulario', async () => {
      const base = respuesta();
      const p = await montar(
        respuesta({
          solicitud: {
            ...base.solicitud,
            estado: { codigo: 'RADICADA', nombre: 'Radicada' },
            editable: false,
            radicado: 'EST-2026-000007',
            radicadaAt: '2026-10-07T02:30:00Z',
            explicacion: 'Recibimos su caracterización y sus documentos.',
            siguientePaso: 'Espere la verificación de requisitos.',
          },
        }),
      );
      expect(p.q('h1')?.textContent).toContain('Su solicitud fue radicada');
      expect(p.q('.numero')?.textContent).toContain('EST-2026-000007');
      expect(p.q('form')).toBeNull();
      p.ctrl.expectNone(DOCS);
    });

    it('si ya estaba radicada al enviar, muestra el comprobante', async () => {
      const p = await montar();
      await abrirRevision(p, revisionCompleta);
      await confirmarEnvio(p);
      p.ctrl
        .expectOne(`${URL}/radicar`)
        .flush(errorApi('YA_RADICADA', 'Su solicitud ya fue radicada.'), {
          status: 409,
          statusText: 'Conflicto',
        });
      await p.asentar();
      const base = respuesta();
      p.ctrl.expectOne(URL).flush(
        respuesta({
          solicitud: {
            ...base.solicitud,
            estado: { codigo: 'RADICADA', nombre: 'Radicada' },
            editable: false,
            radicado: 'EST-2026-000009',
            radicadaAt: '2026-10-07T02:30:00Z',
          },
        }),
      );
      await p.asentar();
      expect(p.q('.numero')?.textContent).toContain('EST-2026-000009');
    });
  });

  describe('subsanación (RF-CAR-06)', () => {
    const conSubsanacion = (cambios: Partial<NonNullable<Caracterizacion['subsanacion']>> = {}) => {
      const base = respuesta();
      return respuesta({
        solicitud: {
          ...base.solicitud,
          estado: { codigo: 'EN_SUBSANACION', nombre: 'Por subsanar' },
          editable: true,
          radicado: 'EST-2026-000009',
          radicadaAt: '2026-10-07T02:30:00Z',
        },
        subsanacion: {
          estado: 'ABIERTA',
          venceAt: '2026-10-20T04:59:59Z',
          respondidaAt: null,
          puedeResponder: true,
          items: [
            {
              nombre: 'Soporte SISBÉN IV',
              observacion: 'El soporte es de otro mes; cargue el vigente.',
              documentoId: 4,
              campos: [],
            },
            {
              nombre: 'Datos de contacto',
              observacion: 'El celular no responde.',
              documentoId: null,
              campos: ['celular'],
            },
          ],
          documentosEditables: [4],
          camposEditables: ['celular'],
          ...cambios,
        },
      });
    };

    it('muestra lo que debe corregir, con la observación y el plazo', async () => {
      const p = await montar(conSubsanacion());
      const aviso = p.q('.subsanacion')!;
      expect(aviso.textContent).toContain('Debe corregir lo siguiente');
      expect(aviso.textContent).toContain('El soporte es de otro mes; cargue el vigente.');
      expect(aviso.textContent).toContain('El celular no responde.');
      expect(aviso.textContent).toContain('19/10/2026');
    });

    it('solo se puede modificar lo señalado: lo demás queda bloqueado', async () => {
      const p = await montar(conSubsanacion());
      expect(p.q<HTMLInputElement>('#car-celular')!.disabled).toBe(false);
      expect(p.q<HTMLInputElement>('#car-telefonoFijo')!.disabled).toBe(true);
      expect(p.q<HTMLSelectElement>('#car-generoId')!.disabled).toBe(true);
      expect(p.q<HTMLInputElement>('#car-pcdNombre')!.disabled).toBe(true);
    });

    it('en el último paso envía las correcciones y muestra que volvió a revisión', async () => {
      const p = await montar(conSubsanacion());
      await p.paso('Revisión');
      expect(p.q('.enviar')?.textContent).toContain('Enviar mis correcciones');
      p.ctrl.expectNone(`${URL}/revision`);
      p.q<HTMLButtonElement>('.enviar')!.click();
      await p.asentar();
      [...p.el.querySelectorAll<HTMLButtonElement>('dialog[open] button')]
        .find((b) => b.textContent!.includes('Sí, enviar mis correcciones'))!
        .click();
      await p.asentar();
      const r = p.ctrl.expectOne(`${URL}/subsanacion/responder`);
      expect(r.request.method).toBe('POST');
      r.flush({
        estado: { codigo: 'SUBSANADA', nombre: 'Subsanada' },
        explicacion: 'Recibimos sus correcciones. Su solicitud volvió a revisión.',
        siguientePaso: 'Espere el resultado.',
      });
      await p.asentar();
      expect(p.q('h1')?.textContent).toContain('Recibimos sus correcciones');
      expect(p.el.textContent).toContain('Subsanada');
    });

    it('si falta algo, el servidor lo dice y la persona sigue en el formulario', async () => {
      const p = await montar(conSubsanacion());
      await p.paso('Revisión');
      p.q<HTMLButtonElement>('.enviar')!.click();
      await p.asentar();
      [...p.el.querySelectorAll<HTMLButtonElement>('dialog[open] button')]
        .find((b) => b.textContent!.includes('Sí, enviar mis correcciones'))!
        .click();
      await p.asentar();
      p.ctrl
        .expectOne(`${URL}/subsanacion/responder`)
        .flush(
          errorApi('VALIDACION', 'Revise', [
            { campo: 'documento:4', mensaje: 'Cargue el documento corregido: Soporte SISBÉN IV' },
          ]),
          { status: 422, statusText: 'No procesable' },
        );
      await p.asentar();
      expect(p.q('.aviso.error')?.textContent).toContain('Cargue el documento corregido');
      expect(p.q('h1')?.textContent).not.toContain('Recibimos');
    });

    it('con el plazo vencido avisa que el funcionario revisará el caso y no deja enviar', async () => {
      const vencida = conSubsanacion({ estado: 'VENCIDA', puedeResponder: false });
      // Con el plazo vencido el servidor ya no deja editar nada.
      vencida.solicitud.editable = false;
      const p = await montar(vencida);
      expect(p.q('.subsanacion')?.textContent).toContain('El plazo para corregir terminó');
      await p.paso('Revisión');
      expect(p.el.textContent).not.toContain('Enviar mis correcciones');
      expect(p.q('.enviar')).toBeNull();
    });
  });
});
