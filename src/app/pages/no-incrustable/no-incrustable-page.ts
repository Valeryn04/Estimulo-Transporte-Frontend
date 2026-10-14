import { Component } from '@angular/core';

/** Aviso para quien abre el portal dentro de otra página (iframe): se abre en su propia pestaña. */
@Component({
  selector: 'app-no-incrustable-page',
  template: `
    <main class="aviso-pagina">
      <h1>Abra el portal en su propia pestaña</h1>
      <p>
        Por su seguridad, el portal del Estímulo Social de Transporte no se puede usar dentro de
        otra página. Ábralo directamente en el navegador.
      </p>
      <p>
        <a class="boton" href="/" target="_blank" rel="noopener">Abrir el portal</a>
      </p>
    </main>
  `,
  styles: `
    .aviso-pagina {
      max-width: 36rem;
      margin: 3rem auto;
      padding: 0 1rem;
    }
  `,
})
export class NoIncrustablePage {}
