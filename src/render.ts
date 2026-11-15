import { ALTO, ANCHO, Nivel, Objeto, Ranura, SEPARACION_INICIO, TAM_INICIO, TAM_LOGICA, ranuras } from './core/level';
import { BORDE_CAJA, DURACION_FUEGO, DURACION_FUEGO_GRANDE, RADIO_NORMAL, Rect, Sim } from './core/sim';

const COLORES_FUEGO = ['#ee1c25', '#1fbf4a', '#2a5cff', '#ffc400', '#ff7a00', '#c13bff'];

const RADIO_PINCHO = RADIO_NORMAL / 2;
export const BORDE_MOVIL = 10;
const SEPARACION_PINCHOS = 35;

export const C = {
  fondo: '#fafafa',
  tinta: '#111111',
  gris: '#b2b2b2',
  grisClaro: '#e6e6e6',
  texto: '#7a7a7a',
  rojo: '#ee1c25',
  rojoOscuro: '#a50f16',
  rosa: '#ffb3b6',
  verde: '#1fbf4a',
  verdeVivo: '#22e055',
  control: '#f0f0f0',
  pinchos: '#4a4a4a',
  pinchosHueco: '#2a2a2a',
  controlActivo: '#e3f9e8',
  azul: '#2a5cff',
  blanco: '#ffffff',
  caja: '#6b4423',
  cajaClaro: '#c79a5e',
};

const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export interface OpcionesDibujo {
  conexiones?: boolean;
  alfa?: number;
  previas?: Map<object, { x: number; y: number }>;
  tiempo?: number;
  editor?: boolean;
}

function mostrar(ctx: CanvasRenderingContext2D, d: { invisible: boolean }, op: OpcionesDibujo): boolean {
  if (d.invisible && !op.editor) return false;
  ctx.globalAlpha = d.invisible ? 0.35 : 1;
  return true;
}

function redondo(ctx: CanvasRenderingContext2D, r: Rect, radio: number) {
  const k = Math.max(0, Math.min(radio, r.w / 2, r.h / 2));
  ctx.beginPath();
  ctx.moveTo(r.x + k, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k);
  ctx.closePath();
}

function circulo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

function pared(ctx: CanvasRenderingContext2D, r: Rect, borde: string, interior: string) {
  ctx.fillStyle = borde;
  redondo(ctx, r, 4);
  ctx.fill();
  if (r.w > 10 && r.h > 10) {
    ctx.fillStyle = interior;
    redondo(ctx, { x: r.x + 5, y: r.y + 5, w: r.w - 10, h: r.h - 10 }, 2);
    ctx.fill();
  }
}

function numero(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = `700 13px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(Math.max(0, n)), x, y);
}

function boton(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, relleno: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  circulo(ctx, x, y, r - 1.5);
  ctx.stroke();
  ctx.fillStyle = relleno;
  circulo(ctx, x, y, r - 6);
  ctx.fill();
}

export function centroReceptor(sim: Sim, id: number): { x: number; y: number } | null {
  for (const w of [...sim.paredes, ...sim.malas]) {
    if (w.def.id === id) {
      const r = w.rect();
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
  }
  return null;
}

const MEDIO = TAM_LOGICA / 2;

export function pinSalida(o: Objeto): { x: number; y: number } {
  return o.t === 'puerta' || o.t === 'switch' || o.t === 'temporizador' || o.t === 'delay' ? { x: o.x + MEDIO, y: o.y } : { x: o.x, y: o.y };
}

export function pinEntrada(o: Objeto, r: Ranura): { x: number; y: number } {
  if ('w' in o) return { x: o.x + o.w / 2, y: o.y + o.h / 2 };
  if (o.t === 'puerta' && o.op !== 'not') return { x: o.x - MEDIO, y: o.y + (r === 'b' ? 12 : -12) };
  return { x: o.x - MEDIO, y: o.y };
}

function bloque(ctx: CanvasRenderingContext2D, x: number, y: number, activo: boolean) {
  ctx.fillStyle = C.tinta;
  redondo(ctx, { x: x - MEDIO, y: y - MEDIO, w: TAM_LOGICA, h: TAM_LOGICA }, 8);
  ctx.fill();
  ctx.fillStyle = activo ? C.tinta : C.blanco;
  redondo(ctx, { x: x - MEDIO + 3, y: y - MEDIO + 3, w: TAM_LOGICA - 6, h: TAM_LOGICA - 6 }, 5);
  ctx.fill();
}

function pin(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, activo: boolean) {
  ctx.fillStyle = activo ? C.verde : C.blanco;
  ctx.strokeStyle = C.tinta;
  ctx.lineWidth = 2;
  circulo(ctx, p.x, p.y, 5);
  ctx.fill();
  ctx.stroke();
}

export function dibujarNivel(ctx: CanvasRenderingContext2D, sim: Sim, op: OpcionesDibujo = {}) {
  const t = op.tiempo ?? 0;

  for (const s of sim.suelos) {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }

  {
    const ini = sim.nivel.inicio;
    ctx.fillStyle = C.control;
    ctx.fillRect(ini.x, ini.y, ini.w, ini.h);
    const cx = ini.x + ini.w / 2;
    const cy = ini.y + ini.h / 2;
    const k = TAM_INICIO * 0.25;
    const cols = 4;
    const filas = 3;
    const lado = (k * 1.3) / cols;
    const x0 = cx - SEPARACION_INICIO - (cols * lado) / 2;
    const y0 = cy - k;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < filas; j++) {
        ctx.fillStyle = (i + j) % 2 ? C.blanco : C.tinta;
        ctx.fillRect(x0 + i * lado, y0 + j * lado, lado, lado);
      }
    }
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, cols * lado, filas * lado);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, cy + k);
    ctx.lineTo(x0, y0);
    ctx.stroke();
  }

  for (const c of sim.controles) {
    const actual = c.id === sim.controlActual;
    ctx.fillStyle = actual ? C.controlActivo : C.control;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const k = Math.min(c.w, c.h) * 0.25;
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - k * 0.5, cy + k);
    ctx.lineTo(cx - k * 0.5, cy - k);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - k * 0.5, cy - k);
    ctx.lineTo(cx + k * 0.8, cy - k * 0.5);
    ctx.lineTo(cx - k * 0.5, cy);
    ctx.closePath();
    ctx.fillStyle = actual ? C.verdeVivo : C.gris;
    ctx.fill();
  }

  for (const p of sim.pinchos) {
    const d = p.def;
    ctx.fillStyle = C.pinchos;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    const cols = Math.max(1, Math.round(d.w / SEPARACION_PINCHOS));
    const filas = Math.max(1, Math.round(d.h / SEPARACION_PINCHOS));
    const sx = d.w / cols;
    const sy = d.h / filas;
    const r = RADIO_PINCHO;
    const giro = t * 0.003;
    if (p.activo) {
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < filas; j++) {
          const cx = d.x + (i + 0.5) * sx;
          const cy = d.y + (j + 0.5) * sy;
          for (let k = 0; k < 6; k++) {
            const a = giro + (k * Math.PI) / 3;
            ctx.moveTo(cx + Math.cos(a - 0.45) * (r - 1), cy + Math.sin(a - 0.45) * (r - 1));
            ctx.lineTo(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5));
            ctx.lineTo(cx + Math.cos(a + 0.45) * (r - 1), cy + Math.sin(a + 0.45) * (r - 1));
            ctx.closePath();
          }
        }
      }
      ctx.fillStyle = C.rojo;
      ctx.fill();
    }
    ctx.beginPath();
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < filas; j++) {
        const cx = d.x + (i + 0.5) * sx;
        const cy = d.y + (j + 0.5) * sy;
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = p.activo ? C.rojo : C.pinchosHueco;
    ctx.fill();
    if (p.activo) {
      ctx.strokeStyle = C.rojoOscuro;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  for (const m of sim.metas) {
    const d = m.def;
    ctx.fillStyle = C.tinta;
    redondo(ctx, d, 6);
    ctx.fill();
    ctx.strokeStyle = C.blanco;
    ctx.lineWidth = 1;
    redondo(ctx, { x: d.x + 5.5, y: d.y + 5.5, w: d.w - 11, h: d.h - 11 }, 3);
    ctx.stroke();
  }

  for (const w of sim.paredes) pared(ctx, w.rect(), C.tinta, C.gris);

  for (const s of sim.interruptores) {
    const { x, y, r } = s.def;
    ctx.fillStyle = C.blanco;
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 3;
    circulo(ctx, x, y, r - 1.5);
    ctx.fill();
    ctx.stroke();
    const k = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y - k);
    ctx.lineTo(x + k, y);
    ctx.lineTo(x, y + k);
    ctx.lineTo(x - k, y);
    ctx.closePath();
    ctx.fillStyle = s.activo ? C.tinta : C.gris;
    ctx.fill();
  }

  for (const b of sim.botones) {
    const d = b.def;
    boton(ctx, d.x, d.y, d.r, C.tinta, b.activo ? C.gris : C.tinta);
    if (d.t !== 'botontodos') continue;
    ctx.strokeStyle = b.activo ? C.tinta : C.blanco;
    ctx.lineWidth = 2;
    for (const k of [0.6, 0.3]) {
      circulo(ctx, d.x, d.y, d.r * k);
      ctx.stroke();
    }
    numero(ctx, d.x, d.y - d.r - 6, b.faltan, C.tinta);
  }

  for (const w of sim.malas) pared(ctx, w.rect(), C.rojoOscuro, C.rojo);

  for (const g of sim.puertas) {
    const d = g.def;
    if (!mostrar(ctx, d, op)) continue;
    bloque(ctx, d.x, d.y, g.valor);
    ctx.fillStyle = g.valor ? C.blanco : C.tinta;
    ctx.font = `700 12px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.op.toUpperCase(), d.x, d.y + 1);
    for (const r of ranuras(d)) pin(ctx, pinEntrada(d, r), !!sim.activo(d[r as 'a' | 'b']));
    pin(ctx, pinSalida(d), g.valor);
  }

  for (const s of sim.switches) {
    const d = s.def;
    if (!mostrar(ctx, d, op)) continue;
    const valor = !!sim.activo(d.id);
    bloque(ctx, d.x, d.y, valor);
    ctx.strokeStyle = valor ? C.blanco : C.tinta;
    ctx.fillStyle = valor ? C.blanco : C.tinta;
    ctx.lineWidth = 2;
    redondo(ctx, { x: d.x - 14, y: d.y - 7, w: 28, h: 14 }, 7);
    ctx.stroke();
    circulo(ctx, d.x + (valor ? 7 : -7), d.y, 4);
    ctx.fill();
    pin(ctx, pinEntrada(d, 'por'), !!sim.activo(d.por));
    pin(ctx, pinSalida(d), valor);
  }

  for (const q of sim.terremotos) {
    const d = q.def;
    if (!mostrar(ctx, d, op)) continue;
    const activo = q.activo;
    bloque(ctx, d.x, d.y, activo);
    ctx.strokeStyle = activo ? C.blanco : C.tinta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const dy of [-6, 6]) {
      ctx.moveTo(d.x - 14, d.y + dy);
      for (let i = 1; i <= 7; i++) ctx.lineTo(d.x - 14 + i * 4, d.y + dy + (i % 2 ? -4 : 4) * (i === 7 ? 0 : 1));
    }
    ctx.stroke();
    pin(ctx, pinEntrada(d, 'por'), !!sim.activo(d.por));
  }

  for (const g of sim.delays) {
    const d = g.def;
    if (!mostrar(ctx, d, op)) continue;
    bloque(ctx, d.x, d.y, g.valor);
    ctx.fillStyle = g.valor ? C.blanco : C.tinta;
    ctx.font = `700 11px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${d.tiempo / 10}s`, d.x, d.y + 1);
    pin(ctx, pinEntrada(d, 'por'), !!sim.activo(d.por));
    pin(ctx, pinSalida(d), g.valor);
  }

  for (const z of sim.temporizadores) {
    const d = z.def;
    if (!mostrar(ctx, d, op)) continue;
    bloque(ctx, d.x, d.y, z.valor);
    const color = z.valor ? C.blanco : C.tinta;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    circulo(ctx, d.x, d.y, 13);
    ctx.stroke();
    const fase = z.valor ? d.activo : d.inactivo;
    const hecho = (z.cuenta % ((d.activo + d.inactivo) * 4)) - (z.valor ? d.inactivo * 4 : 0);
    const a = -Math.PI / 2 + (2 * Math.PI * hecho) / (fase * 4);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + Math.cos(a) * 9, d.y + Math.sin(a) * 9);
    ctx.stroke();
    pin(ctx, pinSalida(d), z.valor);
  }

  ctx.globalAlpha = 1;

  for (const c of sim.cajas) {
    let { x, y } = c;
    const p = op.previas?.get(c);
    if (p && op.alfa != null && Math.abs(p.x - x) <= 10 && Math.abs(p.y - y) <= 10) {
      x = p.x + (x - p.x) * op.alfa;
      y = p.y + (y - p.y) * op.alfa;
    }
    const { w, h } = c.def;
    const b = BORDE_CAJA;
    ctx.fillStyle = C.cajaClaro;
    redondo(ctx, { x, y, w, h }, 4);
    ctx.fill();
    ctx.fillStyle = C.caja;
    ctx.fillRect(x + b, y + b, w - 2 * b, h - 2 * b);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + b, y + b, w - 2 * b, h - 2 * b);
    ctx.clip();
    ctx.strokeStyle = C.cajaClaro;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + b, y + b);
    ctx.lineTo(x + w - b, y + h - b);
    ctx.moveTo(x + w - b, y + b);
    ctx.lineTo(x + b, y + h - b);
    ctx.stroke();
    ctx.restore();
    if (c.por >= 0) {
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 2;
      redondo(ctx, { x: x + 1, y: y + 1, w: w - 2, h: h - 2 }, 4);
      ctx.stroke();
    }
  }

  ctx.font = `13px ${FUENTE}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.texto;
  for (const x of sim.textosVisibles()) ctx.fillText(x.texto, x.x, x.y);

  if (op.editor) {
    for (const m of sim.moviles) {
      const d = m.def;
      const x = d.x + m.dx;
      const y = d.y + m.dy;
      const b = Math.min(BORDE_MOVIL, d.w / 2, d.h / 2);
      ctx.fillStyle = C.azul;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(x + b, y + b, d.w - 2 * b, d.h - 2 * b);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.rect(x, y, d.w, d.h);
      ctx.rect(x + b, y + b, d.w - 2 * b, d.h - 2 * b);
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
    }
  }

  for (const e of sim.explosiones) {
    ctx.globalAlpha = Math.max(0, 1 - e.edad / 26);
    for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      ctx.fillStyle = C.blanco;
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 2;
      circulo(ctx, e.x + sx * (e.edad + 1) * 1.6, e.y + sy * (e.edad + 1) * 1.6, 7);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  for (const m of sim.monos()) {
    if (m.muerto) continue;
    let { x, y } = m;
    const p = op.previas?.get(m);
    if (p && op.alfa != null && Math.abs(p.x - x) <= 10 && Math.abs(p.y - y) <= 10) {
      x = p.x + (x - p.x) * op.alfa;
      y = p.y + (y - p.y) * op.alfa;
    }
    ctx.fillStyle = C.tinta;
    ctx.strokeStyle = C.blanco;
    ctx.lineWidth = 2.5;
    circulo(ctx, x, y, m.r - 1.25);
    ctx.fill();
    ctx.stroke();
  }

  for (const f of sim.fuegos) {
    if (f.edad < 0) continue;
    const k = f.edad / (f.grande ? DURACION_FUEGO_GRANDE : DURACION_FUEGO);
    const n = f.grande ? 28 : 10;
    const alcance = f.grande ? 110 : 35;
    const avance = 1 - (1 - k) * (1 - k);
    ctx.globalAlpha = Math.max(0, 1 - k);
    for (let i = 0; i < n; i++) {
      const azar = Math.abs(Math.sin(i * 12.9898 + f.semilla * 78.233) * 43758.5453) % 1;
      const ang = (i / n) * Math.PI * 2 + f.semilla;
      const dist = alcance * (0.6 + 0.4 * azar) * avance;
      ctx.fillStyle = COLORES_FUEGO[(i + f.semilla) % COLORES_FUEGO.length];
      circulo(ctx, f.x + Math.cos(ang) * dist, f.y + Math.sin(ang) * dist, f.grande ? 4 : 3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (op.conexiones) dibujarConexiones(ctx, sim, op.editor);
}

export function dibujarConexiones(ctx: CanvasRenderingContext2D, sim: Sim, editor = false) {
  const oculto = (o: Objeto) => !editor && 'invisible' in o && o.invisible;
  ctx.strokeStyle = C.azul;
  ctx.fillStyle = C.azul;
  ctx.lineWidth = 1.5;
  const linea = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of [a, b]) {
      circulo(ctx, p.x, p.y, 4);
      ctx.fill();
    }
  };
  const porId = new Map(sim.nivel.objetos.map((o) => [o.id, o]));
  for (const o of sim.nivel.objetos) {
    for (const r of ranuras(o)) {
      const origen = porId.get((o as unknown as Record<Ranura, number | null>)[r] ?? -1);
      if (origen && !oculto(origen) && !oculto(o)) linea(pinSalida(origen), centroReceptor(sim, o.id) ?? pinEntrada(o, r));
    }
  }
}

export class Vista {
  ctx: CanvasRenderingContext2D;
  escala = 1;
  ox = 0;
  oy = 0;
  cx = 0;
  cy = 0;
  completa = false;
  fondo = C.fondo;
  private ancho = 1;
  private alto = 1;
  private dpr = 1;
  private observador: ResizeObserver;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.observador = new ResizeObserver(() => this.ajustar());
    this.observador.observe(canvas);
    this.ajustar();
  }

  destruir() {
    this.observador.disconnect();
  }

  ajustar() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * this.dpr));
    const h = Math.max(1, Math.round(r.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ancho = r.width;
    this.alto = r.height;
    this.escala = Math.min(r.width / ANCHO, r.height / ALTO);
    this.ox = (r.width - ANCHO * this.escala) / 2;
    this.oy = (r.height - ALTO * this.escala) / 2;
  }

  aMundo(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.ox) / this.escala + this.cx, y: (clientY - r.top - this.oy) / this.escala + this.cy };
  }

  visible(): Rect {
    if (!this.completa) return { x: this.cx, y: this.cy, w: ANCHO, h: ALTO };
    return { x: this.cx - this.ox / this.escala, y: this.cy - this.oy / this.escala, w: this.ancho / this.escala, h: this.alto / this.escala };
  }

  preparar() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.dpr * this.escala;
    ctx.setTransform(k, 0, 0, k, this.ox * this.dpr, this.oy * this.dpr);
    ctx.save();
    ctx.translate(-this.cx, -this.cy);
    const v = this.visible();
    ctx.fillStyle = this.fondo;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.beginPath();
    ctx.rect(v.x, v.y, v.w, v.h);
    ctx.clip();
  }

  terminar() {
    this.ctx.restore();
  }

  dibujar(sim: Sim, op: OpcionesDibujo = {}) {
    this.preparar();
    dibujarNivel(this.ctx, sim, op);
    this.terminar();
  }
}

export function simEstatica(nivel: Nivel): Sim {
  const sim = new Sim(nivel);
  const quieto = { dx: 0, dy: 0, agarrar: false, reiniciar: false };
  for (let i = 0; i < 70; i++) sim.tick(quieto);
  for (const w of [...sim.paredes, ...sim.malas]) (w.rx = 0), (w.ry = 0), (w.rw = w.def.w), (w.rh = w.def.h);
  sim.jugador.r = RADIO_NORMAL;
  sim.jugador.muerto = false;
  sim.explosiones = [];
  sim.fuegos = [];
  return sim;
}

export function miniatura(nivel: Nivel, ancho = 260): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const k = (ancho / ANCHO) * 2;
  c.width = Math.round(ANCHO * k);
  c.height = Math.round(ALTO * k);
  c.className = 'miniatura';
  const ctx = c.getContext('2d')!;
  ctx.scale(k, k);
  ctx.fillStyle = nivel.fondo || C.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  try {
    dibujarNivel(ctx, simEstatica(nivel));
  } catch {
    return c;
  }
  return c;
}
