type Hijo = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, any> = {},
  ...hijos: Hijo[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') (el as any)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of hijos) if (c) el.append(c);
  return el;
}

const ICONOS: Record<string, string> = {
  atras: '<path d="M15 5l-7 7 7 7"/>',
  reiniciar: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
  conexiones: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8 16l8-8" stroke-dasharray="2 3"/>',
  musica: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  sonido: '<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
  compartir: '<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.2 10.8l6.6-3.6M8.2 13.2l6.6 3.6"/>',
  estrella: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z"/>',
  pantalla: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  deshacer: '<path d="M8 5L4 9l4 4"/><path d="M4 9h10a5 5 0 0 1 0 10h-3"/>',
  rehacer: '<path d="M16 5l4 4-4 4"/><path d="M20 9H10a5 5 0 0 0 0 10h3"/>',
  jugar: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  codigo: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  borrar: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  duplicar: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>',
  editar: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  candado: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  seleccionar: '<path d="M6 3l12 9-5.5 1L10 19z"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
};

export function icono(nombre: string): SVGElement {
  const d = document.createElement('div');
  d.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre] ?? ''}</svg>`;
  return d.firstElementChild as SVGElement;
}

export function botonIcono(nombre: string, titulo: string, onclick: (e: MouseEvent) => void, clase = ''): HTMLButtonElement {
  return h('button', { class: `ico ${clase}`, title: titulo, 'aria-label': titulo, onclick }, icono(nombre));
}

let avisoActual: HTMLElement | null = null;

export function aviso(texto: string) {
  avisoActual?.remove();
  const el = h('div', { class: 'aviso', role: 'status' }, texto);
  document.body.appendChild(el);
  avisoActual = el;
  setTimeout(() => el.classList.add('fuera'), 2200);
  setTimeout(() => el.remove(), 2700);
}

export interface Modal {
  cerrar(): void;
  caja: HTMLElement;
}

export function modal(titulo: string, ...contenido: Hijo[]): Modal {
  const caja = h('div', { class: 'modal-caja', role: 'dialog', 'aria-label': titulo });
  const fondo = h('div', { class: 'modal sin-palanca' }, caja);
  const cerrar = () => {
    fondo.remove();
    window.removeEventListener('keydown', tecla, true);
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cerrar();
    }
  };
  caja.append(h('div', { class: 'modal-titulo' }, h('h2', {}, titulo), botonIcono('cerrar', 'Cerrar', cerrar)));
  for (const c of contenido) if (c) caja.append(c);
  fondo.addEventListener('pointerdown', (e) => {
    if (e.target === fondo) cerrar();
  });
  window.addEventListener('keydown', tecla, true);
  document.body.appendChild(fondo);
  return { cerrar, caja };
}

export function confirmar(texto: string, accion: string, alAceptar: () => void) {
  const m = modal(
    texto,
    h('div', { class: 'fila fin' },
      h('button', { class: 'btn', onclick: () => m.cerrar() }, 'Cancelar'),
      h('button', { class: 'btn rojo', onclick: () => { m.cerrar(); alAceptar(); } }, accion),
    ),
  );
}
