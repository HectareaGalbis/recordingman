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
  pantalla: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  engranaje: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  jugar: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
};

export function registrarIconos(extra: Record<string, string>) {
  Object.assign(ICONOS, extra);
}

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
