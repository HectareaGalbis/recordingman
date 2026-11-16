import { actualizarMusica, sonar } from '../audio';
import { ES_WEB, URL_COMPARTIR } from '../config';
import { PARAMETRO } from '../core/codec';
import { ALTO, ANCHO, Nivel, TAM_LOGICA } from '../core/level';
import { Entrada, Sim, TICKS_POR_SEGUNDO } from '../core/sim';
import { TACTIL, fijarAgarre, leerEntrada, limpiarEntrada, montarPalanca, pedirReiniciar, tecla } from '../input';
import { PUEDE_COMPARTIR, compartir, copiar, huecosAnuncioFin } from '../platform';
import { Emisor, urlDeEnvio } from '../red';
import type { Sesion } from '../red';
import { Vista } from '../render';
import { ajustes, guardarAjustes } from '../store';
import { aviso, botonIcono, h, icono, modal } from './dom';

export interface OpcionesJuego {
  nivel: Nivel;
  codigo?: string;
  etiqueta?: string;
  alSalir?: () => void;
  alCompletar?: () => void;
  accionesFin?: () => HTMLElement[];
  sesion?: Sesion;
}

const SUAVIZADO = 220;

let pantallaPedida = false;
const PUEDE_PANTALLA = ES_WEB && typeof document.documentElement.requestFullscreen === 'function';

function pedirPantallaCompleta(): Promise<unknown> {
  return document.documentElement.requestFullscreen().then(() => (screen.orientation as any)?.lock?.('landscape'));
}

export function extension(n: Nivel) {
  let x0 = n.inicio.x;
  let y0 = n.inicio.y;
  let x1 = x0 + n.inicio.w;
  let y1 = y0 + n.inicio.h;
  const caja = (x: number, y: number, w: number, h: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  };
  for (const o of n.objetos) {
    if ('w' in o) caja(o.x, o.y, o.w, o.h);
    else if (o.t === 'texto') caja(o.x, o.y, 0, 0);
    else if (o.t === 'puerta' || o.t === 'switch' || o.t === 'temporizador' || o.t === 'delay' || o.t === 'terremoto') caja(o.x - TAM_LOGICA / 2, o.y - TAM_LOGICA / 2, TAM_LOGICA, TAM_LOGICA);
    else caja(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
  }
  return { x0, y0, x1, y1 };
}

export function urlDeCodigo(codigo: string): string {
  return `${URL_COMPARTIR.replace(/\/+$/, '')}/?${PARAMETRO}=${codigo}`;
}

export function compartirNivel(codigo: string, nombre: string, detalle = '') {
  const titulo = nombre || 'Nivel de RecordingMan';
  const url = urlDeCodigo(codigo);
  const campo = h('input', { type: 'text', readOnly: true, value: url, onfocus: () => campo.select() });
  const nota = h('p', { class: 'nota' }, `${detalle}Todo el nivel viaja dentro del enlace (${url.length} caracteres). Funciona aunque no estés conectado.`);
  const qr = h('div', { class: 'compartir-qr', hidden: true });
  const sinQR = h('p', { class: 'nota', hidden: true });
  const bCopiar = h('button', { class: 'btn', onclick: () => void copiar(url).then((ok) => aviso(ok ? 'Enlace copiado' : 'No se pudo copiar')) }, 'Copiar enlace');
  const bCodigo = h('button', { class: 'btn', onclick: () => void copiar(codigo).then((ok) => aviso(ok ? 'Código del nivel copiado' : 'No se pudo copiar')) }, 'Copiar código del nivel');
  const bCompartir = PUEDE_COMPARTIR ? h('button', { class: 'btn primario', onclick: () => void compartir(url, titulo) }, icono('compartir'), 'Compartir') : null;

  if (__OBJETIVO__ !== 'web') {
    void import('../qr').then(({ svgQR }) => {
      try {
        qr.innerHTML = svgQR(url);
        qr.hidden = false;
      } catch (e) {
        qr.hidden = true;
        sinQR.textContent = `No se puede generar el código QR: ${(e as Error).message}.`;
        sinQR.hidden = false;
      }
    });
  }

  modal('Compartir nivel',
    nota,
    campo,
    qr,
    sinQR,
    h('div', { class: 'fila fin' }, bCodigo, bCopiar, bCompartir),
  );
}

export function montarJuego(raiz: HTMLElement, op: OpcionesJuego): () => void {
  const sim = new Sim(op.nivel, op.sesion?.jugadores ?? 1, op.sesion?.local ?? 0, op.sesion?.semilla ?? 0);
  const canvas = h('canvas', { class: 'lienzo' });
  const pista = h('div', { class: 'pista' });
  const fin = h('div', { class: 'fin-nivel sin-palanca', hidden: true });

  const alternar = (b: HTMLButtonElement, clave: 'musica' | 'efectos') => {
    ajustes[clave] = !ajustes[clave];
    guardarAjustes();
    b.classList.toggle('apagado', !ajustes[clave]);
    actualizarMusica();
  };
  const opcion = (nombre: string, texto: string, accion: () => void, clase = '') =>
    h('button', { class: `opcion ${clase}`, role: 'menuitem', onclick: accion }, icono(nombre), h('span', {}, texto));
  const menu = h('div', { class: 'menu-juego', role: 'menu', hidden: true });
  let abierto = false;
  const abrirMenu = (abrir: boolean) => {
    abierto = abrir;
    menu.hidden = !abrir;
    bOpciones.classList.toggle('activo', abrir);
  };
  const bOpciones = botonIcono('engranaje', 'Opciones', () => abrirMenu(!abierto));

  const puedeReiniciar = !op.sesion || op.sesion.local === 0;
  if (puedeReiniciar) menu.append(opcion('reiniciar', 'Reiniciar nivel', () => {
    abrirMenu(false);
    pedirReiniciar();
  }));
  const bSonido = opcion('sonido', 'Efectos de sonido', () => alternar(bSonido, 'efectos'), ajustes.efectos ? '' : 'apagado');
  const bMusica = opcion('musica', 'Música', () => alternar(bMusica, 'musica'), ajustes.musica ? '' : 'apagado');
  menu.append(bSonido, bMusica);
  if (PUEDE_PANTALLA) {
    menu.append(opcion('pantalla', 'Pantalla completa', () => {
      abrirMenu(false);
      if (document.fullscreenElement) void document.exitFullscreen();
      else void pedirPantallaCompleta().catch(() => undefined);
    }));
  }
  const fueraDelMenu = (e: PointerEvent) => {
    if (abierto && !menu.contains(e.target as Node) && !bOpciones.contains(e.target as Node)) abrirMenu(false);
  };
  window.addEventListener('pointerdown', fueraDelMenu, true);

  const bAgarrar = h('button', { class: 'contexto sin-palanca', hidden: true }, 'Agarrar', !TACTIL && h('kbd', {}, 'Espacio'));
  bAgarrar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    bAgarrar.setPointerCapture(e.pointerId);
    fijarAgarre(true);
  });
  bAgarrar.addEventListener('pointerup', () => fijarAgarre(false));
  bAgarrar.addEventListener('pointercancel', () => fijarAgarre(false));

  const escenario = h('div', { class: 'escenario' }, canvas, pista, fin, bAgarrar);

  const el = h('div', { class: 'juego' },
    h('header', { class: 'barra' },
      op.alSalir && botonIcono('atras', 'Volver (Esc)', () => op.alSalir!()),
      h('div', { class: 'acciones' }, bOpciones, menu),
    ),
    escenario,
  );
  raiz.appendChild(el);
  document.body.classList.add('en-partida');

  const vista = new Vista(canvas);
  vista.completa = true;
  if (op.nivel.fondo) vista.fondo = op.nivel.fondo;
  const quitarPalanca = TACTIL ? montarPalanca(escenario) : null;
  limpiarEntrada();

  const previas = new Map<object, { x: number; y: number }>();
  const paso = 1000 / TICKS_POR_SEGUNDO;
  let acumulado = 0;
  let ultimo = performance.now();
  let vivo = true;
  let finMostrado = false;
  let pistaActual = '';

  const ext = extension(op.nivel);
  let libre = false;
  let arrastre: { id: number; x: number; y: number } | null = null;

  const seguir = (k: number) => {
    const j = sim.jugador;
    let { x, y } = j;
    const p = previas.get(j);
    if (p && Math.abs(p.x - x) <= 10 && Math.abs(p.y - y) <= 10) {
      const a = acumulado / paso;
      x = p.x + (x - p.x) * a;
      y = p.y + (y - p.y) * a;
    }
    vista.cx += (x - ANCHO / 2 - vista.cx) * k;
    vista.cy += (y - ALTO / 2 - vista.cy) * k;
  };
  seguir(1);

  const alPulsar = (e: PointerEvent) => {
    if (arrastre || sim.empezado || finMostrado) return;
    if (TACTIL && e.pointerType !== 'mouse') {
      const r = escenario.getBoundingClientRect();
      if (e.clientX - r.left <= r.width * 0.6) return;
    }
    arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  };
  const alMover = (e: PointerEvent) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    if (sim.empezado) return void (arrastre = null);
    const cx = vista.cx - (e.clientX - arrastre.x) / vista.escala;
    const cy = vista.cy - (e.clientY - arrastre.y) / vista.escala;
    vista.cx = Math.min(ext.x1 - ANCHO / 2, Math.max(ext.x0 - ANCHO / 2, cx));
    vista.cy = Math.min(ext.y1 - ALTO / 2, Math.max(ext.y0 - ALTO / 2, cy));
    arrastre.x = e.clientX;
    arrastre.y = e.clientY;
    libre = true;
  };
  const alSoltar = (e: PointerEvent) => {
    if (arrastre && e.pointerId === arrastre.id) arrastre = null;
  };
  canvas.addEventListener('pointerdown', alPulsar);
  canvas.addEventListener('pointermove', alMover);
  canvas.addEventListener('pointerup', alSoltar);
  canvas.addEventListener('pointercancel', alSoltar);

  const mostrarFin = () => {
    finMostrado = true;
    const seg = (sim.ticks / TICKS_POR_SEGUNDO).toFixed(1);
    const anuncios = huecosAnuncioFin();
    fin.replaceChildren(
      h('div', { class: 'fin-contenido' },
        anuncios.izq,
        h('div', { class: 'fin-caja' },
          h('h2', {}, 'Nivel superado'),
          h('p', {}, `${seg} s`),
          h('div', { class: 'fila centro' },
            puedeReiniciar && h('button', { class: 'btn', onclick: repetir }, 'Repetir'),
            ...(op.accionesFin?.() ?? []),
          ),
        ),
        anuncios.der,
      ),
    );
    fin.hidden = false;
    anuncios.rellenar();
    op.alCompletar?.();
  };

  const repetir = () => {
    if (op.sesion) return pedirReiniciar();
    fin.hidden = true;
    finMostrado = false;
    sim.reiniciar();
    limpiarEntrada();
  };

  const ponerPista = () => {
    const t = '';
    if (t !== pistaActual) {
      pistaActual = t;
      pista.textContent = t;
      pista.classList.toggle('visible', !!t);
    }
  };

  const cuadro = (ahora: number) => {
    if (!vivo) return;
    const dt = Math.min(ahora - ultimo, 100);
    acumulado = Math.min(acumulado + (ahora - ultimo), paso * 5);
    ultimo = ahora;
    while (acumulado >= paso) {
      acumulado -= paso;
      let primero = true;
      const tick = (es: Entrada[]) => {
        if (primero) {
          primero = false;
          previas.clear();
          for (const m of [...sim.monos(), ...sim.cajas]) previas.set(m, { x: m.x, y: m.y });
        }
        sim.tick(es);
        for (const ev of sim.eventos) {
          sonar(ev);
          if (ev === 'completado') setTimeout(() => vivo && sim.completado && !finMostrado && mostrarFin(), 1000);
          if (ev === 'reiniciar' && finMostrado) {
            fin.hidden = true;
            finMostrado = false;
          }
        }
      };
      const e = leerEntrada();
      if (sim.completado) {
        e.dx = 0;
        e.dy = 0;
        if (!op.sesion) e.reiniciar = false;
      }
      if (op.sesion) op.sesion.paso(e, tick, (i) => sim.quitar(i));
      else tick([e]);
    }
    ponerPista();
    const agarrable = !finMostrado && sim.puedeAgarrar();
    if (bAgarrar.hidden === agarrable) {
      bAgarrar.hidden = !agarrable;
      if (!agarrable) fijarAgarre(false);
    }
    bAgarrar.classList.toggle('activo', !!sim.cajaAgarrada());
    if (sim.empezado) libre = false;
    if (!libre) seguir(1 - Math.exp(-dt / SUAVIZADO));
    const temblor = sim.temblor(ahora);
    vista.cx += temblor.x;
    vista.cy += temblor.y;
    vista.dibujar(sim, {
      conexiones: tecla('Tab') || !sim.empezado,
      alfa: acumulado / paso,
      previas,
      tiempo: ahora,
      colores: op.sesion?.colores,
    });
    vista.cx -= temblor.x;
    vista.cy -= temblor.y;
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);

  const teclado = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && abierto) return abrirMenu(false);
    if (e.key === 'Escape' && op.alSalir) op.alSalir();
    if (e.key === 'Enter' && finMostrado) ((fin.querySelector('.btn.primario') ?? fin.querySelector('.btn')) as HTMLElement | null)?.click();
  };
  window.addEventListener('keydown', teclado);

  let quitarGesto: (() => void) | null = null;
  if (PUEDE_PANTALLA && !pantallaPedida && !document.fullscreenElement) {
    pantallaPedida = true;
    pedirPantallaCompleta().catch(() => {
      if (!vivo || document.fullscreenElement) return;
      const alGesto = () => {
        quitarGesto?.();
        if (!document.fullscreenElement) void pedirPantallaCompleta().catch(() => undefined);
      };
      quitarGesto = () => {
        window.removeEventListener('pointerup', alGesto, true);
        window.removeEventListener('keydown', alGesto, true);
        quitarGesto = null;
      };
      window.addEventListener('pointerup', alGesto, true);
      window.addEventListener('keydown', alGesto, true);
    });
  }

  return () => {
    vivo = false;
    quitarGesto?.();
    document.body.classList.remove('en-partida');
    window.removeEventListener('pointerdown', fueraDelMenu, true);
    window.removeEventListener('keydown', teclado);
    quitarPalanca?.();
    vista.destruir();
    el.remove();
  };
}
