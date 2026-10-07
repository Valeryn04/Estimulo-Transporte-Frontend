import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { Campo } from '../../../../shared/campo';
import { CampoControl } from '../../../../shared/campo-control';
import { Dialogo } from '../../../../shared/dialogo/dialogo';
import { Icono } from '../../../../shared/icono/icono';
import { aplicarErroresApi } from '../../../../shared/forms';
import { ConfigApi } from '../config/config-api';
import { Parametro, VersionParametro } from '../config/modelos-config';

type Modo = 'ninguno' | 'cambio' | 'historial';

/** Valida el valor en el navegador con las mismas reglas que aplica la API. */
export function validarValorParametro(p: Parametro, valor: string): string | null {
  const v = valor.trim();
  if (!v) return 'escriba el valor';
  if (p.tipo === 'ENTERO') {
    if (!/^-?\d+$/.test(v)) return 'escriba un número entero';
    const n = Number(v);
    if (p.minimo !== null && n < p.minimo) return `el mínimo permitido es ${p.minimo}`;
    if (p.maximo !== null && n > p.maximo) return `el máximo permitido es ${p.maximo}`;
  } else if (p.tipo === 'BOOLEANO') {
    if (v !== 'true' && v !== 'false') return 'use true o false';
  } else if (p.patron && !new RegExp(p.patron).test(v)) {
    return 'el formato no es válido (por ejemplo: pdf,jpg,png)';
  }
  return null;
}

/**
 * Parámetros del programa (RF-ADM-02, RNF-12): plazos, rondas, formatos y tamaños de archivo, seguridad de la
 * sesión, meta. Un cambio crea una versión con fecha de vigencia, aprobador y motivo, sin tocar el código.
 */
@Component({
  selector: 'app-parametros-page',
  imports: [DatePipe, ReactiveFormsModule, Campo, CampoControl, Dialogo, Icono],
  templateUrl: './parametros-page.html',
  styleUrl: './parametros-page.scss',
})
export class ParametrosPage implements OnInit {
  private readonly api = inject(ConfigApi);

  protected readonly parametros = signal<Parametro[]>([]);
  protected readonly grupos = computed(() => {
    const porGrupo = new Map<string, Parametro[]>();
    for (const p of this.parametros()) porGrupo.set(p.grupo, [...(porGrupo.get(p.grupo) ?? []), p]);
    return [...porGrupo.entries()].map(([nombre, items]) => ({ nombre, items }));
  });
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');

  protected readonly modo = signal<Modo>('ninguno');
  protected readonly objetivo = signal<Parametro | null>(null);
  protected readonly historial = signal<VersionParametro[]>([]);
  protected readonly errorDialogo = signal('');
  protected readonly guardando = signal(false);
  protected readonly form = new FormGroup({
    valor: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    vigenteDesde: new FormControl('', { nonNullable: true }),
    justificacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
  });

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.parametros.set(await firstValueFrom(this.api.parametros()));
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar los parámetros.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrirCambio(p: Parametro): void {
    this.objetivo.set(p);
    this.errorDialogo.set('');
    this.form.reset({ valor: p.vigente.valor, vigenteDesde: '', justificacion: '' });
    this.modo.set('cambio');
  }

  protected async abrirHistorial(p: Parametro): Promise<void> {
    this.objetivo.set(p);
    this.historial.set([]);
    this.errorDialogo.set('');
    this.modo.set('historial');
    try {
      this.historial.set(await firstValueFrom(this.api.historialParametro(p.clave)));
    } catch (e) {
      this.errorDialogo.set(e instanceof ApiError ? e.message : 'No pudimos cargar el historial.');
    }
  }

  protected cerrar(): void {
    this.modo.set('ninguno');
  }

  protected rango(p: Parametro): string {
    if (p.tipo === 'ENTERO') return `Entero entre ${p.minimo} y ${p.maximo}`;
    if (p.tipo === 'BOOLEANO') return 'true o false';
    return 'Texto';
  }

  protected async guardar(): Promise<void> {
    const p = this.objetivo();
    this.form.markAllAsTouched();
    if (!p || this.form.invalid) return;
    const v = this.form.getRawValue();
    const problema = validarValorParametro(p, v.valor);
    if (problema) {
      this.form.controls.valor.setErrors({ servidor: `Valor: ${problema}` });
      return;
    }
    this.guardando.set(true);
    this.errorDialogo.set('');
    try {
      await firstValueFrom(
        this.api.nuevaVersionParametro(p.clave, {
          valor: v.valor.trim(),
          vigenteDesde: v.vigenteDesde ? new Date(v.vigenteDesde).toISOString() : null,
          justificacion: v.justificacion.trim(),
        }),
      );
      this.cerrar();
      this.mensaje.set(
        v.vigenteDesde
          ? `Se programó el nuevo valor de «${p.clave}».`
          : `«${p.clave}» actualizado: la nueva versión rige desde ahora.`,
      );
      await this.cargar();
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        const campos = e.errores.map((x) => ({
          campo: x.campo === 'vigenteDesde' ? 'vigenteDesde' : x.campo,
          mensaje: x.mensaje,
        }));
        const sueltos = aplicarErroresApi(this.form, campos);
        if (sueltos.length) this.errorDialogo.set(sueltos.join(' '));
      } else {
        this.errorDialogo.set(e instanceof ApiError ? e.message : 'No pudimos guardar.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
