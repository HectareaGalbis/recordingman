import { actualizarMusica } from '../audio';
import { NUM_INCLUIDOS, nivelIncluido, nombreIncluido } from '../core/builtin';
import { codificar, decodificar, extraerCodigo } from '../core/codec';
import { clonar, nivelVacio } from '../core/level';
import { PUEDE_SALIR, alAbrirUrl, alAtras, anuncio, salir } from '../platform';
import { miniatura } from '../render';
import {
  ajustes, alternarFavorito, borrarPropio, favoritos, guardarAjustes, guardarPropio, marcarSuperado, nuevoId, progreso, propios,
} from '../store';
import { aviso, botonIcono, confirmar, h, icono, modal } from './dom';
import { montarEditor } from './editor';
import { compartirNivel, montarJuego } from './juego';

const raiz = document.getElementById('app')!;
let desmontar: (() => void) | null = null;
let atras: (() => void) | null = null;

function mostrar(el: HTMLElement | null, volver: (() => void) | null, conAnuncio: boolean, limpiar?: () => void) {
  desmontar?.();
  raiz.replaceChildren();
  if (el) raiz.appendChild(el);
  desmontar = limpiar ?? null;
  atras = volver;
  void anuncio(conAnuncio);
}

function cabecera(titulo: string, volver: () => void, ...extra: HTMLElement[]): HTMLElement {
  return h('header', { class: 'barra' },
    botonIcono('atras', 'Volver (Esc)', volver),
    h('div', { class: 'titulo' }, h('strong', {}, titulo)),
    h('div', { class: 'acciones' }, ...extra),
  );
}

function logo(): HTMLElement {
  return h('h1', { class: 'logo', 'aria-label': 'RecordingMan' },
    h('span', { class: 'r' }, 'R'), 'ec', h('span', { class: 'o' }), 'rding', h('span', { class: 'punto' }),
    h('span', { class: 'r' }, 'M'), 'an',
  );
}

export function menu() {
  const el = h('div', { class: 'pantalla menu' },
    logo(),
    h('nav', { class: 'menu-botones' },
      h('button', { class: 'btn-menu', onclick: niveles }, 'Jugar'),
      h('button', { class: 'btn-menu', onclick: creador }, 'Creador de niveles'),
      h('button', { class: 'btn-menu', onclick: pantallaFavoritos }, 'Favoritos'),
      h('button', { class: 'btn-menu', onclick: abrirAjustes }, 'Ajustes'),
      PUEDE_SALIR && h('button', { class: 'btn-menu', onclick: salir }, 'Salir'),
    ),
    h('p', { class: 'creditos' }, 'Un juego de Hector Galbis Sanchis.'),
  );
  mostrar(el, null, true);
}

function abrirAjustes() {
  const casilla = (texto: string, clave: 'musica' | 'efectos') =>
    h('label', { class: 'casilla' },
      h('input', {
        type: 'checkbox',
        checked: ajustes[clave],
        onchange: (e: Event) => {
          ajustes[clave] = (e.target as HTMLInputElement).checked;
          guardarAjustes();
          actualizarMusica();
        },
      }),
      texto,
    );
  modal('Ajustes',
    casilla('Música', 'musica'),
    casilla('Efectos de sonido', 'efectos'),
    h('label', { class: 'campo' }, 'Tu nombre de autor',
      h('input', {
        type: 'text',
        maxLength: 30,
        value: ajustes.autor,
        placeholder: 'Anónimo',
        oninput: (e: Event) => {
          ajustes.autor = (e.target as HTMLInputElement).value.trim();
          guardarAjustes();
        },
      }),
    ),
  );
}

function niveles() {
  const hechos = progreso();
  const rejilla = h('div', { class: 'rejilla-niveles' });
  let bloqueado = false;
  for (let i = 0; i < NUM_INCLUIDOS; i++) {
    const nombre = nombreIncluido(i);
    if (bloqueado) {
      rejilla.append(h('div', { class: 'tarjeta-nivel bloqueado', title: 'Supera el nivel anterior' }, h('span', { class: 'num' }, String(i)), icono('candado')));
    } else {
      rejilla.append(
        h('button', { class: `tarjeta-nivel ${hechos[i] ? 'hecho' : ''}`, onclick: () => jugarIncluido(i) },
          h('span', { class: 'num' }, String(i)),
          h('span', { class: 'nom' }, nombre),
          hechos[i] && h('span', { class: 'marca', title: 'Superado' }),
        ),
      );
    }
    if (!hechos[i]) bloqueado = true;
  }
  mostrar(h('div', { class: 'pantalla' }, cabecera('Niveles', menu), h('div', { class: 'cuerpo' }, rejilla)), menu, true);
}

function jugarIncluido(i: number) {
  const el = h('div', { class: 'pantalla' });
  const hay = i + 1 < NUM_INCLUIDOS;
  const limpiar = montarJuego(el, {
    nivel: nivelIncluido(i),
    etiqueta: `Nivel ${i}`,
    alSalir: niveles,
    alCompletar: () => marcarSuperado(i),
    accionesFin: () => [
      h('button', { class: 'btn', onclick: niveles }, 'Niveles'),
      hay ? h('button', { class: 'btn primario', onclick: () => jugarIncluido(i + 1) }, 'Siguiente') : h('button', { class: 'btn primario', onclick: creador }, 'Crea el tuyo'),
    ],
  });
  mostrar(el, niveles, false, limpiar);
}

export function jugarCompartido(codigo: string, volver: () => void = menu) {
  let nivel;
  try {
    nivel = decodificar(codigo);
  } catch (e) {
    aviso((e as Error).message);
    return;
  }
  const el = h('div', { class: 'pantalla' });
  const limpiar = montarJuego(el, {
    nivel,
    codigo,
    alSalir: volver,
    accionesFin: () => [h('button', { class: 'btn primario', onclick: volver }, 'Continuar')],
  });
  mostrar(el, volver, false, limpiar);
}

function pedirEnlace(titulo: string, accion: string, alAceptar: (codigo: string) => void) {
  const campo = h('input', { type: 'text', placeholder: 'https://…/?l=…', autocomplete: 'off', spellcheck: false });
  const error = h('p', { class: 'error' });
  const aceptar = () => {
    const codigo = extraerCodigo(campo.value);
    try {
      if (!codigo) throw new Error('Eso no parece un enlace de RecordingMan');
      decodificar(codigo);
      m.cerrar();
      alAceptar(codigo);
    } catch (e) {
      error.textContent = (e as Error).message;
    }
  };
  campo.addEventListener('keydown', (e) => e.key === 'Enter' && aceptar());
  const m = modal(titulo,
    h('label', { class: 'campo' }, 'Pega aquí el enlace del nivel', campo),
    error,
    h('div', { class: 'fila fin' },
      navigator.clipboard?.readText && h('button', { class: 'btn', onclick: () => void navigator.clipboard.readText().then((t) => (campo.value = t)).catch(() => undefined) }, 'Pegar'),
      h('button', { class: 'btn primario', onclick: aceptar }, accion),
    ),
  );
  campo.focus();
}

function tarjeta(nivel: { nombre: string; autor: string }, mini: HTMLElement, alPulsar: () => void, ...acciones: HTMLElement[]): HTMLElement {
  return h('article', { class: 'tarjeta' },
    h('button', { class: 'tarjeta-mini', onclick: alPulsar, 'aria-label': `Jugar ${nivel.nombre}` }, mini),
    h('div', { class: 'tarjeta-pie' },
      h('div', { class: 'titulo' }, h('strong', {}, nivel.nombre || 'Sin nombre'), h('span', {}, nivel.autor ? `por ${nivel.autor}` : 'Anónimo')),
      h('div', { class: 'acciones' }, ...acciones),
    ),
  );
}

function vacio(texto: string): HTMLElement {
  return h('p', { class: 'vacio' }, texto);
}

function pantallaFavoritos() {
  const lista = h('div', { class: 'rejilla-tarjetas' });
  const items = favoritos();
  for (const f of items) {
    let nivel;
    try {
      nivel = decodificar(f.codigo);
    } catch {
      continue;
    }
    const jugar = () => jugarCompartido(f.codigo, pantallaFavoritos);
    lista.append(
      tarjeta(nivel, miniatura(nivel), jugar,
        botonIcono('jugar', 'Jugar', jugar),
        botonIcono('compartir', 'Compartir', () => void compartirNivel(f.codigo, nivel.nombre)),
        botonIcono('borrar', 'Quitar de favoritos', () => confirmar(`¿Quitar «${nivel.nombre || 'Sin nombre'}» de favoritos?`, 'Quitar', () => { alternarFavorito(f); pantallaFavoritos(); })),
      ),
    );
  }
  const anadir = h('button', { class: 'btn primario', onclick: () => pedirEnlace('Añadir desde enlace', 'Jugar', (c) => jugarCompartido(c, pantallaFavoritos)) }, icono('enlace'), 'Abrir enlace');
  mostrar(
    h('div', { class: 'pantalla' },
      cabecera('Favoritos', menu, anadir),
      h('div', { class: 'cuerpo' }, items.length ? lista : vacio('Aún no tienes favoritos. Abre el enlace de un nivel y pulsa la estrella para guardarlo aquí.')),
    ),
    menu, true,
  );
}

function creador() {
  const lista = h('div', { class: 'rejilla-tarjetas' });
  const items = propios();
  for (const p of items) {
    const editar = () => abrirEditor(p.id);
    lista.append(
      tarjeta(p.nivel, miniatura(p.nivel), editar,
        botonIcono('editar', 'Editar', editar),
        botonIcono('compartir', 'Compartir', () => void compartirNivel(codificar(p.nivel), p.nivel.nombre)),
        botonIcono('duplicar', 'Duplicar', () => {
          const copia = clonar(p.nivel);
          copia.nombre = `${copia.nombre || 'Sin nombre'} (copia)`.slice(0, 40);
          guardarPropio(nuevoId(), copia);
          creador();
        }),
        botonIcono('borrar', 'Borrar', () => confirmar(`¿Borrar «${p.nivel.nombre || 'Sin nombre'}»? No se puede deshacer.`, 'Borrar', () => { borrarPropio(p.id); creador(); })),
      ),
    );
  }
  const nuevo = () => {
    const id = nuevoId();
    const n = nivelVacio();
    n.autor = ajustes.autor;
    guardarPropio(id, n);
    abrirEditor(id);
  };
  const importar = () =>
    pedirEnlace('Importar nivel', 'Importar', (c) => {
      const id = nuevoId();
      guardarPropio(id, decodificar(c));
      abrirEditor(id);
    });
  mostrar(
    h('div', { class: 'pantalla' },
      cabecera('Creador de niveles', menu,
        h('button', { class: 'btn', onclick: importar }, icono('enlace'), 'Importar'),
        h('button', { class: 'btn primario', onclick: nuevo }, icono('mas'), 'Nuevo nivel'),
      ),
      h('div', { class: 'cuerpo' }, items.length ? lista : vacio('Todavía no has creado ningún nivel. Pulsa «Nuevo nivel» para empezar.')),
    ),
    menu, true,
  );
}

function abrirEditor(id: string) {
  const propio = propios().find((p) => p.id === id);
  if (!propio) return creador();
  const el = h('div', { class: 'pantalla' });
  const ed = montarEditor(el, propio.nivel, {
    alCambiar: (n) => guardarPropio(id, n),
    alSalir: creador,
  });
  mostrar(el, ed.atras, false, ed.destruir);
}

export function iniciarApp() {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('.modal')) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return t.blur();
    if (!raiz.querySelector('.juego, .editor')) atras?.();
  });
  alAtras(() => {
    const m = document.querySelector('.modal');
    if (m) return void m.remove();
    if (atras) atras();
    else salir();
  });
  menu();
  alAbrirUrl((url) => {
    const codigo = extraerCodigo(url);
    if (codigo) jugarCompartido(codigo);
  });
}
