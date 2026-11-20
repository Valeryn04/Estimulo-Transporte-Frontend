import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import {
  CaracterizacionApi,
  IdentificacionPersona,
  ItemLista,
  RespuestaCorreccionDocumento,
} from '../../../../core/publico/caracterizacion-api';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { aplicarErroresApi, valorDe } from '../../../../shared/forms';
import { normalizarNumero, numeroSegunTipo, soloDigitos } from '../../../../shared/identificacion';

/**
 * Permite corregir el tipo y el número de documento cuando se escribieron mal en la preinscripción, mientras la
 * solicitud no se haya enviado. El servidor verifica que el documento nuevo no esté ya registrado y, si cambia el
 * de la persona con discapacidad, repite la consulta al régimen de salud con el documento correcto.
 */
@Component({
  selector: 'app-corregir-identificacion',
  imports: [ReactiveFormsModule, Campo, CampoControl],
  templateUrl: './corregir-identificacion.html',
  styleUrl: './corregir-identificacion.scss',
})
export class CorregirIdentificacion {
  private readonly api = inject(CaracterizacionApi);

  readonly persona = input.required<'PCD' | 'CUIDADOR'>();
  readonly actual = input.required<IdentificacionPersona>();
  readonly tipos = input.required<ItemLista[]>();
  /** Antes de enviar la solicitud; después ya no se puede corregir. */
  readonly editable = input(true);
  /** Se corrigió el documento: el servidor devuelve lo vigente para refrescar la pantalla. */
  readonly corregido = output<RespuestaCorreccionDocumento>();

  protected readonly abierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly exito = signal('');

  protected readonly form = new FormGroup({
    tipoId: new FormControl<number | null>(null, [Validators.required]),
    numero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(25)],
    }),
  });
  private readonly tipoElegido = valorDe(this.form.controls.tipoId);
  private readonly codigoElegido = computed(
    () => this.tipos().find((t) => t.id === this.tipoElegido())?.codigo,
  );
  protected readonly modo = computed(() =>
    soloDigitos(this.codigoElegido()) ? 'numeric' : 'text',
  );

  protected readonly quien = computed(() =>
    this.persona() === 'PCD' ? 'de la persona con discapacidad' : 'del cuidador',
  );

  constructor() {
    this.form.controls.numero.addValidators(numeroSegunTipo(() => this.codigoElegido()));
    this.form.controls.tipoId.valueChanges.subscribe(() =>
      this.form.controls.numero.updateValueAndValidity(),
    );
  }

  protected abrir(): void {
    const a = this.actual();
    this.form.reset({
      tipoId: this.tipos().find((t) => t.codigo === a.tipoIdentificacion.codigo)?.id ?? null,
      numero: a.numero,
    });
    this.error.set('');
    this.exito.set('');
    this.abierto.set(true);
  }

  protected cancelar(): void {
    this.abierto.set(false);
    this.error.set('');
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) return;
    const { tipoId, numero } = this.form.getRawValue();
    const nuevoNumero = normalizarNumero(numero);
    if (
      this.codigoElegido() === this.actual().tipoIdentificacion.codigo &&
      nuevoNumero === this.actual().numero
    ) {
      this.abierto.set(false);
      return;
    }
    this.guardando.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(
        this.api.corregirIdentificacion({
          persona: this.persona(),
          tipoIdentificacionId: tipoId as number,
          numero: nuevoNumero,
        }),
      );
      this.abierto.set(false);
      this.exito.set(
        r.regimen && r.regimen.estado !== 'SUBSIDIADO'
          ? 'Guardamos el documento. Con este documento la consulta no confirma el régimen subsidiado: revise que esté bien escrito.'
          : 'Guardamos el documento corregido.',
      );
      this.corregido.emit(r);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.estado === 422) {
          const otros = aplicarErroresApi(
            {
              get: (n) =>
                n === 'tipoIdentificacionId' ? this.form.controls.tipoId : this.form.get(n),
            },
            e.errores,
          );
          this.error.set(otros.join(' · '));
        } else {
          this.error.set(e.message);
        }
      } else {
        this.error.set('No pudimos guardar el documento. Intente de nuevo.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
