import '../app.css';
import { actualizarMusica } from '../audio';
import { NUM_INCLUIDOS, nivelIncluido } from '../core/builtin';
import { codificar, decodificar, extraerCodigo } from '../core/codec';
import { URL_COMPARTIR } from '../config';
import { Nivel, clonar, nivelVacio } from '../core/level';
import { PUEDE_REVOCAR, PUEDE_SALIR, alAbrirUrl, alAtras, anuncio, revocarConsentimiento, salir } from '../platform';
import { Invitado, Receptor, extraerEnvio, extraerSala } from '../red';
import { miniatura } from '../render';
import {
  LARGO_ETIQUETA, MAX_ETIQUETAS, ajustes, borrarDescargado, borrarPropio, descargados, guardarAjustes, guardarDescargado, guardarMeta, guardarPropio,
  limpiarEtiqueta, meta, metas, nuevoId, propios, todasEtiquetas,
} from '../store';
import { aviso, botonIcono, confirmar, h, icono, modal, registrarIconos } from './dom';
import { montarEditor } from './editor';
import { fondoCayendo } from './fondo';
import { compartirNivel, montarJuego } from './juego';
import { conectarSala, montarLobby } from './lobby';

registrarIconos({
  compartir: '<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.2 10.8l6.6-3.6M8.2 13.2l6.6 3.6"/>',
  estrella: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z"/>',
  deshacer: '<path d="M8 5L4 9l4 4"/><path d="M4 9h10a5 5 0 0 1 0 10h-3"/>',
  rehacer: '<path d="M16 5l4 4-4 4"/><path d="M20 9H10a5 5 0 0 0 0 10h3"/>',
  codigo: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  borrar: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  duplicar: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>',
  editar: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  candado: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  seleccionar: '<path d="M6 3l12 9-5.5 1L10 19z"/>',
  etiqueta: '<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8" cy="8" r="1.5"/>',
  sala: '<circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
  desplazar: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
});

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
  return h('h1', { class: 'logo-partidica', 'aria-label': '¿Una partidica?' },
    h('span', { class: 'chico' }, 'una'), 'partidica', h('span', { class: 'chico' }, '?'),
  );
}

export function menu() {
  const fondo = fondoCayendo();
  const el = h('div', { class: 'pantalla menu' },
    fondo.el,
    logo(),
    h('nav', { class: 'menu-botones' },
      h('button', { class: 'btn-menu', onclick: pantallaNiveles }, 'Niveles'),
      h('button', { class: 'btn-menu', onclick: creador }, 'Creador de niveles'),
      h('button', { class: 'btn-menu', onclick: abrirAjustes }, 'Ajustes'),
      PUEDE_SALIR && h('button', { class: 'btn-menu', onclick: salir }, 'Salir'),
    ),
    h('p', { class: 'creditos' }, 'Un juego de Hector Galbis Sanchis.'),
  );
  mostrar(el, null, true, fondo.parar);
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
    PUEDE_REVOCAR && h('button', { class: 'btn', onclick: revocarConsentimiento }, 'Privacidad y cookies'),
    h('a', { class: 'nota', href: `${URL_COMPARTIR.replace(/\/+$/, '')}/privacidad.html`, target: '_blank', rel: 'noopener' }, 'Política de privacidad'),
  );
}

type Origen = 'propio' | 'descargado' | 'incluido';
type EstadoFiltro = 'incluir' | 'excluir';
type Orden = 'recientes' | 'nombre' | 'autor';

interface EntradaNivel {
  clave: string;
  origen: Origen;
  nivel: Nivel;
  codigo: string;
  fecha: number;
  borrar?: () => void;
}

const ORIGENES: Record<Origen, string> = { propio: 'Propio', descargado: 'Descargado', incluido: 'Incluido' };
const ORDENES: [Orden, string][] = [['recientes', 'Más recientes'], ['nombre', 'Nombre (A-Z)'], ['autor', 'Autor (A-Z)']];
const vista = { busqueda: '', orden: 'recientes' as Orden, filtros: new Map<string, EstadoFiltro>() };

function entradasNiveles(): EntradaNivel[] {
  const lista: EntradaNivel[] = [];
  for (const p of propios()) {
    lista.push({ clave: 'p:' + p.id, origen: 'propio', nivel: p.nivel, codigo: codificar(p.nivel), fecha: p.modificado, borrar: () => borrarPropio(p.id) });
  }
  for (const d of descargados()) {
    try {
      lista.push({ clave: 'd:' + d.id, origen: 'descargado', nivel: decodificar(d.codigo), codigo: d.codigo, fecha: d.anadido, borrar: () => borrarDescargado(d.id) });
    } catch {
      continue;
    }
  }
  for (let i = 0; i < NUM_INCLUIDOS; i++) {
    const nivel = nivelIncluido(i);
    lista.push({ clave: 'i:' + i, origen: 'incluido', nivel, codigo: codificar(nivel), fecha: 0 });
  }
  return lista;
}

function cumple(e: EntradaNivel, filtro: string): boolean {
  if (filtro === 'fav') return !!meta(e.clave).favorito;
  if (filtro.startsWith('origen:')) return e.origen === filtro.slice(7);
  if (filtro.startsWith('tag:')) return (meta(e.clave).etiquetas ?? []).some((t) => t.toLowerCase() === filtro.slice(4));
  return true;
}

function pantallaNiveles() {
  const entradas = entradasNiveles();
  const lista = h('div', { class: 'rejilla-tarjetas' });
  const filtros = h('div', { class: 'filtros-lista' });
  const buscar = h('input', { type: 'search', placeholder: 'Buscar por nombre', value: vista.busqueda, autocomplete: 'off', spellcheck: false });
  buscar.addEventListener('input', () => {
    vista.busqueda = buscar.value;
    pintarLista();
  });
  const orden = h('select', {}, ...ORDENES.map(([v, t]) => h('option', { value: v, selected: v === vista.orden }, t)));
  orden.addEventListener('change', () => {
    vista.orden = orden.value as Orden;
    pintarLista();
  });

  const pintarFiltros = () => {
    const opciones: [string, string][] = [['fav', 'Favoritos'], ['origen:propio', 'Propios'], ['origen:descargado', 'Descargados']];
    if (NUM_INCLUIDOS) opciones.push(['origen:incluido', 'Incluidos']);
    const etiquetas = todasEtiquetas();
    const boton = ([clave, texto]: [string, string]) => {
      const estado = vista.filtros.get(clave);
      const titulo = !estado ? 'Pulsa para incluir' : estado === 'incluir' ? 'Pulsa para excluir' : 'Pulsa para quitar el filtro';
      return h('button', {
        class: `filtro ${estado ?? ''}`,
        title: titulo,
        'aria-label': `${texto}: ${estado ?? 'sin filtro'}. ${titulo}`,
        onclick: () => {
          if (!estado) vista.filtros.set(clave, 'incluir');
          else if (estado === 'incluir') vista.filtros.set(clave, 'excluir');
          else vista.filtros.delete(clave);
          pintarFiltros();
          pintarLista();
        },
      }, h('span', { class: 'marca' }, estado === 'incluir' ? '+' : estado === 'excluir' ? '−' : ''), texto);
    };
    filtros.replaceChildren(
      h('h3', {}, 'Mostrar'),
      ...opciones.map(boton),
      h('h3', {}, 'Etiquetas'),
      ...(etiquetas.length ? etiquetas.map((t) => boton(['tag:' + t.toLowerCase(), t])) : [h('p', { class: 'nota' }, 'Aún no has puesto etiquetas.')]),
      vista.filtros.size > 0 ? h('button', { class: 'btn compacto', onclick: () => { vista.filtros.clear(); pintarFiltros(); pintarLista(); } }, 'Quitar filtros') : '',
    );
  };

  const pintarLista = () => {
    const texto = vista.busqueda.trim().toLowerCase();
    const visibles = entradas.filter((e) => {
      if (texto && !(e.nivel.nombre || 'Sin nombre').toLowerCase().includes(texto)) return false;
      for (const [f, estado] of vista.filtros) if (cumple(e, f) !== (estado === 'incluir')) return false;
      return true;
    });
    const nombre = (e: EntradaNivel) => e.nivel.nombre || 'Sin nombre';
    visibles.sort((a, b) =>
      vista.orden === 'nombre' ? nombre(a).localeCompare(nombre(b), 'es')
        : vista.orden === 'autor' ? (a.nivel.autor || '').localeCompare(b.nivel.autor || '', 'es') || nombre(a).localeCompare(nombre(b), 'es')
          : b.fecha - a.fecha,
    );
    lista.replaceChildren(...visibles.map((e) => tarjetaNivel(e, () => { pintarFiltros(); pintarLista(); }, pantallaNiveles)));
    if (!visibles.length) lista.replaceChildren(vacio(entradas.length ? 'Ningún nivel coincide con la búsqueda o los filtros.' : 'Aún no hay niveles. Crea uno en el Creador de niveles o abre el enlace de un nivel.'));
  };

  const anadir = h('button', {
    class: 'btn primario',
    onclick: () => pedirEnlace('Añadir desde enlace', 'Añadir', (c) => {
      guardarDescargado(c, decodificar(c));
      aviso('Nivel añadido');
      pantallaNiveles();
    }, (s) => unirseSala(s, pantallaNiveles)),
  }, icono('enlace'), 'Añadir desde enlace');

  mostrar(
    h('div', { class: 'pantalla' },
      cabecera('Niveles', menu, anadir),
      h('div', { class: 'cuerpo niveles-cuerpo' },
        h('aside', { class: 'filtros' },
          h('label', { class: 'campo' }, 'Buscar', buscar),
          h('label', { class: 'campo' }, 'Ordenar por', orden),
          filtros,
        ),
        lista,
      ),
    ),
    menu, true,
  );
  pintarFiltros();
  pintarLista();
}

function tarjetaNivel(e: EntradaNivel, alCambiar: () => void, volver: () => void): HTMLElement {
  const m = meta(e.clave);
  const nombre = e.nivel.nombre || 'Sin nombre';
  const jugar = () => jugarSolo(e.nivel, e.codigo, volver);
  return h('article', { class: 'tarjeta' },
    h('button', { class: 'tarjeta-mini', onclick: jugar, 'aria-label': `Jugar ${nombre}` }, miniatura(e.nivel)),
    h('div', { class: 'tarjeta-pie doble' },
      h('div', { class: 'titulo' },
        h('strong', {}, nombre),
        h('span', {}, `${e.nivel.autor ? `por ${e.nivel.autor}` : 'Anónimo'} · ${ORIGENES[e.origen]}`),
      ),
      m.etiquetas?.length ? h('div', { class: 'etiquetas' }, ...m.etiquetas.map((t) => h('span', { class: 'etiqueta' }, t))) : null,
      h('div', { class: 'acciones' },
        botonIcono('jugar', 'Jugar', jugar),
        botonIcono('sala', 'Crear sala multijugador', () => jugarCompartido(e.codigo, volver)),
        botonIcono('estrella', m.favorito ? 'Quitar de favoritos' : 'Marcar como favorito', () => {
          guardarMeta(e.clave, { favorito: !m.favorito });
          alCambiar();
        }, m.favorito ? 'lleno' : ''),
        botonIcono('etiqueta', 'Etiquetas', () => editarEtiquetas(e.clave, nombre, alCambiar)),
        botonIcono('editar', 'Editar una copia', () => editarCopia(e.nivel)),
        botonIcono('compartir', 'Compartir', () => compartirNivel(e.codigo, e.nivel.nombre)),
        e.borrar && botonIcono('borrar', 'Borrar', () => confirmar(
          e.origen === 'propio' ? `¿Borrar «${nombre}»? También desaparecerá del Creador de niveles. No se puede deshacer.` : `¿Borrar «${nombre}»? No se puede deshacer.`,
          'Borrar',
          () => {
            e.borrar!();
            volver();
          },
        )),
      ),
    ),
  );
}

function jugarSolo(nivel: Nivel, codigo: string, volver: () => void) {
  const el = h('div', { class: 'pantalla' });
  const limpiar = montarJuego(el, {
    nivel,
    codigo,
    alSalir: volver,
    accionesFin: () => [h('button', { class: 'btn primario', onclick: volver }, 'Continuar')],
  });
  mostrar(el, volver, false, limpiar);
}

function editarCopia(nivel: Nivel) {
  const nombre = nivel.nombre || 'Sin nombre';
  const m = modal('Editar nivel',
    h('p', {}, `Se creará una copia de «${nombre}» en el Creador de niveles para que puedas modificarla. El nivel original no cambia.`),
    h('div', { class: 'fila fin' },
      h('button', { class: 'btn', onclick: () => m.cerrar() }, 'Cancelar'),
      h('button', {
        class: 'btn primario',
        onclick: () => {
          m.cerrar();
          const copia = clonar(nivel);
          copia.nombre = `${nombre} (copia)`.slice(0, 40);
          const id = nuevoId();
          guardarPropio(id, copia);
          abrirEditor(id);
        },
      }, 'Crear copia'),
    ),
  );
}

function editarEtiquetas(clave: string, nombre: string, alCambiar: () => void) {
  let etiquetas = [...(meta(clave).etiquetas ?? [])];
  const existentes = todasEtiquetas();
  const chips = h('div', { class: 'etiquetas' });
  const sugerencias = h('datalist', { id: 'etiquetas-existentes' }, ...existentes.map((t) => h('option', { value: t })));
  const campo = h('input', { type: 'text', maxLength: LARGO_ETIQUETA, placeholder: 'Nueva etiqueta', list: 'etiquetas-existentes', autocomplete: 'off' });
  const guardar = () => {
    guardarMeta(clave, { etiquetas });
    pintar();
    alCambiar();
  };
  const pintar = () =>
    chips.replaceChildren(
      ...etiquetas.map((t) =>
        h('span', { class: 'etiqueta' }, t,
          h('button', { class: 'quitar', title: `Quitar ${t}`, 'aria-label': `Quitar ${t}`, onclick: () => { etiquetas = etiquetas.filter((x) => x !== t); guardar(); } }, '×'),
        ),
      ),
      etiquetas.length ? '' : h('span', { class: 'nota' }, 'Sin etiquetas'),
    );
  const anadir = () => {
    const t = limpiarEtiqueta(campo.value);
    campo.value = '';
    campo.focus();
    if (!t || etiquetas.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (etiquetas.length >= MAX_ETIQUETAS) return aviso(`Como máximo ${MAX_ETIQUETAS} etiquetas por nivel`);
    etiquetas.push(existentes.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t);
    guardar();
  };
  campo.addEventListener('keydown', (e) => e.key === 'Enter' && anadir());
  modal(`Etiquetas de «${nombre}»`,
    chips,
    h('div', { class: 'fila' }, campo, h('button', { class: 'btn', onclick: anadir }, icono('mas'), 'Añadir')),
    sugerencias,
  );
  pintar();
  campo.focus();
}

export function jugarCompartido(codigo: string, volver: () => void = menu, sala?: string, invitado?: Invitado) {
  let nivel;
  try {
    nivel = decodificar(codigo);
  } catch (e) {
    aviso((e as Error).message);
    return;
  }
  guardarDescargado(codigo, nivel);
  const el = h('div', { class: 'pantalla' });
  const limpiar = montarLobby(el, {
    nivel,
    codigo,
    sala,
    invitado,
    alSalir: volver,
    accionesFin: () => [h('button', { class: 'btn primario', onclick: volver }, 'Continuar')],
  });
  mostrar(el, volver, false, limpiar);
}

function recibir(sala: string, alRecibir: (codigo: string) => void) {
  const receptor = new Receptor(sala);
  const m = modal('Recibiendo nivel',
    h('p', { class: 'nota' }, 'Conectando con quien lo compartió…'),
    h('div', { class: 'fila fin' }, h('button', { class: 'btn', onclick: () => m.cerrar() }, 'Cancelar')),
  );
  const vigia = new MutationObserver(() => {
    if (m.caja.isConnected) return;
    vigia.disconnect();
    receptor.cancelar();
  });
  vigia.observe(document.body, { childList: true });
  receptor.nivel.then(
    (c) => {
      vigia.disconnect();
      m.cerrar();
      alRecibir(c);
    },
    (e: Error) => {
      vigia.disconnect();
      m.cerrar();
      aviso(e.message);
    },
  );
}

function unirseSala(sala: string, volver: () => void) {
  const invitado = conectarSala(sala);
  const m = modal('Uniéndose a la sala',
    h('p', { class: 'nota' }, 'Conectando con la sala…'),
    h('div', { class: 'fila fin' }, h('button', { class: 'btn', onclick: () => m.cerrar() }, 'Cancelar')),
  );
  const vigia = new MutationObserver(() => {
    if (m.caja.isConnected) return;
    vigia.disconnect();
    invitado.cerrar();
  });
  vigia.observe(document.body, { childList: true });
  invitado.alNivel = (c) => {
    invitado.alNivel = () => undefined;
    vigia.disconnect();
    m.cerrar();
    jugarCompartido(c, volver, undefined, invitado);
  };
  invitado.alCaer = (motivo) => {
    vigia.disconnect();
    m.cerrar();
    aviso(motivo);
  };
}

function pedirEnlace(titulo: string, accion: string, alAceptar: (codigo: string, sala?: string) => void, alSala?: (sala: string) => void) {
  const campo = h('input', { type: 'text', placeholder: 'https://…/?l=…', autocomplete: 'off', spellcheck: false });
  const error = h('p', { class: 'error' });
  const aceptar = () => {
    const codigo = extraerCodigo(campo.value);
    const envio = codigo ? null : extraerEnvio(campo.value);
    if (envio) {
      m.cerrar();
      return recibir(envio, (c) => alAceptar(c));
    }
    const sala = codigo ? null : extraerSala(campo.value);
    if (sala) {
      if (!alSala) {
        error.textContent = 'Ese enlace es de una sala multijugador: ábrelo desde Niveles para jugar';
        return;
      }
      m.cerrar();
      return alSala(sala);
    }
    try {
      if (!codigo) throw new Error('Eso no parece un enlace de RecordingMan');
      decodificar(codigo);
      m.cerrar();
      alAceptar(codigo, extraerSala(campo.value) ?? undefined);
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
  mostrar(
    h('div', { class: 'pantalla' },
      cabecera('Creador de niveles', menu,
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
    if (codigo) jugarCompartido(codigo, menu, extraerSala(url) ?? undefined);
    else {
      const envio = extraerEnvio(url);
      const sala = extraerSala(url);
      if (envio) recibir(envio, (c) => jugarCompartido(c, menu));
      else if (sala) unirseSala(sala, menu);
    }
  });
}
