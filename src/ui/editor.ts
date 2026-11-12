import { codificar } from '../core/codec';
import {
  ALTO, ANCHO, LIMITES, NOMBRES_TIPO, Nivel, Objeto, TIPOS, Tipo, clonar, crear, esActivador, esReceptor, sanear, siguienteId,
} from '../core/level';
import { Sim } from '../core/sim';
import { aTexto, desdeTexto } from '../core/text';
import { PUEDE_COMPARTIR, compartir, copiar } from '../platform';
import { C, Vista, dibujarNivel, simEstatica } from '../render';
import { aviso, botonIcono, h, icono, modal } from './dom';
import { montarJuego, urlDeCodigo } from './juego';

export interface OpcionesEditor {
  alCambiar(n: Nivel): void;
  alSalir(): void;
}

interface Asa {
  x: number;
  y: number;
  mover(o: any, x: number, y: number): void;
}

type Arrastre =
  | { tipo: 'mover'; id: number | 'inicio'; dx: number; dy: number; extremo: 0 | 1 | 2 }
  | { tipo: 'asa'; id: number; i: number }
  | { tipo: 'crear'; id: number; ox: number; oy: number };

const ORDEN_TOQUE: Tipo[] = ['texto', 'laser', 'placa', 'portal', 'interruptor', 'botonmalo', 'boton', 'paredmala', 'pared', 'meta'];
const FLECHAS = ['↑', '→', '↓', '←'];
const REJILLAS = [5, 25, 1];

const AYUDA_CODIGO = `nombre Mi nivel
autor Yo
grabaciones 3            (o inf)
inicio 650 600
pared 50 300 350x50
pared 50 300 350x50 abre=derecha vel=2/40 por=b1
paredmala 400 0 50x200 por=b1 invertida
boton b1 200 200 r=50 peso=1
botonmalo m1 600 300
interruptor i1 300 300
placa p1 100 100 lado=50
laser 500 0 abajo blanco por=i1
portal 100 100 > 900 500
meta 1000 100 100x100 n=1
texto 200 500 "Un mensaje"`;

function limitar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function cajaLaser(o: { x: number; y: number; dir: number }) {
  return o.dir === 0 ? { x: o.x, y: o.y - 30, w: 40, h: 30 }
    : o.dir === 1 ? { x: o.x, y: o.y, w: 30, h: 40 }
    : o.dir === 2 ? { x: o.x, y: o.y, w: 40, h: 30 }
    : { x: o.x - 30, y: o.y, w: 30, h: 40 };
}

function iconoHerramienta(t: Tipo | null): HTMLElement {
  if (!t) return icono('seleccionar') as unknown as HTMLElement;
  const c = h('canvas', { width: 56, height: 56, class: 'ico-herr' });
  const ctx = c.getContext('2d')!;
  const n: Nivel = { nombre: '', autor: '', grabaciones: -1, inicio: { x: -500, y: -500 }, objetos: [] };
  const o = crear(t, 1, 0, 0) as any;
  if (t === 'pared' || t === 'paredmala') Object.assign(o, { x: 4, y: 18, w: 48, h: 20 });
  else if (t === 'boton' || t === 'botonmalo' || t === 'interruptor') Object.assign(o, { x: 28, y: 30, r: 22 });
  else if (t === 'placa') Object.assign(o, { x: 8, y: 8, lado: 40 });
  else if (t === 'laser') Object.assign(o, { x: 8, y: 2 });
  else if (t === 'portal') Object.assign(o, { x: 28, y: 28, x2: 28, y2: 28, r: 22 });
  else if (t === 'meta') Object.assign(o, { x: 8, y: 14, w: 40, h: 34 });
  else if (t === 'texto') Object.assign(o, { x: -100, y: -100 });
  n.objetos.push(o);
  const sim = new Sim(n);
  if (t === 'laser') sim.laseres[0].largo = 52;
  sim.jugador.muerto = true;
  dibujarNivel(ctx, sim);
  if (t === 'texto') {
    ctx.fillStyle = C.texto;
    ctx.font = '700 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('T', 28, 44);
  }
  return c;
}

export function montarEditor(raiz: HTMLElement, inicial: Nivel, op: OpcionesEditor) {
  let nivel = sanear(clonar(inicial));
  let sim = simEstatica(nivel);
  let sel: number | 'inicio' | null = null;
  let herramienta: Tipo | null = null;
  let conectando: number | null = null;
  let arrastre: Arrastre | null = null;
  let movido = false;
  let rejilla = 5;
  let puntero = { x: 0, y: 0 };
  let cerrarPrueba: (() => void) | null = null;
  let vivo = true;
  const historial: string[] = [JSON.stringify(nivel)];
  let hi = 0;

  const canvas = h('canvas', { class: 'lienzo editor-lienzo' });
  const pista = h('div', { class: 'pista visible' });
  const inspector = h('aside', { class: 'inspector sin-palanca' });
  const paleta = h('div', { class: 'paleta' });
  const titulo = h('button', { class: 'titulo titulo-boton', title: 'Nombre, autor y grabaciones', onclick: () => abrirDatos() });
  const bDeshacer = botonIcono('deshacer', 'Deshacer (Ctrl+Z)', () => saltar(-1));
  const bRehacer = botonIcono('rehacer', 'Rehacer (Ctrl+Y)', () => saltar(1));
  const bRejilla = h('button', { class: 'btn compacto', title: 'Tamaño de la rejilla de ajuste', onclick: () => {
    rejilla = REJILLAS[(REJILLAS.indexOf(rejilla) + 1) % REJILLAS.length];
    pintarBarra();
  } });
  const capaPrueba = h('div', { class: 'capa-prueba', hidden: true });

  const el = h('div', { class: 'editor' },
    h('header', { class: 'barra' },
      botonIcono('atras', 'Volver (Esc)', () => op.alSalir()),
      titulo,
      h('div', { class: 'acciones' },
        bDeshacer, bRehacer, bRejilla,
        botonIcono('codigo', 'Ver o editar el código del nivel', () => abrirCodigo()),
        botonIcono('compartir', 'Compartir nivel', () => abrirCompartir()),
        h('button', { class: 'btn primario', onclick: () => probar() }, icono('jugar'), 'Probar'),
      ),
    ),
    h('div', { class: 'editor-cuerpo' }, paleta, h('div', { class: 'escenario' }, canvas, pista, inspector)),
    capaPrueba,
  );
  raiz.appendChild(el);
  const vista = new Vista(canvas);

  const obj = (id: number | 'inicio' | null) => (typeof id === 'number' ? nivel.objetos.find((o) => o.id === id) ?? null : null);
  const ajustar = (v: number) => Math.round(v / rejilla) * rejilla;

  function cambio(confirmar: boolean) {
    sim = simEstatica(nivel);
    if (!confirmar) return;
    const s = JSON.stringify(nivel);
    if (s === historial[hi]) return;
    historial.splice(hi + 1);
    historial.push(s);
    if (historial.length > 120) historial.shift();
    hi = historial.length - 1;
    op.alCambiar(clonar(nivel));
    pintarBarra();
  }

  function saltar(d: number) {
    if (hi + d < 0 || hi + d >= historial.length) return;
    hi += d;
    nivel = JSON.parse(historial[hi]);
    if (typeof sel === 'number' && !obj(sel)) sel = null;
    sim = simEstatica(nivel);
    op.alCambiar(clonar(nivel));
    pintarBarra();
    pintarInspector();
  }

  function pintarBarra() {
    titulo.replaceChildren(
      h('strong', {}, nivel.nombre || 'Nivel sin nombre'),
      h('span', {}, `${nivel.autor ? `por ${nivel.autor}` : 'Sin autor'} · ${nivel.grabaciones < 0 ? '∞ grabaciones' : `${nivel.grabaciones} grab.`} ✎`),
    );
    bDeshacer.disabled = hi === 0;
    bRehacer.disabled = hi === historial.length - 1;
    bRejilla.textContent = `Rejilla ${rejilla}`;
  }

  function pintarPaleta() {
    paleta.replaceChildren(
      ...[null, ...TIPOS].map((t) =>
        h('button', {
          class: `herr ${herramienta === t ? 'activa' : ''}`,
          title: t ? `Añadir ${NOMBRES_TIPO[t].toLowerCase()}` : 'Seleccionar y mover',
          onclick: () => {
            herramienta = t;
            conectando = null;
            pintarPaleta();
            pintarInspector();
          },
        }, iconoHerramienta(t), h('span', {}, t ? NOMBRES_TIPO[t] : 'Mover')),
      ),
    );
  }

  function campoNumero(etiqueta: string, valor: number, min: number, max: number, paso: number, poner: (v: number) => void): HTMLElement {
    const entrada = h('input', { type: 'number', value: String(valor), min: String(min), max: String(max), step: String(paso), inputMode: 'numeric' });
    const fijar = (v: number, reescribir: boolean) => {
      if (!Number.isFinite(v)) return;
      v = limitar(Math.round(v), min, max);
      if (reescribir) entrada.value = String(v);
      poner(v);
      cambio(true);
    };
    entrada.addEventListener('input', () => fijar(parseFloat(entrada.value), false));
    entrada.addEventListener('blur', () => fijar(parseFloat(entrada.value) || min, true));
    return h('label', { class: 'campo-num' }, h('span', {}, etiqueta),
      h('div', { class: 'paso' },
        h('button', { type: 'button', 'aria-label': `Reducir ${etiqueta}`, onclick: () => fijar(parseFloat(entrada.value) - paso, true) }, '−'),
        entrada,
        h('button', { type: 'button', 'aria-label': `Aumentar ${etiqueta}`, onclick: () => fijar(parseFloat(entrada.value) + paso, true) }, '+'),
      ),
    );
  }

  function campoOpciones(etiqueta: string, opciones: string[], valor: number, poner: (i: number) => void): HTMLElement {
    const grupo = h('div', { class: 'segmentos' });
    opciones.forEach((texto, i) =>
      grupo.append(h('button', { type: 'button', class: i === valor ? 'activo' : '', onclick: () => {
        poner(i);
        cambio(true);
        pintarInspector();
      } }, texto)),
    );
    return h('div', { class: 'campo-num' }, h('span', {}, etiqueta), grupo);
  }

  function nombreDe(o: Objeto): string {
    const mismos = nivel.objetos.filter((x) => x.t === o.t);
    return `${NOMBRES_TIPO[o.t]} ${mismos.indexOf(o) + 1}`;
  }

  function pintarInspector() {
    const o = obj(sel);
    inspector.hidden = (!o && sel !== 'inicio') || !!herramienta || conectando != null;
    if (sel === 'inicio') {
      inspector.replaceChildren(
        h('h3', {}, 'Punto de inicio'),
        campoNumero('X', nivel.inicio.x, 0, ANCHO, rejilla, (v) => (nivel.inicio.x = v)),
        campoNumero('Y', nivel.inicio.y, 0, ALTO, rejilla, (v) => (nivel.inicio.y = v)),
        h('p', { class: 'nota' }, 'Aquí aparecen el jugador y todas sus grabaciones.'),
      );
      return;
    }
    if (!o) return;
    const L = LIMITES;
    const filas: (HTMLElement | false)[] = [h('h3', {}, nombreDe(o))];
    switch (o.t) {
      case 'pared':
      case 'paredmala':
        filas.push(
          campoNumero('Ancho', o.w, L.paredMin, 2000, rejilla, (v) => (o.w = v)),
          campoNumero('Alto', o.h, L.paredMin, 2000, rejilla, (v) => (o.h = v)),
        );
        if (o.por != null) {
          filas.push(
            campoOpciones('Se abre hacia', FLECHAS, o.abre, (i) => (o.abre = i)),
            campoNumero('Vel. abrir', o.velAbrir, 0, L.vel, 1, (v) => (o.velAbrir = v)),
            campoNumero('Vel. cerrar', o.velCerrar, 0, L.vel, 1, (v) => (o.velCerrar = v)),
            campoOpciones('Al activarse', ['Abre', 'Cierra'], o.invertida ? 1 : 0, (i) => (o.invertida = i === 1)),
          );
        }
        break;
      case 'boton':
      case 'botonmalo':
        filas.push(
          campoNumero('Radio', o.r, L.radioMin, L.radioMax, 5, (v) => (o.r = v)),
          campoNumero(o.t === 'boton' ? 'Peso' : 'Víctimas', o.peso, 1, L.peso, 1, (v) => (o.peso = v)),
          h('p', { class: 'nota' }, o.t === 'boton' ? 'Se activa mientras haya encima tantos monigotes como su peso.' : 'Mata a quien lo toca. Se activa tras cobrarse sus víctimas.'),
        );
        break;
      case 'interruptor':
        filas.push(
          campoNumero('Radio', o.r, L.radioMin, L.radioMax, 5, (v) => (o.r = v)),
          h('p', { class: 'nota' }, 'Cambia de estado cada vez que alguien lo pisa.'),
        );
        break;
      case 'placa':
        filas.push(
          campoNumero('Lado', o.lado, L.ladoMin, L.ladoMax, 5, (v) => (o.lado = v)),
          h('p', { class: 'nota' }, 'Las placas se activan cuando todas están del mismo color: negro si las pisó el jugador, blanco si fue una grabación.'),
        );
        break;
      case 'laser':
        filas.push(
          campoOpciones('Dirección', FLECHAS, o.dir, (i) => (o.dir = i)),
          campoOpciones('Color', ['Negro', 'Blanco'], o.blanco ? 1 : 0, (i) => (o.blanco = i === 1)),
          h('p', { class: 'nota' }, 'El láser negro mata a las grabaciones; el blanco, al jugador. Un activador le cambia el color.'),
        );
        break;
      case 'portal':
        filas.push(
          campoNumero('Radio', o.r, L.radioMin, L.radioMax, 5, (v) => (o.r = v)),
          h('p', { class: 'nota' }, 'Arrastra cada extremo por separado.'),
        );
        break;
      case 'meta':
        filas.push(
          campoNumero('Ancho', o.w, L.metaMin, L.metaMax, rejilla, (v) => (o.w = v)),
          campoNumero('Alto', o.h, L.metaMin, L.metaMax, rejilla, (v) => (o.h = v)),
          campoNumero('Monigotes', o.n, 1, L.peso, 1, (v) => (o.n = v)),
        );
        break;
      case 'texto': {
        const entrada = h('input', { type: 'text', value: o.texto, maxLength: L.texto });
        entrada.addEventListener('input', () => {
          o.texto = entrada.value;
          cambio(true);
        });
        filas.push(h('label', { class: 'campo' }, 'Texto', entrada));
        break;
      }
    }

    if (esReceptor(o)) {
      const a = obj(o.por);
      filas.push(
        a ? h('p', { class: 'nota enlace' }, `Conectado a ${nombreDe(a)}`) : false,
        h('div', { class: 'fila' },
          h('button', { class: 'btn', onclick: () => empezarConexion(o.id) }, icono('conexiones'), a ? 'Cambiar' : 'Conectar'),
          a ? h('button', { class: 'btn', onclick: () => { o.por = null; cambio(true); pintarInspector(); } }, 'Desconectar') : false,
        ),
      );
    } else if (esActivador(o)) {
      const n = nivel.objetos.filter((x) => esReceptor(x) && x.por === o.id).length;
      filas.push(
        h('p', { class: 'nota enlace' }, n ? `Controla ${n} ${n === 1 ? 'objeto' : 'objetos'}` : 'Sin conectar'),
        h('button', { class: 'btn', onclick: () => empezarConexion(o.id) }, icono('conexiones'), 'Conectar con…'),
      );
    }
    filas.push(
      h('div', { class: 'fila' },
        botonIcono('duplicar', 'Duplicar (Ctrl+D)', duplicar),
        botonIcono('borrar', 'Eliminar (Supr)', eliminar, 'peligro'),
      ),
    );
    inspector.replaceChildren(...(filas.filter(Boolean) as HTMLElement[]));
  }

  function empezarConexion(id: number) {
    conectando = id;
    herramienta = null;
    pintarPaleta();
    pintarInspector();
  }

  function conectarCon(destino: Objeto | null) {
    const origen = obj(conectando);
    conectando = null;
    pintarInspector();
    if (!origen || !destino || origen === destino) return;
    if (esActivador(origen) && esReceptor(destino)) destino.por = origen.id;
    else if (esReceptor(origen) && esActivador(destino)) origen.por = destino.id;
    else return aviso('Conecta un botón, interruptor o placa con una pared o un láser');
    cambio(true);
    pintarInspector();
  }

  function eliminar() {
    const o = obj(sel);
    if (!o) return;
    nivel.objetos = nivel.objetos.filter((x) => x !== o);
    for (const x of nivel.objetos) if (esReceptor(x) && x.por === o.id) x.por = null;
    sel = null;
    cambio(true);
    pintarInspector();
  }

  function duplicar() {
    const o = obj(sel);
    if (!o || !hayHueco()) return;
    const copia = { ...o, id: siguienteId(nivel), x: o.x + 25, y: o.y + 25 } as Objeto;
    if (copia.t === 'portal') (copia.x2 += 25), (copia.y2 += 25);
    nivel.objetos.push(copia);
    sel = copia.id;
    cambio(true);
    pintarInspector();
  }

  function hayHueco(): boolean {
    if (nivel.objetos.length < LIMITES.objetos) return true;
    aviso(`Un nivel admite como máximo ${LIMITES.objetos} objetos`);
    return false;
  }

  function anchoTexto(s: string): number {
    vista.ctx.save();
    vista.ctx.font = '13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const w = vista.ctx.measureText(s).width;
    vista.ctx.restore();
    return Math.max(30, w);
  }

  function caja(o: Objeto): { x: number; y: number; w: number; h: number } {
    switch (o.t) {
      case 'pared':
      case 'paredmala':
      case 'meta':
        return { x: o.x, y: o.y, w: o.w, h: o.h };
      case 'boton':
      case 'botonmalo':
      case 'interruptor':
        return { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 };
      case 'placa':
        return { x: o.x, y: o.y, w: o.lado, h: o.lado };
      case 'laser':
        return cajaLaser(o);
      case 'portal': {
        const x = Math.min(o.x, o.x2) - o.r;
        const y = Math.min(o.y, o.y2) - o.r;
        return { x, y, w: Math.abs(o.x - o.x2) + o.r * 2, h: Math.abs(o.y - o.y2) + o.r * 2 };
      }
      case 'texto':
        return { x: o.x - 3, y: o.y - 3, w: anchoTexto(o.texto) + 6, h: 22 };
    }
  }

  function toca(o: Objeto, x: number, y: number): 0 | 1 | 2 {
    const m = Math.min(12, 6 / vista.escala);
    if (o.t === 'boton' || o.t === 'botonmalo' || o.t === 'interruptor') return Math.hypot(x - o.x, y - o.y) < o.r + m ? 1 : 0;
    if (o.t === 'portal') {
      if (Math.hypot(x - o.x, y - o.y) < o.r + m) return 1;
      return Math.hypot(x - o.x2, y - o.y2) < o.r + m ? 2 : 0;
    }
    const c = caja(o);
    return x > c.x - m && x < c.x + c.w + m && y > c.y - m && y < c.y + c.h + m ? 1 : 0;
  }

  function objetoEn(x: number, y: number): { o: Objeto; extremo: 0 | 1 | 2 } | null {
    for (const t of ORDEN_TOQUE) {
      for (let i = nivel.objetos.length - 1; i >= 0; i--) {
        const o = nivel.objetos[i];
        if (o.t !== t) continue;
        const extremo = toca(o, x, y);
        if (extremo) return { o, extremo };
      }
    }
    return null;
  }

  function asas(o: Objeto): Asa[] {
    if (o.t === 'pared' || o.t === 'paredmala' || o.t === 'meta') {
      const min = o.t === 'meta' ? LIMITES.metaMin : LIMITES.paredMin;
      const max = o.t === 'meta' ? LIMITES.metaMax : 2000;
      const lista: Asa[] = [];
      for (const ky of [0, 0.5, 1]) {
        for (const kx of [0, 0.5, 1]) {
          if (kx === 0.5 && ky === 0.5) continue;
          lista.push({
            x: o.x + o.w * kx,
            y: o.y + o.h * ky,
            mover(p: typeof o, x, y) {
              const der = p.x + p.w;
              const inf = p.y + p.h;
              if (kx === 0) (p.w = limitar(der - x, min, max)), (p.x = der - p.w);
              if (kx === 1) p.w = limitar(x - p.x, min, max);
              if (ky === 0) (p.h = limitar(inf - y, min, max)), (p.y = inf - p.h);
              if (ky === 1) p.h = limitar(y - p.y, min, max);
            },
          });
        }
      }
      return lista;
    }
    if (o.t === 'boton' || o.t === 'botonmalo' || o.t === 'interruptor' || o.t === 'portal') {
      return [{
        x: o.x + o.r,
        y: o.y,
        mover: (p: typeof o, x, y) => (p.r = limitar(Math.round(Math.hypot(x - p.x, y - p.y) / 5) * 5, LIMITES.radioMin, LIMITES.radioMax)),
      }];
    }
    if (o.t === 'placa') {
      return [{
        x: o.x + o.lado,
        y: o.y + o.lado,
        mover: (p: typeof o, x, y) => (p.lado = limitar(Math.max(x - p.x, y - p.y), LIMITES.ladoMin, LIMITES.ladoMax)),
      }];
    }
    return [];
  }

  function alPulsar(e: PointerEvent) {
    if (e.button > 0) return;
    canvas.setPointerCapture(e.pointerId);
    const p = vista.aMundo(e.clientX, e.clientY);
    puntero = p;
    movido = false;

    if (conectando != null) {
      conectarCon(objetoEn(p.x, p.y)?.o ?? null);
      return;
    }

    if (herramienta) {
      if (!hayHueco()) return;
      const t = herramienta;
      const x = limitar(ajustar(p.x), 0, ANCHO);
      const y = limitar(ajustar(p.y), 0, ALTO);
      const o = crear(t, siguienteId(nivel), x, y);
      nivel.objetos.push(o);
      sel = o.id;
      herramienta = null;
      if (o.t === 'pared' || o.t === 'paredmala' || o.t === 'meta') arrastre = { tipo: 'crear', id: o.id, ox: x, oy: y };
      else {
        if (o.t === 'placa') (o.x -= 25), (o.y -= 25);
        if (o.t === 'laser') (o.x -= 20), (o.y -= 15);
        if (o.t === 'portal') o.x2 = limitar(o.x + 150, 0, ANCHO);
        arrastre = { tipo: 'mover', id: o.id, dx: p.x - o.x, dy: p.y - o.y, extremo: o.t === 'portal' ? 2 : 1 };
        if (o.t === 'portal') (arrastre.dx = p.x - o.x2), (arrastre.dy = p.y - o.y2);
      }
      movido = true;
      cambio(false);
      pintarPaleta();
      pintarInspector();
      return;
    }

    const actual = obj(sel);
    if (actual) {
      const alcance = 14 / vista.escala;
      const i = asas(actual).findIndex((a) => Math.hypot(a.x - p.x, a.y - p.y) < alcance);
      if (i >= 0) {
        arrastre = { tipo: 'asa', id: actual.id, i };
        return;
      }
    }
    const tocado = objetoEn(p.x, p.y);
    const enInicio = Math.hypot(p.x - nivel.inicio.x, p.y - nivel.inicio.y) < 24;
    if (enInicio && (!tocado || tocado.o.t === 'pared' || tocado.o.t === 'meta' || tocado.o.t === 'paredmala')) {
      sel = 'inicio';
      arrastre = { tipo: 'mover', id: 'inicio', dx: p.x - nivel.inicio.x, dy: p.y - nivel.inicio.y, extremo: 1 };
    } else if (tocado) {
      const o = tocado.o;
      sel = o.id;
      const bx = tocado.extremo === 2 && o.t === 'portal' ? o.x2 : o.x;
      const by = tocado.extremo === 2 && o.t === 'portal' ? o.y2 : o.y;
      arrastre = { tipo: 'mover', id: o.id, dx: p.x - bx, dy: p.y - by, extremo: o.t === 'portal' ? tocado.extremo : 0 };
    } else sel = null;
    pintarInspector();
  }

  function alMover(e: PointerEvent) {
    const p = vista.aMundo(e.clientX, e.clientY);
    puntero = p;
    if (!arrastre) return;
    const a = arrastre;
    if (a.tipo === 'mover') {
      const x = limitar(ajustar(p.x - a.dx), -200, ANCHO + 200);
      const y = limitar(ajustar(p.y - a.dy), -200, ALTO + 200);
      if (a.id === 'inicio') {
        nivel.inicio = { x: limitar(x, 0, ANCHO), y: limitar(y, 0, ALTO) };
      } else {
        const o = obj(a.id);
        if (!o) return;
        if (o.t === 'portal' && a.extremo === 2) (o.x2 = x), (o.y2 = y);
        else if (o.t === 'portal' && a.extremo === 0) {
          const dx = x - o.x;
          const dy = y - o.y;
          (o.x = x), (o.y = y), (o.x2 += dx), (o.y2 += dy);
        } else (o.x = x), (o.y = y);
      }
    } else if (a.tipo === 'asa') {
      const o = obj(a.id);
      if (!o) return;
      asas(o)[a.i]?.mover(o, ajustar(p.x), ajustar(p.y));
    } else {
      const o = obj(a.id) as any;
      if (!o) return;
      const x = ajustar(p.x);
      const y = ajustar(p.y);
      const min = o.t === 'meta' ? LIMITES.metaMin : LIMITES.paredMin;
      const max = o.t === 'meta' ? LIMITES.metaMax : 2000;
      if (Math.abs(x - a.ox) < 10 && Math.abs(y - a.oy) < 10) return;
      o.w = limitar(Math.abs(x - a.ox), min, max);
      o.h = limitar(Math.abs(y - a.oy), min, max);
      o.x = x < a.ox ? a.ox - o.w : a.ox;
      o.y = y < a.oy ? a.oy - o.h : a.oy;
      a.id = o.id;
      (a as any).estirado = true;
    }
    movido = true;
    cambio(false);
  }

  function alSoltar() {
    if (!arrastre) return;
    const a = arrastre;
    arrastre = null;
    if (a.tipo === 'crear' && !(a as any).estirado) {
      const o = obj(a.id) as any;
      if (o) (o.x = ajustar(o.x - o.w / 2)), (o.y = ajustar(o.y - o.h / 2));
    }
    if (movido) {
      cambio(true);
      pintarInspector();
    }
  }

  canvas.addEventListener('pointerdown', alPulsar);
  canvas.addEventListener('pointermove', alMover);
  canvas.addEventListener('pointerup', alSoltar);
  canvas.addEventListener('pointercancel', alSoltar);

  function dibujar(ahora: number) {
    if (!vivo) return;
    requestAnimationFrame(dibujar);
    if (cerrarPrueba) return;
    const ctx = vista.ctx;
    const px = 1 / vista.escala;
    vista.preparar();

    if (rejilla >= 25) {
      ctx.fillStyle = '#d8d8d8';
      for (let x = rejilla; x < ANCHO; x += rejilla) for (let y = rejilla; y < ALTO; y += rejilla) ctx.fillRect(x - px, y - px, 2 * px, 2 * px);
    }
    dibujarNivel(ctx, sim, { conexiones: true, tiempo: ahora });

    ctx.strokeStyle = C.azul;
    ctx.lineWidth = 1.5 * px;
    if (sel === 'inicio') {
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.beginPath();
      ctx.arc(nivel.inicio.x, nivel.inicio.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const o = obj(sel);
    if (o) {
      const c = caja(o);
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.strokeRect(c.x - 3, c.y - 3, c.w + 6, c.h + 6);
      ctx.setLineDash([]);
      const t = 5 * px;
      for (const a of asas(o)) {
        ctx.fillStyle = C.blanco;
        ctx.fillRect(a.x - t, a.y - t, t * 2, t * 2);
        ctx.strokeRect(a.x - t, a.y - t, t * 2, t * 2);
      }
    }

    const origen = obj(conectando);
    if (origen) {
      const c = caja(origen);
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.beginPath();
      ctx.moveTo(c.x + c.w / 2, c.y + c.h / 2);
      ctx.lineTo(puntero.x, puntero.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    vista.terminar();

    let t = 'Toca un objeto para seleccionarlo y arrástralo para moverlo';
    if (conectando != null) t = origen && esActivador(origen) ? 'Toca la pared o el láser que debe controlar' : 'Toca el botón, interruptor o placa que lo controla';
    else if (herramienta === 'pared' || herramienta === 'paredmala' || herramienta === 'meta') t = `${NOMBRES_TIPO[herramienta]}: arrastra sobre el nivel para dibujarla`;
    else if (herramienta) t = `${NOMBRES_TIPO[herramienta]}: toca el nivel para colocarlo`;
    else if (!nivel.objetos.length) t = 'Elige un objeto de la izquierda y colócalo en el nivel';
    else if (o) t = 'Arrastra los cuadrados para cambiar el tamaño · edita sus propiedades en el panel';
    if (pista.textContent !== t) pista.textContent = t;

    if (o || sel === 'inicio') {
      const x = o ? caja(o).x + caja(o).w / 2 : nivel.inicio.x;
      inspector.classList.toggle('izq', x > ANCHO * 0.6);
    }
  }
  requestAnimationFrame(dibujar);

  function abrirDatos(alTerminar?: () => void) {
    const nombre = h('input', { type: 'text', value: nivel.nombre, maxLength: LIMITES.nombre, placeholder: 'Nombre del nivel' });
    const autor = h('input', { type: 'text', value: nivel.autor, maxLength: LIMITES.autor, placeholder: 'Tu nombre' });
    const ilimitadas = h('input', { type: 'checkbox', checked: nivel.grabaciones < 0 });
    const cantidad = h('input', { type: 'number', min: '0', max: String(LIMITES.grabaciones), value: String(Math.max(0, nivel.grabaciones)), disabled: nivel.grabaciones < 0 });
    ilimitadas.addEventListener('change', () => (cantidad.disabled = ilimitadas.checked));
    const aceptar = () => {
      nivel.nombre = nombre.value.trim();
      nivel.autor = autor.value.trim();
      nivel.grabaciones = ilimitadas.checked ? -1 : limitar(parseInt(cantidad.value, 10) || 0, 0, LIMITES.grabaciones);
      cambio(true);
      pintarBarra();
      m.cerrar();
      alTerminar?.();
    };
    const m = modal('Datos del nivel',
      h('label', { class: 'campo' }, 'Nombre', nombre),
      h('label', { class: 'campo' }, 'Autor', autor),
      h('label', { class: 'casilla' }, ilimitadas, 'Grabaciones ilimitadas'),
      h('label', { class: 'campo' }, 'Número máximo de grabaciones', cantidad),
      h('div', { class: 'fila fin' }, h('button', { class: 'btn primario', onclick: aceptar }, 'Aceptar')),
    );
    m.caja.addEventListener('keydown', (e) => e.key === 'Enter' && aceptar());
    nombre.focus();
  }

  function abrirCodigo() {
    const area = h('textarea', { class: 'codigo', spellcheck: false, rows: 14, value: aTexto(nivel) });
    const errores = h('pre', { class: 'error' });
    const aplicar = () => {
      const r = desdeTexto(area.value);
      if (r.errores.length) {
        errores.textContent = r.errores.join('\n');
        return;
      }
      nivel = r.nivel;
      sel = null;
      cambio(true);
      pintarBarra();
      pintarInspector();
      m.cerrar();
    };
    const m = modal('Código del nivel',
      h('p', { class: 'nota' }, 'El nivel escrito en el lenguaje de RecordingMan. Puedes editarlo a mano y aplicarlo.'),
      area,
      errores,
      h('details', {}, h('summary', {}, 'Referencia rápida'), h('pre', { class: 'ayuda' }, AYUDA_CODIGO)),
      h('div', { class: 'fila fin' },
        h('button', { class: 'btn', onclick: () => void copiar(area.value).then((ok) => aviso(ok ? 'Código copiado' : 'No se pudo copiar')) }, 'Copiar'),
        h('button', { class: 'btn primario', onclick: aplicar }, 'Aplicar'),
      ),
    );
    m.caja.classList.add('ancho');
  }

  function abrirCompartir() {
    if (!nivel.objetos.some((o) => o.t === 'meta')) return aviso('Añade al menos una meta antes de compartir el nivel');
    if (!nivel.nombre || !nivel.autor) return abrirDatos(() => nivel.nombre && nivel.autor && abrirCompartir());
    const url = urlDeCodigo(codificar(nivel));
    const campo = h('input', { type: 'text', readOnly: true, value: url, onfocus: (e: Event) => (e.target as HTMLInputElement).select() });
    modal('Compartir nivel',
      h('p', { class: 'nota' }, `«${nivel.nombre}», por ${nivel.autor}. Todo el nivel viaja dentro del enlace (${url.length} caracteres).`),
      campo,
      h('div', { class: 'fila fin' },
        h('button', { class: 'btn', onclick: () => void copiar(url).then((ok) => aviso(ok ? 'Enlace copiado' : 'No se pudo copiar')) }, 'Copiar enlace'),
        PUEDE_COMPARTIR && h('button', { class: 'btn primario', onclick: () => void compartir(url, nivel.nombre) }, icono('compartir'), 'Compartir'),
      ),
    );
  }

  function probar() {
    if (cerrarPrueba) return;
    if (!nivel.objetos.some((o) => o.t === 'meta')) aviso('Este nivel no tiene meta: no se puede completar');
    capaPrueba.hidden = false;
    const cerrar = () => {
      cerrarPrueba?.();
      cerrarPrueba = null;
      capaPrueba.hidden = true;
    };
    cerrarPrueba = montarJuego(capaPrueba, {
      nivel: clonar(nivel),
      etiqueta: 'Probando',
      alSalir: cerrar,
      accionesFin: () => [h('button', { class: 'btn primario', onclick: cerrar }, 'Volver al editor')],
    });
  }

  function atras() {
    if (cerrarPrueba) {
      cerrarPrueba();
      cerrarPrueba = null;
      capaPrueba.hidden = true;
    } else if (conectando != null || herramienta) {
      conectando = null;
      herramienta = null;
      pintarPaleta();
      pintarInspector();
    } else if (sel != null) {
      sel = null;
      pintarInspector();
    } else op.alSalir();
  }

  function teclado(e: KeyboardEvent) {
    if (cerrarPrueba || document.querySelector('.modal')) return;
    const t = e.target as HTMLElement;
    const enCampo = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA';
    if (e.key === 'Escape') {
      if (enCampo) t.blur();
      else atras();
      return;
    }
    if (enCampo) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (ctrl && k === 'z') return void (e.preventDefault(), saltar(e.shiftKey ? 1 : -1));
    if (ctrl && k === 'y') return void (e.preventDefault(), saltar(1));
    if (ctrl && k === 'd') return void (e.preventDefault(), duplicar());
    if (e.key === 'Delete' || e.key === 'Backspace') return eliminar();
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    const o = obj(sel);
    const paso = e.shiftKey ? 1 : rejilla;
    if (sel === 'inicio') (nivel.inicio.x += d[0] * paso), (nivel.inicio.y += d[1] * paso);
    else if (o) {
      (o.x += d[0] * paso), (o.y += d[1] * paso);
      if (o.t === 'portal') (o.x2 += d[0] * paso), (o.y2 += d[1] * paso);
    } else return;
    cambio(true);
    pintarInspector();
  }
  window.addEventListener('keydown', teclado);

  pintarBarra();
  pintarPaleta();
  pintarInspector();

  return {
    atras,
    destruir() {
      vivo = false;
      cerrarPrueba?.();
      window.removeEventListener('keydown', teclado);
      vista.destruir();
      el.remove();
    },
  };
}
