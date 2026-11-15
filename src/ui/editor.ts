import { codificar } from '../core/codec';
import {
  ALTO, ANCHO, LIMITES, MODOS_MOVIL, MovilDef, NOMBRES_TIPO, Nivel, OPERACIONES, Objeto, Ranura, TAM_LOGICA, TIPOS, Tipo, clonar, crear, esActivador,
  miembrosMoviles, ranuras, sanear, siguienteId, zonasObjeto,
} from '../core/level';
import { Sim } from '../core/sim';
import { aTexto, desdeTexto } from '../core/text';
import { TACTIL } from '../input';
import { copiar } from '../platform';
import { BORDE_MOVIL, C, Vista, dibujarNivel, pinEntrada, pinSalida, simEstatica } from '../render';
import { aviso, botonIcono, h, icono, modal } from './dom';
import { compartirNivel, montarJuego } from './juego';

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
  | { tipo: 'asa'; id: number | 'inicio'; i: number }
  | { tipo: 'crear'; id: number; ox: number; oy: number }
  | { tipo: 'grupo'; x: number; y: number; orig: Map<number, number[]> };

const ORDEN_TOQUE: Tipo[] = ['movil', 'texto', 'puerta', 'switch', 'temporizador', 'delay', 'terremoto', 'caja', 'interruptor', 'botontodos', 'boton', 'paredmala', 'pared', 'pinchos', 'meta', 'control', 'cartel', 'suelo'];
const FLECHAS = ['↑', '→', '↓', '←'];
const REJILLA = 25;
const NOMBRE_RANURA: Record<Ranura, string> = { por: 'Entrada', a: 'Entrada A', b: 'Entrada B' };
const NOMBRE_PALETA: Partial<Record<Tipo, string>> = { botontodos: 'Botón todos', puerta: 'Puerta', control: 'Control', movil: 'Móvil' };
const NOTA_OPERACION = {
  and: 'Se activa cuando sus dos entradas están activas.',
  or: 'Se activa cuando al menos una entrada está activa.',
  xand: 'Se activa cuando sus dos entradas valen lo mismo.',
  xor: 'Se activa cuando solo una de sus entradas está activa.',
  not: 'Se activa cuando su entrada no lo está.',
};

function limitesRect(t: Tipo): [number, number] {
  if (t === 'meta') return [LIMITES.metaMin, LIMITES.metaMax];
  if (t === 'caja') return [LIMITES.cajaMin, LIMITES.cajaMax];
  if (t === 'suelo' || t === 'control' || t === 'cartel' || t === 'pinchos' || t === 'movil') return [LIMITES.sueloMin, 2000];
  return [LIMITES.paredMin, 2000];
}

function ref(o: Objeto, r: Ranura): number | null {
  return (o as unknown as Record<Ranura, number | null>)[r] ?? null;
}

function fijarRef(o: Objeto, r: Ranura, v: number | null) {
  (o as unknown as Record<Ranura, number | null>)[r] = v;
}

const AYUDA_CODIGO = `nombre Mi nivel
autor Yo
fondo #fafafa
inicio 600 550 100x100
suelo 100 100 200x100 color=#e6e6e6
pared 50 300 350x50
pared 50 300 350x50 abre=derecha tiempo=0.5/0.1 por=b1
paredmala 400 0 50x200 por=b1 invertida
boton b1 200 200 r=50
botontodos t1 600 300
interruptor i1 300 300
control 400 300 100x100
pinchos 100 400 200x50 apagado por=b1
movil 600 400 100x100 ruta=200,0;200,-100 vel=100 modo=idavuelta apagada atras=50 por=b1
caja 500 300 50x50
puerta g1 700 300 and a=b1 b=i1     (and, or, xand, xor, not)
switch s1 800 300 activo por=g1
temporizador r1 900 300 activo=1 inactivo=2.5
delay d1 1000 300 tiempo=1.5 por=b1
terremoto 1100 300 intensidad=10 frecuencia=15 radio=300 activo por=b1
meta 1000 100 100x100
texto 200 500 "Un mensaje"
cartel 300 500 150x100 "Mensaje del cartel" todos invisible`;

function limitar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function iconoHerramienta(t: Tipo | null): HTMLElement {
  if (!t) return icono('seleccionar') as unknown as HTMLElement;
  const c = h('canvas', { width: 56, height: 56, class: 'ico-herr' });
  const ctx = c.getContext('2d')!;
  const n: Nivel = { nombre: '', autor: '', fondo: C.fondo, inicio: { x: -500, y: -500, w: 100, h: 100 }, objetos: [] };
  const o = crear(t, 1, 0, 0) as any;
  if (t === 'pared' || t === 'paredmala') Object.assign(o, { x: 4, y: 18, w: 48, h: 20 });
  else if (t === 'control' || t === 'cartel') Object.assign(o, { x: 6, y: 6, w: 44, h: 44 });
  else if (t === 'pinchos') Object.assign(o, { x: 4, y: 14, w: 48, h: 28 });
  else if (t === 'movil') Object.assign(o, { x: 6, y: 6, w: 44, h: 44, ruta: [] });
  else if (t === 'boton' || t === 'botontodos' || t === 'interruptor') Object.assign(o, { x: 28, y: 30, r: 22 });
  else if (t === 'suelo') Object.assign(o, { x: 6, y: 12, w: 44, h: 32, color: '#c9c9c9' });
  else if (t === 'caja') Object.assign(o, { x: 6, y: 6, w: 44, h: 44 });
  else if (t === 'puerta' || t === 'switch' || t === 'temporizador' || t === 'delay' || t === 'terremoto') Object.assign(o, { x: 28, y: 28 });
  else if (t === 'meta') Object.assign(o, { x: 8, y: 14, w: 40, h: 34 });
  else if (t === 'texto') Object.assign(o, { x: -100, y: -100 });
  n.objetos.push(o);
  const sim = new Sim(n);
  sim.jugador.muerto = true;
  dibujarNivel(ctx, sim, { editor: true });
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
  let conectando: { id: number; ranura: Ranura | null } | null = null;
  let arrastre: Arrastre | null = null;
  let movido = false;
  const rejilla = REJILLA;
  let puntero = { x: 0, y: 0 };
  let pan: { id: number; x: number; y: number } | null = null;
  let mapa = false;
  let grupo: number[] = [];
  let cerrarPrueba: (() => void) | null = null;
  let vivo = true;
  const historial: string[] = [JSON.stringify(nivel)];
  let hi = 0;

  const canvas = h('canvas', { class: 'lienzo editor-lienzo' });
  const pista = h('div', { class: 'pista visible' });
  const inspector = h('aside', { class: 'inspector sin-palanca' });
  const paleta = h('div', { class: 'paleta' });
  const titulo = h('button', { class: 'titulo titulo-boton', title: 'Nombre y autor', onclick: () => abrirDatos() });
  const bDeshacer = botonIcono('deshacer', 'Deshacer (Ctrl+Z)', () => saltar(-1));
  const bRehacer = botonIcono('rehacer', 'Rehacer (Ctrl+Y)', () => saltar(1));
  const bFondo = h('input', { type: 'color', value: nivel.fondo });
  bFondo.addEventListener('input', () => {
    nivel.fondo = bFondo.value;
    vista.fondo = nivel.fondo;
  });
  bFondo.addEventListener('change', () => {
    nivel.fondo = bFondo.value;
    cambio(true);
  });
  const capaPrueba = h('div', { class: 'capa-prueba', hidden: true });

  const el = h('div', { class: 'editor' },
    h('header', { class: 'barra' },
      botonIcono('atras', 'Volver (Esc)', () => op.alSalir()),
      titulo,
      h('div', { class: 'acciones' },
        bDeshacer, bRehacer,
        h('label', { class: 'btn compacto color-fondo', title: 'Color de fondo del nivel' }, 'Fondo', bFondo),
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
  vista.completa = true;

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
    grupo = grupo.filter((id) => obj(id));
    normalizarGrupo();
    sim = simEstatica(nivel);
    op.alCambiar(clonar(nivel));
    pintarBarra();
    pintarInspector();
  }

  function pintarBarra() {
    titulo.replaceChildren(
      h('strong', {}, nivel.nombre || 'Nivel sin nombre'),
      h('span', {}, `${nivel.autor ? `por ${nivel.autor}` : 'Sin autor'} ✎`),
    );
    bDeshacer.disabled = hi === 0;
    bRehacer.disabled = hi === historial.length - 1;
    bFondo.value = nivel.fondo;
    vista.fondo = nivel.fondo;
  }

  function pintarPaleta() {
    const botones = [null, ...TIPOS].map((t) =>
      h('button', {
        class: `herr ${!mapa && herramienta === t ? 'activa' : ''}`,
        title: t ? `Añadir ${NOMBRES_TIPO[t].toLowerCase()}` : 'Seleccionar y mover',
        onclick: () => {
          herramienta = t;
          conectando = null;
          mapa = false;
          pintarPaleta();
          pintarInspector();
        },
      }, iconoHerramienta(t), h('span', {}, t ? NOMBRE_PALETA[t] ?? NOMBRES_TIPO[t] : 'Mover')),
    );
    if (TACTIL) {
      botones.splice(1, 0,
        h('button', {
          class: `herr ${mapa ? 'activa' : ''}`,
          title: 'Mover el mapa',
          onclick: () => {
            mapa = true;
            herramienta = null;
            conectando = null;
            pintarPaleta();
            pintarInspector();
          },
        }, icono('desplazar'), h('span', {}, 'Mapa')),
      );
    }
    paleta.replaceChildren(...botones);
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

  function campoSegundos(etiqueta: string, decimas: number, poner: (v: number) => void, min = LIMITES.tiempoMin): HTMLElement {
    const max = LIMITES.tiempoMax;
    const entrada = h('input', { type: 'number', value: String(decimas / 10), min: String(min / 10), max: String(max / 10), step: '0.1', inputMode: 'decimal' });
    const fijar = (s: number, reescribir: boolean) => {
      if (!Number.isFinite(s)) return;
      const v = limitar(Math.round(s * 10), min, max);
      if (reescribir) entrada.value = String(v / 10);
      poner(v);
      cambio(true);
    };
    entrada.addEventListener('input', () => fijar(parseFloat(entrada.value), false));
    entrada.addEventListener('blur', () => fijar(parseFloat(entrada.value) || min / 10, true));
    return h('label', { class: 'campo-num' }, h('span', {}, etiqueta),
      h('div', { class: 'paso' },
        h('button', { type: 'button', 'aria-label': `Reducir ${etiqueta}`, onclick: () => fijar(parseFloat(entrada.value) - 0.5, true) }, '−'),
        entrada,
        h('button', { type: 'button', 'aria-label': `Aumentar ${etiqueta}`, onclick: () => fijar(parseFloat(entrada.value) + 0.5, true) }, '+'),
      ),
    );
  }

  function campoColor(etiqueta: string, valor: string, poner: (v: string) => void): HTMLElement {
    const entrada = h('input', { type: 'color', value: valor });
    entrada.addEventListener('input', () => {
      poner(entrada.value);
      cambio(false);
    });
    entrada.addEventListener('change', () => {
      poner(entrada.value);
      cambio(true);
    });
    return h('label', { class: 'campo-num' }, h('span', {}, etiqueta), entrada);
  }

  function campoOpciones(etiqueta: string, opciones: string[], valor: number, poner: (i: number) => void, apilado = false): HTMLElement {
    const grupo = h('div', { class: 'segmentos' });
    opciones.forEach((texto, i) =>
      grupo.append(h('button', { type: 'button', class: i === valor ? 'activo' : '', onclick: () => {
        poner(i);
        cambio(true);
        pintarInspector();
      } }, texto)),
    );
    return h('div', { class: apilado ? 'campo-num apilado' : 'campo-num' }, h('span', {}, etiqueta), grupo);
  }

  function nombreDe(o: Objeto): string {
    const mismos = nivel.objetos.filter((x) => x.t === o.t);
    return `${NOMBRES_TIPO[o.t]} ${mismos.indexOf(o) + 1}`;
  }

  function normalizarGrupo() {
    if (grupo.length === 1) sel = grupo[0];
    if (grupo.length < 2) grupo = [];
  }

  function alternarGrupo(id: number) {
    if (!grupo.length && typeof sel === 'number') grupo = [sel];
    grupo = grupo.includes(id) ? grupo.filter((x) => x !== id) : [...grupo, id];
    sel = null;
    normalizarGrupo();
  }

  function pintarInspector() {
    if (grupo.length) {
      inspector.hidden = !!herramienta || !!conectando;
      inspector.replaceChildren(
        h('h3', {}, `${grupo.length} objetos seleccionados`),
        h('p', { class: 'nota' }, 'Arrastra cualquiera de ellos para moverlos juntos. Ctrl + clic añade o quita objetos de la selección.'),
        h('div', { class: 'fila' }, botonIcono('duplicar', 'Duplicar (Ctrl+D)', duplicar)),
      );
      return;
    }
    const o = obj(sel);
    inspector.hidden = (!o && sel !== 'inicio') || !!herramienta || !!conectando;
    if (sel === 'inicio') {
      inspector.replaceChildren(
        h('h3', {}, 'Punto de inicio'),
        campoNumero('X', nivel.inicio.x, -LIMITES.coord, LIMITES.coord, rejilla, (v) => (nivel.inicio.x = v)),
        campoNumero('Y', nivel.inicio.y, -LIMITES.coord, LIMITES.coord, rejilla, (v) => (nivel.inicio.y = v)),
        campoNumero('Ancho', nivel.inicio.w, LIMITES.inicioMin, 2000, rejilla, (v) => (nivel.inicio.w = v)),
        campoNumero('Alto', nivel.inicio.h, LIMITES.inicioMin, 2000, rejilla, (v) => (nivel.inicio.h = v)),
        h('p', { class: 'nota' }, 'Aquí aparece el jugador, junto a la bandera. En una partida con varios jugadores, cada uno aparece en un punto al azar del rectángulo.'),
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
            campoSegundos('Abrir (s)', o.tAbrir, (v) => (o.tAbrir = v), 0),
            campoSegundos('Cerrar (s)', o.tCerrar, (v) => (o.tCerrar = v), 0),
            campoOpciones('Al activarse', ['Abre', 'Cierra'], o.invertida ? 1 : 0, (i) => (o.invertida = i === 1)),
          );
        }
        break;
      case 'boton':
      case 'botontodos':
        filas.push(
          campoNumero('Radio', o.r, L.radioMin, L.radioMax, 5, (v) => (o.r = v)),
          h('p', { class: 'nota' }, o.t === 'boton' ? 'Se activa mientras haya encima un jugador o una caja.' : 'Solo se activa mientras todos los jugadores están encima a la vez.'),
        );
        break;
      case 'suelo':
        filas.push(
          campoNumero('Ancho', o.w, L.sueloMin, 2000, rejilla, (v) => (o.w = v)),
          campoNumero('Alto', o.h, L.sueloMin, 2000, rejilla, (v) => (o.h = v)),
          campoColor('Color', o.color, (v) => (o.color = v)),
          h('p', { class: 'nota' }, 'Es decorativo: no afecta al juego.'),
        );
        break;
      case 'caja':
        filas.push(
          campoNumero('Ancho', o.w, L.cajaMin, L.cajaMax, rejilla, (v) => (o.w = v)),
          campoNumero('Alto', o.h, L.cajaMin, L.cajaMax, rejilla, (v) => (o.h = v)),
          h('p', { class: 'nota' }, 'Se agarra desde el borde y se arrastra. Pulsa botones como un jugador.'),
        );
        break;
      case 'puerta':
        filas.push(
          campoOpciones('Tipo', OPERACIONES.map((x) => x.toUpperCase()), OPERACIONES.indexOf(o.op), (i) => {
            o.op = OPERACIONES[i];
            if (o.op === 'not') o.b = null;
          }, true),
          h('p', { class: 'nota' }, NOTA_OPERACION[o.op]),
        );
        break;
      case 'switch':
        filas.push(
          campoOpciones('Valor inicial', ['Apagado', 'Encendido'], o.inicial ? 1 : 0, (i) => (o.inicial = i === 1), true),
          h('p', { class: 'nota' }, 'La primera vez que su entrada se activa cambia de valor y ya no vuelve a cambiar.'),
        );
        break;
      case 'terremoto':
        filas.push(
          campoNumero('Intensidad (px)', o.intensidad, 1, L.intensidadMax, 1, (v) => (o.intensidad = v)),
          campoNumero('Frecuencia (Hz)', o.frecuencia, 1, L.frecuenciaMax, 1, (v) => (o.frecuencia = v)),
          campoOpciones('Estado inicial', ['Apagado', 'Encendido'], o.inicial ? 1 : 0, (i) => (o.inicial = i === 1), true),
          campoOpciones('Alcance', ['Global', 'Radio de acción'], o.global ? 0 : 1, (i) => (o.global = i === 0), true),
          !o.global && campoNumero('Radio', o.radio, L.alcanceMin, L.alcanceMax, rejilla, (v) => (o.radio = v)),
          h('p', { class: 'nota' }, `Mientras está encendido, la cámara tiembla${o.global ? '' : ', con más fuerza cuanto más cerca de su centro esté el jugador y nada fuera del radio'}. Si está conectado, cambia de estado mientras su entrada esté activa.`),
        );
        break;
      case 'delay':
        filas.push(
          campoSegundos('Retardo (s)', o.tiempo, (v) => (o.tiempo = v)),
          h('p', { class: 'nota' }, 'Su salida repite lo que recibe su entrada, con el retardo indicado.'),
        );
        break;
      case 'temporizador':
        filas.push(
          campoSegundos('Activo (s)', o.activo, (v) => (o.activo = v)),
          campoSegundos('Inactivo (s)', o.inactivo, (v) => (o.inactivo = v)),
          h('p', { class: 'nota' }, 'Alterna entre inactivo y activo durante los segundos indicados. Empieza a contar cuando el jugador se mueve.'),
        );
        break;
      case 'interruptor':
        filas.push(
          campoNumero('Radio', o.r, L.radioMin, L.radioMax, 5, (v) => (o.r = v)),
          h('p', { class: 'nota' }, 'Cambia de estado cada vez que alguien lo pisa.'),
        );
        break;
      case 'movil': {
        const m = o;
        const anadir = () => {
          if (m.ruta.length >= L.puntosMax) return aviso(`Una ruta admite como máximo ${L.puntosMax + 1} puntos`);
          const ultimo = m.ruta[m.ruta.length - 1] ?? { x: 0, y: 0 };
          m.ruta.push({ x: ultimo.x + 100, y: ultimo.y });
          cambio(true);
          pintarInspector();
        };
        const quitar = () => {
          m.ruta.pop();
          cambio(true);
          pintarInspector();
        };
        const ascensor = m.por != null && m.ascensor;
        filas.push(
          campoNumero('Ancho', m.w, L.sueloMin, 2000, rejilla, (v) => (m.w = v)),
          campoNumero('Alto', m.h, L.sueloMin, 2000, rejilla, (v) => (m.h = v)),
          campoNumero('Velocidad (px/s)', m.vel, 1, L.velMovilMax, 10, (v) => (m.vel = v)),
          !ascensor && campoOpciones('Recorrido', ['Ida y vuelta', 'Bucle', 'Una vez'], MODOS_MOVIL.indexOf(m.modo), (i) => (m.modo = MODOS_MOVIL[i]), true),
          campoOpciones('Estado inicial', ['Desactivada', 'Activada'], m.inicial ? 1 : 0, (i) => (m.inicial = i === 1), true),
          m.por != null && campoOpciones('Con señal', ['Mientras esté activa', 'Ascensor'], m.ascensor ? 1 : 0, (i) => (m.ascensor = i === 1), true),
          !ascensor && campoOpciones('Al desactivarse', ['Se para', 'Vuelve atrás'], m.atras ? 1 : 0, (i) => (m.atras = i === 1), true),
          !ascensor && m.atras && campoNumero('Vel. atrás (px/s)', m.velAtras, 1, L.velMovilMax, 10, (v) => (m.velAtras = v)),
          h('p', { class: 'nota' }, `Ruta de ${m.ruta.length + 1} puntos. Arrastra los puntos numerados para cambiarla y toca un «+» para insertar uno en medio.`),
          h('div', { class: 'fila' },
            h('button', { class: 'btn', onclick: anadir }, icono('mas'), 'Añadir punto'),
            m.ruta.length ? h('button', { class: 'btn', onclick: quitar }, 'Quitar último') : false,
          ),
          h('p', { class: 'nota' }, ascensor
            ? 'Con la señal activa avanza hasta el último punto; sin ella vuelve al primero.'
            : 'Invisible en la partida. Lleva consigo todo lo que toca su rectángulo, y a los jugadores y cajas que estén dentro.'),
        );
        break;
      }
      case 'pinchos':
        filas.push(
          campoNumero('Ancho', o.w, L.sueloMin, 2000, rejilla, (v) => (o.w = v)),
          campoNumero('Alto', o.h, L.sueloMin, 2000, rejilla, (v) => (o.h = v)),
          campoOpciones('Estado inicial', ['Apagados', 'Encendidos'], o.inicial ? 1 : 0, (i) => (o.inicial = i === 1), true),
          h('p', { class: 'nota' }, 'Cuenta como suelo. Encendidos matan a quien los pise. Si están conectados, cambian de estado mientras su entrada esté activa.'),
        );
        break;
      case 'cartel': {
        const entrada = h('input', { type: 'text', value: o.texto, maxLength: L.cartel });
        entrada.addEventListener('input', () => {
          o.texto = entrada.value;
          cambio(true);
        });
        filas.push(
          campoNumero('Ancho', o.w, L.sueloMin, 2000, rejilla, (v) => (o.w = v)),
          campoNumero('Alto', o.h, L.sueloMin, 2000, rejilla, (v) => (o.h = v)),
          h('label', { class: 'campo' }, 'Mensaje', entrada),
          campoOpciones('Lo ve', ['Solo quien entra', 'Todos'], o.todos ? 1 : 0, (i) => (o.todos = i === 1), true),
          h('p', { class: 'nota' }, o.todos
            ? 'Cuando cualquier jugador entra en su área, todos ven un bocadillo con este mensaje.'
            : 'Cuando un jugador entra en su área, solo él ve un bocadillo con este mensaje.'),
        );
        break;
      }
      case 'control':
        filas.push(
          campoNumero('Ancho', o.w, L.sueloMin, 2000, rejilla, (v) => (o.w = v)),
          campoNumero('Alto', o.h, L.sueloMin, 2000, rejilla, (v) => (o.h = v)),
          h('p', { class: 'nota' }, 'Cuando un jugador lo pisa, pasa a ser el punto de reaparición de todos los que caigan al vacío.'),
        );
        break;
      case 'meta':
        filas.push(
          campoNumero('Ancho', o.w, L.metaMin, L.metaMax, rejilla, (v) => (o.w = v)),
          campoNumero('Alto', o.h, L.metaMin, L.metaMax, rejilla, (v) => (o.h = v)),
          h('p', { class: 'nota' }, 'El nivel se completa cuando todos los jugadores han entrado en una meta.'),
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

    if ('invisible' in o) {
      filas.push(campoOpciones('En la partida', ['Visible', 'Invisible'], o.invisible ? 1 : 0, (i) => (o.invisible = i === 1), true));
    }

    const entradas = ranuras(o);
    for (const r of entradas) {
      const a = obj(ref(o, r));
      const etiqueta = entradas.length > 1 ? NOMBRE_RANURA[r] : 'Entrada';
      filas.push(
        h('p', { class: 'nota enlace' }, `${etiqueta}: ${a ? nombreDe(a) : 'sin conectar'}`),
        h('div', { class: 'fila' },
          h('button', { class: 'btn', onclick: () => empezarConexion(o.id, r) }, icono('conexiones'), a ? 'Cambiar' : 'Conectar'),
          a ? h('button', { class: 'btn', onclick: () => { fijarRef(o, r, null); cambio(true); pintarInspector(); } }, 'Desconectar') : false,
        ),
      );
    }
    if (esActivador(o)) {
      const n = nivel.objetos.reduce((t, x) => t + ranuras(x).filter((r) => ref(x, r) === o.id).length, 0);
      filas.push(
        h('p', { class: 'nota enlace' }, `Salida: ${n ? `controla ${n} ${n === 1 ? 'entrada' : 'entradas'}` : 'sin conectar'}`),
        h('button', { class: 'btn', onclick: () => empezarConexion(o.id, null) }, icono('conexiones'), 'Conectar con…'),
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

  function empezarConexion(id: number, ranura: Ranura | null) {
    conectando = { id, ranura };
    herramienta = null;
    mapa = false;
    pintarPaleta();
    pintarInspector();
  }

  function conectarCon(destino: Objeto | null, ranuraDestino: Ranura | null = null) {
    const c = conectando;
    const origen = obj(c?.id ?? null);
    conectando = null;
    pintarInspector();
    if (!c || !origen || !destino || origen === destino) return;
    if (c.ranura) {
      if (!esActivador(destino)) return aviso('La señal tiene que salir de un botón, interruptor, puerta lógica, switch, temporizador o delay');
      fijarRef(origen, c.ranura, destino.id);
    } else {
      const libres = ranuras(destino);
      if (!libres.length) return aviso('La señal solo puede ir a una pared, unos pinchos, una puerta lógica, un switch, un delay, un terremoto o una plataforma móvil');
      fijarRef(destino, ranuraDestino ?? libres.find((r) => ref(destino, r) == null) ?? libres[0], origen.id);
    }
    cambio(true);
    pintarInspector();
  }

  function pinEn(x: number, y: number): { o: Objeto; ranura: Ranura | null } | null {
    const alcance = Math.max(9, 12 / vista.escala);
    const cerca = (p: { x: number; y: number }) => Math.hypot(p.x - x, p.y - y) < alcance;
    for (let i = nivel.objetos.length - 1; i >= 0; i--) {
      const o = nivel.objetos[i];
      if (o.t !== 'puerta' && o.t !== 'switch' && o.t !== 'temporizador' && o.t !== 'delay' && o.t !== 'terremoto') continue;
      if (o.t !== 'terremoto' && cerca(pinSalida(o))) return { o, ranura: null };
      for (const r of ranuras(o)) if (cerca(pinEntrada(o, r))) return { o, ranura: r };
    }
    return null;
  }

  function eliminar() {
    const o = obj(sel);
    if (!o) return;
    nivel.objetos = nivel.objetos.filter((x) => x !== o);
    for (const x of nivel.objetos) for (const r of ranuras(x)) if (ref(x, r) === o.id) fijarRef(x, r, null);
    sel = null;
    cambio(true);
    pintarInspector();
  }

  function duplicar() {
    const originales = (grupo.length ? grupo : typeof sel === 'number' ? [sel] : []).map(obj).filter((o): o is Objeto => !!o);
    if (!originales.length) return;
    if (nivel.objetos.length + originales.length > LIMITES.objetos) return void aviso(`Un nivel admite como máximo ${LIMITES.objetos} objetos`);
    let id = siguienteId(nivel);
    const nuevos = new Map(originales.map((o) => [o.id, id++]));
    const copias = originales.map((o) => {
      const copia = { ...JSON.parse(JSON.stringify(o)), id: nuevos.get(o.id)!, x: o.x + 25, y: o.y + 25 } as Objeto;
      for (const r of ranuras(copia)) {
        const v = ref(copia, r);
        if (v != null && nuevos.has(v)) fijarRef(copia, r, nuevos.get(v)!);
      }
      return copia;
    });
    nivel.objetos.push(...copias);
    grupo = copias.map((c) => c.id);
    sel = null;
    normalizarGrupo();
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
      case 'suelo':
      case 'caja':
      case 'control':
      case 'cartel':
      case 'pinchos':
      case 'movil':
        return { x: o.x, y: o.y, w: o.w, h: o.h };
      case 'boton':
      case 'botontodos':
      case 'interruptor':
        return { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 };
      case 'puerta':
      case 'switch':
      case 'temporizador':
      case 'delay':
      case 'terremoto':
        return { x: o.x - TAM_LOGICA / 2, y: o.y - TAM_LOGICA / 2, w: TAM_LOGICA, h: TAM_LOGICA };
      case 'texto':
        return { x: o.x - 3, y: o.y - 3, w: anchoTexto(o.texto) + 6, h: 22 };
    }
  }

  function toca(o: Objeto, x: number, y: number): 0 | 1 | 2 {
    const m = Math.min(12, 6 / vista.escala);
    if (o.t === 'boton' || o.t === 'botontodos' || o.t === 'interruptor') return Math.hypot(x - o.x, y - o.y) < o.r + m ? 1 : 0;
    const c = caja(o);
    if (o.t === 'movil') {
      const b = Math.min(BORDE_MOVIL, c.w / 2, c.h / 2);
      const fuera = x > c.x - m && x < c.x + c.w + m && y > c.y - m && y < c.y + c.h + m;
      const dentro = x > c.x + b && x < c.x + c.w - b && y > c.y + b && y < c.y + c.h - b;
      return fuera && !dentro ? 1 : 0;
    }
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
    if ('w' in o) {
      const [min, max] = limitesRect(o.t);
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
      if (o.t === 'movil') lista.push(...asasRuta(o));
      return lista;
    }
    if (o.t === 'boton' || o.t === 'botontodos' || o.t === 'interruptor') {
      return [{
        x: o.x + o.r,
        y: o.y,
        mover: (p: typeof o, x, y) => (p.r = limitar(Math.round(Math.hypot(x - p.x, y - p.y) / 5) * 5, LIMITES.radioMin, LIMITES.radioMax)),
      }];
    }
    return [];
  }

  function asasRuta(o: MovilDef): Asa[] {
    return o.ruta.map((p, i) => ({
      x: o.x + o.w / 2 + p.x,
      y: o.y + o.h / 2 + p.y,
      mover(m: MovilDef, x: number, y: number) {
        m.ruta[i] = {
          x: Math.round((x - m.x - m.w / 2) / rejilla) * rejilla,
          y: Math.round((y - m.y - m.h / 2) / rejilla) * rejilla,
        };
      },
    }));
  }

  function huecosRuta(o: MovilDef): { i: number; x: number; y: number }[] {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const puntos = [{ x: 0, y: 0 }, ...o.ruta];
    if (o.modo === 'bucle' && !(o.por != null && o.ascensor) && o.ruta.length) puntos.push({ x: 0, y: 0 });
    const res: { i: number; x: number; y: number }[] = [];
    for (let k = 1; k < puntos.length; k++) {
      res.push({ i: k - 1, x: cx + (puntos[k - 1].x + puntos[k].x) / 2, y: cy + (puntos[k - 1].y + puntos[k].y) / 2 });
    }
    return res;
  }

  function insertarPunto(o: MovilDef, x: number, y: number): number | null {
    const alcance = 12 / vista.escala;
    const hueco = huecosRuta(o).find((q) => Math.hypot(q.x - x, q.y - y) < alcance);
    if (!hueco) return null;
    if (o.ruta.length >= LIMITES.puntosMax) {
      aviso(`Una ruta admite como máximo ${LIMITES.puntosMax + 1} puntos`);
      return null;
    }
    o.ruta.splice(hueco.i, 0, {
      x: Math.round((hueco.x - o.x - o.w / 2) / rejilla) * rejilla,
      y: Math.round((hueco.y - o.y - o.h / 2) / rejilla) * rejilla,
    });
    return hueco.i;
  }

  function dibujarRuta(ctx: CanvasRenderingContext2D, o: MovilDef, px: number) {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const puntos = [{ x: 0, y: 0 }, ...o.ruta];
    if (o.modo === 'bucle' && !(o.por != null && o.ascensor) && o.ruta.length) puntos.push({ x: 0, y: 0 });
    ctx.strokeStyle = C.azul;
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    puntos.forEach((p, i) => (i ? ctx.lineTo(cx + p.x, cy + p.y) : ctx.moveTo(cx + p.x, cy + p.y)));
    ctx.stroke();
    ctx.lineWidth = 1 * px;
    ctx.setLineDash([4 * px, 4 * px]);
    for (const p of o.ruta) ctx.strokeRect(o.x + p.x, o.y + p.y, o.w, o.h);
    ctx.setLineDash([]);
    ctx.font = `700 ${12 * px}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [{ x: 0, y: 0 }, ...o.ruta].forEach((p, i) => {
      ctx.fillStyle = C.azul;
      ctx.beginPath();
      ctx.arc(cx + p.x, cy + p.y, 10 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.blanco;
      ctx.fillText(String(i + 1), cx + p.x, cy + p.y + px);
    });
    for (const q of huecosRuta(o)) {
      ctx.fillStyle = C.blanco;
      ctx.strokeStyle = C.azul;
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 7 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(q.x - 3.5 * px, q.y);
      ctx.lineTo(q.x + 3.5 * px, q.y);
      ctx.moveTo(q.x, q.y - 3.5 * px);
      ctx.lineTo(q.x, q.y + 3.5 * px);
      ctx.stroke();
    }
    ctx.strokeStyle = C.verde;
    ctx.lineWidth = 2 * px;
    ctx.setLineDash([3 * px, 3 * px]);
    for (const m of miembrosMoviles(nivel).get(o.id) ?? []) for (const z of zonasObjeto(m)) ctx.strokeRect(z.x - 2, z.y - 2, z.w + 4, z.h + 4);
    ctx.setLineDash([]);
    ctx.strokeStyle = C.azul;
    ctx.lineWidth = 1.5 * px;
  }

  function asasInicio(): Asa[] {
    const r = nivel.inicio;
    const min = LIMITES.inicioMin;
    const lista: Asa[] = [];
    for (const ky of [0, 0.5, 1]) {
      for (const kx of [0, 0.5, 1]) {
        if (kx === 0.5 && ky === 0.5) continue;
        lista.push({
          x: r.x + r.w * kx,
          y: r.y + r.h * ky,
          mover(p: typeof r, x, y) {
            const der = p.x + p.w;
            const inf = p.y + p.h;
            if (kx === 0) (p.w = limitar(der - x, min, 2000)), (p.x = der - p.w);
            if (kx === 1) p.w = limitar(x - p.x, min, 2000);
            if (ky === 0) (p.h = limitar(inf - y, min, 2000)), (p.y = inf - p.h);
            if (ky === 1) p.h = limitar(y - p.y, min, 2000);
          },
        });
      }
    }
    return lista;
  }

  function alPulsar(e: PointerEvent) {
    if (e.button === 2 || (mapa && e.button === 0)) {
      canvas.setPointerCapture(e.pointerId);
      pan = { id: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button > 0) return;
    canvas.setPointerCapture(e.pointerId);
    const p = vista.aMundo(e.clientX, e.clientY);
    puntero = p;
    movido = false;

    if (conectando) {
      const pin = pinEn(p.x, p.y);
      conectarCon(pin?.o ?? objetoEn(p.x, p.y)?.o ?? null, pin?.ranura ?? null);
      return;
    }

    if (herramienta) {
      if (!hayHueco()) return;
      const t = herramienta;
      const x = limitar(ajustar(p.x), -LIMITES.coord, LIMITES.coord);
      const y = limitar(ajustar(p.y), -LIMITES.coord, LIMITES.coord);
      const o = crear(t, siguienteId(nivel), x, y);
      nivel.objetos.push(o);
      sel = o.id;
      grupo = [];
      herramienta = null;
      if ('w' in o) arrastre = { tipo: 'crear', id: o.id, ox: x, oy: y };
      else {
        arrastre = { tipo: 'mover', id: o.id, dx: p.x - o.x, dy: p.y - o.y, extremo: 1 };
      }
      movido = true;
      cambio(false);
      pintarPaleta();
      pintarInspector();
      return;
    }

    const pin = pinEn(p.x, p.y);
    if (pin) {
      sel = pin.o.id;
      grupo = [];
      empezarConexion(pin.o.id, pin.ranura);
      return;
    }

    const actual = obj(sel);
    if (actual?.t === 'movil') {
      const i = insertarPunto(actual, p.x, p.y);
      if (i != null) {
        arrastre = { tipo: 'asa', id: actual.id, i: asas(actual).length - actual.ruta.length + i };
        movido = true;
        cambio(false);
        pintarInspector();
        return;
      }
    }
    if (actual || sel === 'inicio') {
      const alcance = 14 / vista.escala;
      const i = (actual ? asas(actual) : asasInicio()).findIndex((a) => Math.hypot(a.x - p.x, a.y - p.y) < alcance);
      if (i >= 0) {
        arrastre = { tipo: 'asa', id: actual ? actual.id : 'inicio', i };
        return;
      }
    }
    const tocado = objetoEn(p.x, p.y);
    if (e.ctrlKey || e.metaKey) {
      if (tocado) alternarGrupo(tocado.o.id);
      pintarInspector();
      return;
    }
    if (tocado && grupo.includes(tocado.o.id)) {
      const orig = new Map<number, number[]>();
      for (const id of grupo) {
        const o = obj(id);
        if (o) orig.set(id, [o.x, o.y]);
      }
      arrastre = { tipo: 'grupo', x: p.x, y: p.y, orig };
      return;
    }
    grupo = [];
    const ini = nivel.inicio;
    const enInicio = p.x > ini.x && p.x < ini.x + ini.w && p.y > ini.y && p.y < ini.y + ini.h;
    if (enInicio && (!tocado || tocado.o.t === 'suelo' || tocado.o.t === 'control')) {
      sel = 'inicio';
      arrastre = { tipo: 'mover', id: 'inicio', dx: p.x - nivel.inicio.x, dy: p.y - nivel.inicio.y, extremo: 1 };
    } else if (tocado) {
      const o = tocado.o;
      sel = o.id;
      arrastre = { tipo: 'mover', id: o.id, dx: p.x - o.x, dy: p.y - o.y, extremo: 0 };
    } else {
      sel = null;
      pan = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
    pintarInspector();
  }

  function desplazar(dx: number, dy: number) {
    vista.cx = limitar(vista.cx + dx, -LIMITES.coord, LIMITES.coord - ANCHO);
    vista.cy = limitar(vista.cy + dy, -LIMITES.coord, LIMITES.coord - ALTO);
  }

  function alRueda(e: WheelEvent) {
    e.preventDefault();
    const k = (e.deltaMode === 1 ? 16 : 1) / vista.escala;
    if (e.shiftKey && !e.deltaX) desplazar(e.deltaY * k, 0);
    else desplazar(e.deltaX * k, e.deltaY * k);
  }

  function alMover(e: PointerEvent) {
    if (pan && e.pointerId === pan.id) {
      desplazar(-(e.clientX - pan.x) / vista.escala, -(e.clientY - pan.y) / vista.escala);
      pan.x = e.clientX;
      pan.y = e.clientY;
    }
    const p = vista.aMundo(e.clientX, e.clientY);
    puntero = p;
    if (!arrastre) return;
    const a = arrastre;
    if (a.tipo === 'mover') {
      const x = limitar(ajustar(p.x - a.dx), -LIMITES.coord, LIMITES.coord);
      const y = limitar(ajustar(p.y - a.dy), -LIMITES.coord, LIMITES.coord);
      if (a.id === 'inicio') {
        (nivel.inicio.x = x), (nivel.inicio.y = y);
      } else {
        const o = obj(a.id);
        if (!o) return;
        (o.x = x), (o.y = y);
      }
    } else if (a.tipo === 'grupo') {
      const dx = ajustar(p.x - a.x);
      const dy = ajustar(p.y - a.y);
      const L = LIMITES.coord;
      for (const [id, v] of a.orig) {
        const o = obj(id);
        if (!o) continue;
        (o.x = limitar(v[0] + dx, -L, L)), (o.y = limitar(v[1] + dy, -L, L));
      }
    } else if (a.tipo === 'asa' && a.id === 'inicio') {
      asasInicio()[a.i]?.mover(nivel.inicio, ajustar(p.x), ajustar(p.y));
    } else if (a.tipo === 'asa') {
      const o = obj(a.id);
      if (!o) return;
      asas(o)[a.i]?.mover(o, ajustar(p.x), ajustar(p.y));
    } else {
      const o = obj(a.id) as any;
      if (!o) return;
      const x = ajustar(p.x);
      const y = ajustar(p.y);
      const [min, max] = limitesRect(o.t);
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
    pan = null;
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
  canvas.addEventListener('wheel', alRueda, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function dibujar(ahora: number) {
    if (!vivo) return;
    requestAnimationFrame(dibujar);
    if (cerrarPrueba) return;
    const ctx = vista.ctx;
    const px = 1 / vista.escala;
    vista.preparar();

    if (rejilla >= 25) {
      ctx.fillStyle = '#d8d8d8';
      const v = vista.visible();
      const gx = Math.ceil(v.x / rejilla) * rejilla;
      const gy = Math.ceil(v.y / rejilla) * rejilla;
      for (let x = gx; x <= v.x + v.w; x += rejilla) for (let y = gy; y <= v.y + v.h; y += rejilla) ctx.fillRect(x - px, y - px, 2 * px, 2 * px);
    }
    dibujarNivel(ctx, sim, { conexiones: true, tiempo: ahora, editor: true });

    ctx.strokeStyle = C.azul;
    ctx.lineWidth = 1.5 * px;
    if (sel === 'inicio') {
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.strokeRect(nivel.inicio.x - 3, nivel.inicio.y - 3, nivel.inicio.w + 6, nivel.inicio.h + 6);
      ctx.setLineDash([]);
      const t = 5 * px;
      for (const a of asasInicio()) {
        ctx.fillStyle = C.blanco;
        ctx.fillRect(a.x - t, a.y - t, t * 2, t * 2);
        ctx.strokeRect(a.x - t, a.y - t, t * 2, t * 2);
      }
    }
    const o = obj(sel);
    if (o) {
      if (o.t === 'terremoto' && !o.global) {
        ctx.setLineDash([8 * px, 6 * px]);
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radio, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
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
      if (o.t === 'movil') dibujarRuta(ctx, o, px);
    }

    for (const id of grupo) {
      const g = obj(id);
      if (!g) continue;
      const c = caja(g);
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.strokeRect(c.x - 3, c.y - 3, c.w + 6, c.h + 6);
      ctx.setLineDash([]);
    }

    const origen = obj(conectando?.id ?? null);
    if (origen && conectando) {
      const c = conectando.ranura ? pinEntrada(origen, conectando.ranura) : pinSalida(origen);
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(puntero.x, puntero.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    vista.terminar();

    let t = 'Toca un objeto para seleccionarlo y arrástralo para moverlo';
    if (mapa) t = 'Arrastra para mover el mapa';
    else if (conectando) t = conectando.ranura ? 'Toca el botón, interruptor, puerta lógica, switch, temporizador o delay que da la señal' : 'Toca la pared, los pinchos, la puerta lógica, el switch, el delay, el terremoto o la plataforma móvil que recibe la señal';
    else if (herramienta && 'w' in crear(herramienta, 0, 0, 0)) t = `${NOMBRES_TIPO[herramienta]}: arrastra sobre el nivel para dibujar`;
    else if (herramienta) t = `${NOMBRES_TIPO[herramienta]}: toca el nivel para colocarlo`;
    else if (!nivel.objetos.length) t = 'Elige un objeto de la izquierda y colócalo en el nivel';
    else if (grupo.length) t = 'Arrastra para mover la selección · Ctrl+D para duplicarla';
    else if (o) t = 'Arrastra los cuadrados para cambiar el tamaño · edita sus propiedades en el panel';
    if (pista.textContent !== t) pista.textContent = t;

    if (o || sel === 'inicio') {
      const x = o ? caja(o).x + caja(o).w / 2 : nivel.inicio.x + nivel.inicio.w / 2;
      inspector.classList.toggle('izq', x - vista.cx > ANCHO * 0.6);
    }
  }
  requestAnimationFrame(dibujar);

  function abrirDatos(alTerminar?: () => void) {
    const nombre = h('input', { type: 'text', value: nivel.nombre, maxLength: LIMITES.nombre, placeholder: 'Nombre del nivel' });
    const autor = h('input', { type: 'text', value: nivel.autor, maxLength: LIMITES.autor, placeholder: 'Tu nombre' });
    const aceptar = () => {
      nivel.nombre = nombre.value.trim();
      nivel.autor = autor.value.trim();
      cambio(true);
      pintarBarra();
      m.cerrar();
      alTerminar?.();
    };
    const m = modal('Datos del nivel',
      h('label', { class: 'campo' }, 'Nombre', nombre),
      h('label', { class: 'campo' }, 'Autor', autor),
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
      grupo = [];
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
    compartirNivel(codificar(nivel), nivel.nombre, `«${nivel.nombre}», por ${nivel.autor}. `);
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
    } else if (conectando || herramienta || mapa) {
      conectando = null;
      herramienta = null;
      mapa = false;
      pintarPaleta();
      pintarInspector();
    } else if (sel != null || grupo.length) {
      sel = null;
      grupo = [];
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
    if (grupo.length) {
      for (const g of grupo.map(obj)) {
        if (!g) continue;
        (g.x += d[0] * paso), (g.y += d[1] * paso);
      }
    } else if (sel === 'inicio') (nivel.inicio.x += d[0] * paso), (nivel.inicio.y += d[1] * paso);
    else if (o) {
      (o.x += d[0] * paso), (o.y += d[1] * paso);
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
