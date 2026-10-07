import { DatePipe } from '@angular/common';
import {
  Component,
  OnInit,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { Campo } from '../../../../../shared/campo';
import { CampoControl } from '../../../../../shared/campo-control';
import { ConfigApi } from '../../config/config-api';
import { Plantilla, VersionPlantilla, VistaPrevia } from '../../config/modelos-config';

/**
 * Editor de una plantilla de correo (RF-COM-02): asunto y texto con variables, vista previa con datos de
 * ejemplo antes de guardar, y versiones anteriores consultables.
 */
@Component({
  selector: 'app-plantilla-editor-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Campo, CampoControl],
  templateUrl: './plantilla-editor-page.html',
  styleUrl: './plantilla-editor-page.scss',
})
export class PlantillaEditorPage implements OnInit {
  private readonly api = inject(ConfigApi);

  /** Parámetro de ruta. */
  readonly codigo = input.required<string>();

  protected readonly plantilla = signal<Plantilla | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly vista = signal<VistaPrevia | null>(null);
  protected readonly guardando = signal(false);
  /** Hay problemas en el texto según la última vista previa: no se puede guardar así. */
  protected readonly conProblemas = computed(() => (this.vista()?.problemas.length ?? 0) > 0);
  protected readonly cuerpoEl = viewChild<ElementRef<HTMLTextAreaElement>>('cuerpoEl');

  protected readonly form = new FormGroup({
    asunto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(200)],
    }),
    cuerpo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(20), Validators.maxLength(10000)],
    }),
    justificacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  ngOnInit(): void {
    void this.cargar();
    // La vista previa se actualiza sola poco después de que la persona deja de escribir.
    this.form.valueChanges.pipe(debounceTime(700)).subscribe(() => {
      if (this.form.dirty) void this.previsualizar(false);
    });
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const p = await firstValueFrom(this.api.plantilla(this.codigo()));
      this.plantilla.set(p);
      this.form.reset({ asunto: p.vigente.asunto, cuerpo: p.vigente.cuerpo, justificacion: '' });
      this.vista.set(null);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos cargar la plantilla.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Inserta la variable donde está el cursor del texto. */
  protected insertar(nombre: string): void {
    const el = this.cuerpoEl()?.nativeElement;
    const texto = `{{${nombre}}}`;
    const actual = this.form.controls.cuerpo.value;
    if (!el) {
      this.form.controls.cuerpo.setValue(actual + texto);
      return;
    }
    const inicio = el.selectionStart ?? actual.length;
    const fin = el.selectionEnd ?? actual.length;
    this.form.controls.cuerpo.setValue(actual.slice(0, inicio) + texto + actual.slice(fin));
    this.form.controls.cuerpo.markAsDirty();
    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(inicio + texto.length, inicio + texto.length);
    });
  }

  protected cargarVersion(v: VersionPlantilla): void {
    this.form.patchValue({ asunto: v.asunto, cuerpo: v.cuerpo });
    this.form.markAsDirty();
    this.mensaje.set(
      `Se cargó el texto de la versión ${v.version} en el editor. Revise y guarde para publicarlo como versión nueva.`,
    );
  }

  protected async previsualizar(marcar = true): Promise<void> {
    if (marcar) {
      this.form.controls.asunto.markAsTouched();
      this.form.controls.cuerpo.markAsTouched();
    }
    if (this.form.controls.asunto.invalid || this.form.controls.cuerpo.invalid) return;
    this.error.set('');
    try {
      this.vista.set(
        await firstValueFrom(
          this.api.vistaPrevia(this.codigo(), {
            asunto: this.form.controls.asunto.value,
            cuerpo: this.form.controls.cuerpo.value,
          }),
        ),
      );
    } catch (e) {
      if (!marcar) return;
      this.error.set(e instanceof ApiError ? e.message : 'No pudimos generar la vista previa.');
    }
  }

  protected async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.conProblemas()) return;
    this.guardando.set(true);
    this.error.set('');
    this.mensaje.set('');
    const v = this.form.getRawValue();
    try {
      const r = await firstValueFrom(
        this.api.guardarPlantilla(this.codigo(), {
          asunto: v.asunto,
          cuerpo: v.cuerpo,
          justificacion: v.justificacion.trim() || null,
        }),
      );
      await this.cargar();
      this.mensaje.set(
        `Se guardó la versión ${r.version}. Los próximos correos saldrán con este texto.`,
      );
    } catch (e) {
      if (e instanceof ApiError && e.errores.length > 0) {
        this.error.set(e.errores.map((x) => x.mensaje).join(' · '));
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'No pudimos guardar la plantilla.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
