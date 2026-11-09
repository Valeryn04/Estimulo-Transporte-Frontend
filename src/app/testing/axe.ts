import axe from 'axe-core';

/**
 * Revisión automática de accesibilidad (WCAG 2.1 A y AA) de una pantalla: lo que los lectores de pantalla (VoiceOver,
 * TalkBack, NVDA…) necesitan de la página (nombres, etiquetas, roles y estructura). El contraste de colores no se puede
 * medir en este entorno: se revisa aparte. Devuelve la lista de problemas (vacía si no hay).
 */
export async function revisarAccesibilidad(el: HTMLElement): Promise<string[]> {
  document.body.appendChild(el);
  try {
    const r = await axe.run(el, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: {
        'color-contrast': { enabled: false },
        // Una pantalla suelta no trae sus «landmarks» de página: los pone el marco (header/main).
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
      },
    });
    return r.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    );
  } finally {
    el.remove();
  }
}
