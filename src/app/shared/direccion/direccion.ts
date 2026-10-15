import { Component, OnInit, computed, inject, input, DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { Campo } from '../campo';
import { CampoControl } from '../campo-control';
import {
  LETRAS,
  MAX_COMPLEMENTO,
  ORIENTACIONES,
  PARTES_VACIAS,
  TIPOS_VIA,
  evaluarDireccion,
  armarParcial,
  limpiarComplemento,
  partesDeDireccion,
  textoFaltantes,
  type PartesDireccion,
} from './direccion-formato';

/**
 * Dirección de residencia estandarizada: se arma por partes (tipo de vía, número, cruce, placa y complemento) y
 * muestra debajo cómo va quedando. El control que recibe guarda solo la dirección ya armada (o vacío mientras no esté
 * completa) y marca el error `direccion` si la persona empezó a escribirla y le falta algo.
 */
@Component({
  selector: 'app-direccion',
  imports: [ReactiveFormsModule, Campo, CampoControl],
  templateUrl: './direccion.html',
  styleUrl: './direccion.scss',
})
export class Direccion implements OnInit {
  private readonly destruir = inject(DestroyRef);

  readonly idCampo = input.required<string>();
  readonly etiqueta = input('Dirección de residencia');
  readonly ayuda = input('');
  /** Control del formulario que recibe la dirección armada. */
  readonly control = input.required<FormControl<string>>();

  protected readonly tipos = TIPOS_VIA;
  protected readonly orientaciones = ORIENTACIONES;
  protected readonly letras = LETRAS;
  protected readonly maxComplemento = MAX_COMPLEMENTO;

  protected readonly partes = new FormGroup({
    tipo: new FormControl('', { nonNullable: true }),
    numero: new FormControl('', { nonNullable: true }),
    letra: new FormControl('', { nonNullable: true }),
    bis: new FormControl('', { nonNullable: true }),
    orientacion: new FormControl('', { nonNullable: true }),
    cruce: new FormControl('', { nonNullable: true }),
    cruceLetra: new FormControl('', { nonNullable: true }),
    placa: new FormControl('', { nonNullable: true }),
    placaOrientacion: new FormControl('', { nonNullable: true }),
    complemento: new FormControl('', { nonNullable: true }),
  });

  private readonly valores = toSignal(
    this.partes.valueChanges.pipe(
      startWith(null),
      map(() => this.partes.getRawValue() as PartesDireccion),
    ),
    { initialValue: PARTES_VACIAS },
  );
  protected readonly estado = computed(() => evaluarDireccion(this.valores()));
  /** Lo que va quedando, desde el primer dato (el aviso de lo que falta solo sale al intentar enviar). */
  protected readonly vista = computed(() => armarParcial(this.valores()));
  /** Mensaje del error cuando la dirección quedó a medias. */
  protected readonly mensajes = computed(() => ({
    direccion: textoFaltantes(this.estado().faltantes),
  }));

  ngOnInit(): void {
    const control = this.control();
    // Si ya trae una dirección con el formato estándar, se reparte en sus partes.
    const inicial = partesDeDireccion(control.value ?? '');
    if (inicial) this.partes.reset(inicial, { emitEvent: false });
    // Si empezó a escribirla y falta algo, el control queda con error (y vacío): nunca se envía a medias.
    control.addValidators(() => {
      const e = evaluarDireccion(this.partes.getRawValue() as PartesDireccion);
      return e.iniciada && !e.completa ? { direccion: textoFaltantes(e.faltantes) } : null;
    });
    const sincronizar = () => {
      const e = evaluarDireccion(this.partes.getRawValue() as PartesDireccion);
      control.setValue(e.completa ? e.texto : '');
    };
    this.partes.valueChanges.pipe(takeUntilDestroyed(this.destruir)).subscribe(sincronizar);
    sincronizar();
  }

  /** Solo números en los campos numéricos (hasta 3 dígitos). */
  protected soloNumeros(nombre: 'numero' | 'cruce' | 'placa', evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const limpio = entrada.value.replace(/\D/g, '').slice(0, 3);
    if (limpio !== entrada.value) entrada.value = limpio;
    this.partes.controls[nombre].setValue(limpio);
  }

  protected limpiarComplemento(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    // Se quitan los caracteres no permitidos al escribir, sin recortar los espacios que la persona aún está tecleando.
    const sinRaros = entrada.value.replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .\-#]/g, '');
    if (sinRaros !== entrada.value) entrada.value = sinRaros;
    this.partes.controls.complemento.setValue(sinRaros);
  }

  protected completarComplemento(): void {
    const c = this.partes.controls.complemento;
    c.setValue(limpiarComplemento(c.value));
  }
}
