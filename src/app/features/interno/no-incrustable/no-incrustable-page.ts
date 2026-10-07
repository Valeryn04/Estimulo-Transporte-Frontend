import { Component } from '@angular/core';

/** Se muestra si alguien intenta abrir el portal interno dentro de otra página. */
@Component({
  selector: 'app-no-incrustable-page',
  template: `
    <main class="aviso-pagina">
      <h1>Este portal no se puede abrir dentro de otra página</h1>
      <p>
        El portal interno es solo para funcionarios y, por seguridad, debe abrirse directamente en
        el navegador.
      </p>
      <p>
        <a class="boton" href="/interno" target="_blank" rel="noopener"
          >Abrir en una pestaña nueva</a
        >
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
