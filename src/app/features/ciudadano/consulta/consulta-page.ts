import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  OnInit,
  Signal,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { SesionCiudadano } from '../../../core/publico/caracterizacion-api';
import {
  EstadoSolicitud,
  IdentificacionConsulta,
  PublicoApi,
  TipoIdentificacion,
} from '../../../core/publico/publico-api';
import { Campo } from '../../../shared/campo';
import { ocultarTokenEnLaUrl } from '../../../shared/enlace';
import { Icono } from '../../../shared/icono/icono';
import { CampoControl } from '../../../shared/campo-control';
import { valorDe } from '../../../shared/forms';
import { numeroSegunTipo, soloDigitos } from '../../../shared/identificacion';

type Paso = 'cargando' | 'identificar' | 'codigo' | 'resultado';
type Modo = 'documento' | 'radicado';

/**
 * Consulta del estado de la solicitud (RF-PRE-05, RNF-05). La persona valida su acceso con un código de un solo
 * uso enviado a su correo registrado, o entra con el enlace seguro de las notificaciones. Hasta entonces no se
 * muestra ninguna información de la solicitud.
 */
@Component({
  selector: 'app-consulta-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Campo, CampoControl, Icono],
  templateUrl: './consulta-page.html',
  styleUrl: './consulta-page.scss',
})
export class ConsultaPage implements OnInit {
  private readonly api = inject(PublicoApi);
  private readonly sesion = inject(SesionCiudadano);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  /** Parámetro de consulta `?token=` del enlace seguro. */
  readonly token = input<string>();

  protected readonly paso = signal<Paso>('cargando');
  protected readonly tipos = signal<TipoIdentificacion[]>([]);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly trabajando = signal(false);
  protected readonly estado = signal<EstadoSolicitud | null>(null);
  /** Cómo indica la persona su solicitud: con su documento o con el número de radicado (RF-PRE-05). */
  protected readonly modo = signal<Modo>('documento');
  private identificada: IdentificacionConsulta | null = null;
  protected readonly titulo = viewChild<ElementRef<HTMLElement>>('tituloEl');

  protected readonly identificacion = new FormGroup({
    tipo: new FormControl<number | null>(null, [Validators.required]),
    numero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, numeroSegunTipo(() => this.codigo())],
    }),
  });
  protected readonly radicadoForm = new FormGroup({
    radicado: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\s*EST-\d{4}-\d{6}\s*$/i)],
    }),
  });
  protected readonly codigoForm = new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });

  private readonly tipoElegido: Signal<number | null> = valorDe(this.identificacion.controls.tipo);
  protected readonly codigo: Signal<string | undefined> = computed(
    () => this.tipos().find((t) => t.id === this.tipoElegido())?.codigo,
  );
  protected readonly modoTeclado = computed(() =>
    soloDigitos(this.codigo()) ? 'numeric' : 'text',
  );

  async ngOnInit(): Promise<void> {
    this.identificacion.controls.tipo.valueChanges.subscribe(() =>
      this.identificacion.controls.numero.updateValueAndValidity(),
    );
    try {
      this.tipos.set((await firstValueFrom(this.api.formulario())).tiposIdentificacion);
    } catch (e) {
      this.error.set(
        e instanceof ApiError ? e.message : 'No pudimos cargar la página. Intente de nuevo.',
      );
    }
    const enlace = this.token();
    if (enlace) {
      ocultarTokenEnLaUrl(this.router, this.ruta);
      await this.entrarConEnlace(enlace);
    } else {
      this.paso.set('identificar');
    }
  }

  private async entrarConEnlace(token: string): Promise<void> {
    try {
      const sesion = await firstValueFrom(this.api.accederPorEnlace(token));
      await this.mostrarEstado(sesion.token);
    } catch (e) {
      this.error.set(
        e instanceof ApiError
          ? e.message
          : 'No pudimos abrir su consulta con el enlace. Use su documento y un código.',
      );
      this.paso.set('identificar');
    }
  }

  private async mostrarEstado(sesionToken: string): Promise<void> {
    this.estado.set(await firstValueFrom(this.api.consultar(sesionToken)));
    // Con la misma sesión la persona puede seguir con la caracterización sin validar de nuevo.
    this.sesion.establecer(sesionToken);
    this.paso.set('resultado');
    this.enfocarTitulo();
  }

  private enfocarTitulo(): void {
    setTimeout(() => this.titulo()?.nativeElement.focus(), 50);
  }

  protected async pedirCodigo(evento?: Event): Promise<void> {
    evento?.preventDefault();
    this.error.set('');
    const conRadicado = this.modo() === 'radicado';
    const formulario = conRadicado ? this.radicadoForm : this.identificacion;
    formulario.markAllAsTouched();
    if (formulario.invalid) return;
    this.trabajando.set(true);
    try {
      this.identificada = conRadicado
        ? { radicado: this.radicadoForm.getRawValue().radicado.trim().toUpperCase() }
        : {
            tipoIdentificacionId: this.identificacion.getRawValue().tipo as number,
            numero: this.identificacion.getRawValue().numero.trim(),
          };
      const r = await firstValueFrom(this.api.solicitarCodigo(this.identificada));
      this.aviso.set(r.mensaje);
      this.codigoForm.reset();
      this.paso.set('codigo');
    } catch (e) {
      this.error.set(
        e instanceof ApiError ? e.message : 'No pudimos enviar el código. Intente de nuevo.',
      );
    } finally {
      this.trabajando.set(false);
    }
  }

  protected async validarCodigo(evento?: Event): Promise<void> {
    evento?.preventDefault();
    this.error.set('');
    this.codigoForm.markAllAsTouched();
    if (this.codigoForm.invalid) return;
    this.trabajando.set(true);
    try {
      const sesion = await firstValueFrom(
        this.api.verificarCodigo({
          ...(this.identificada as IdentificacionConsulta),
          codigo: this.codigoForm.controls.codigo.value.trim(),
        }),
      );
      await this.mostrarEstado(sesion.token);
    } catch (e) {
      this.error.set(
        e instanceof ApiError ? e.message : 'No pudimos validar el código. Intente de nuevo.',
      );
      this.codigoForm.controls.codigo.reset();
    } finally {
      this.trabajando.set(false);
    }
  }

  protected cambiarModo(modo: Modo): void {
    this.modo.set(modo);
    this.error.set('');
  }

  protected volver(): void {
    this.error.set('');
    this.codigoForm.reset();
    this.paso.set('identificar');
  }

  /** Cierra la consulta y borra de la memoria todo lo mostrado. */
  protected salir(): void {
    this.estado.set(null);
    this.sesion.limpiar();
    this.identificacion.reset({ tipo: null, numero: '' });
    this.radicadoForm.reset();
    this.identificada = null;
    this.codigoForm.reset();
    this.aviso.set('');
    this.error.set('');
    this.paso.set('identificar');
  }
}
