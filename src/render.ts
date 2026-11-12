import { ALTO, ANCHO, Nivel } from './core/level';
import { Mono, RADIO_NORMAL, Rect, Sim } from './core/sim';

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
  azul: '#2a5cff',
  blanco: '#ffffff',
};

const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export interface OpcionesDibujo {
  conexiones?: boolean;
  alfa?: number;
  previas?: Map<Mono, { x: number; y: number }>;
  tiempo?: number;
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
  for (const l of sim.laseres) if (l.def.id === id) return centroLaser(l.def.x, l.def.y, l.def.dir);
  return null;
}

export function centroLaser(x: number, y: number, dir: number) {
  return { x: x + (dir === 3 ? -15 : dir === 1 ? 15 : 20), y: y + (dir === 0 ? -15 : dir === 2 ? 15 : 20) };
}

function centroActivador(sim: Sim, id: number): { x: number; y: number } | null {
  for (const b of [...sim.botones, ...sim.botonesMalos, ...sim.interruptores]) if (b.def.id === id) return { x: b.def.x, y: b.def.y };
  for (const p of sim.placas) if (p.def.id === id) return { x: p.def.x + p.def.lado / 2, y: p.def.y + p.def.lado / 2 };
  return null;
}

export function dibujarNivel(ctx: CanvasRenderingContext2D, sim: Sim, op: OpcionesDibujo = {}) {
  const t = op.tiempo ?? 0;

  for (const m of sim.metas) {
    const d = m.def;
    ctx.fillStyle = C.tinta;
    redondo(ctx, d, 6);
    ctx.fill();
    ctx.strokeStyle = C.blanco;
    ctx.lineWidth = 1;
    redondo(ctx, { x: d.x + 5.5, y: d.y + 5.5, w: d.w - 11, h: d.h - 11 }, 3);
    ctx.stroke();
    numero(ctx, d.x + d.w / 2, d.y - 6, m.restantes, C.tinta);
  }

  for (const w of sim.paredes) pared(ctx, w.rect(), C.tinta, C.gris);

  for (const p of sim.portales) {
    for (const [x, y] of [[p.x, p.y], [p.x2, p.y2]]) {
      ctx.fillStyle = C.grisClaro;
      circulo(ctx, x, y, p.r);
      ctx.fill();
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -t * 0.02;
      circulo(ctx, x, y, p.r - 1);
      ctx.stroke();
      ctx.lineDashOffset = t * 0.02;
      circulo(ctx, x, y, p.r * 0.55);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.tinta;
      circulo(ctx, x, y, 3);
      ctx.fill();
    }
  }

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
    boton(ctx, b.def.x, b.def.y, b.def.r, C.tinta, b.pulsados >= b.def.peso ? C.gris : C.tinta);
    numero(ctx, b.def.x, b.def.y - b.def.r - 6, b.def.peso - b.pulsados, C.tinta);
  }
  for (const b of sim.botonesMalos) {
    boton(ctx, b.def.x, b.def.y, b.def.r, C.rojo, b.restantes <= 0 ? C.rosa : C.rojo);
    numero(ctx, b.def.x, b.def.y - b.def.r - 6, b.restantes, C.rojo);
  }

  for (const w of sim.malas) pared(ctx, w.rect(), C.rojoOscuro, C.rojo);

  for (const l of sim.laseres) {
    const { x, y, dir } = l.def;
    const relleno = l.blanco ? C.blanco : C.tinta;
    const borde = l.blanco ? C.tinta : C.blanco;
    const haz: Rect =
      dir === 0 ? { x: x + 15, y: y - l.largo - 1, w: 10, h: l.largo }
      : dir === 1 ? { x, y: y + 15, w: l.largo, h: 10 }
      : dir === 2 ? { x: x + 15, y, w: 10, h: l.largo }
      : { x: x - l.largo, y: y + 15, w: l.largo, h: 10 };
    ctx.fillStyle = relleno;
    ctx.fillRect(haz.x, haz.y, haz.w, haz.h);
    ctx.strokeStyle = borde;
    ctx.lineWidth = 1;
    ctx.strokeRect(haz.x + 0.5, haz.y + 0.5, haz.w - 1, haz.h - 1);
    ctx.beginPath();
    if (dir === 0) ctx.moveTo(x + 2, y - 2), ctx.lineTo(x + 38, y - 2), ctx.lineTo(x + 20, y - 29);
    else if (dir === 1) ctx.moveTo(x + 2, y + 2), ctx.lineTo(x + 2, y + 38), ctx.lineTo(x + 29, y + 20);
    else if (dir === 2) ctx.moveTo(x + 2, y + 2), ctx.lineTo(x + 38, y + 2), ctx.lineTo(x + 20, y + 29);
    else ctx.moveTo(x - 2, y + 2), ctx.lineTo(x - 2, y + 38), ctx.lineTo(x - 29, y + 20);
    ctx.closePath();
    ctx.fillStyle = relleno;
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.fill();
    ctx.stroke();
  }

  for (const p of sim.placas) {
    const d = p.def;
    ctx.fillStyle = sim.placasActivas ? C.verde : C.rojo;
    redondo(ctx, { x: d.x, y: d.y, w: d.lado, h: d.lado }, 4);
    ctx.fill();
    ctx.fillStyle = p.color === 1 ? C.tinta : p.color === 2 ? C.blanco : C.gris;
    redondo(ctx, { x: d.x + 5, y: d.y + 5, w: d.lado - 10, h: d.lado - 10 }, 2);
    ctx.fill();
  }

  ctx.font = `13px ${FUENTE}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.texto;
  for (const x of sim.textosVisibles()) ctx.fillText(x.texto, x.x, x.y);

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

  const monos = [...sim.replicas].reverse();
  monos.push(sim.jugador);
  for (const m of monos) {
    if (m.muerto) continue;
    let { x, y } = m;
    const p = op.previas?.get(m);
    if (p && op.alfa != null && Math.abs(p.x - x) <= 10 && Math.abs(p.y - y) <= 10) {
      x = p.x + (x - p.x) * op.alfa;
      y = p.y + (y - p.y) * op.alfa;
    }
    ctx.fillStyle = m.jugador ? C.tinta : C.blanco;
    ctx.strokeStyle = m.jugador ? C.blanco : C.tinta;
    ctx.lineWidth = 2.5;
    circulo(ctx, x, y, m.r - 1.25);
    ctx.fill();
    ctx.stroke();
  }

  if (op.conexiones) dibujarConexiones(ctx, sim);
}

export function dibujarConexiones(ctx: CanvasRenderingContext2D, sim: Sim) {
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
  for (const r of [...sim.paredes, ...sim.malas, ...sim.laseres]) {
    if (r.def.por == null) continue;
    const a = centroActivador(sim, r.def.por);
    const b = centroReceptor(sim, r.def.id);
    if (a && b) linea(a, b);
  }
  for (const p of sim.portales) linea({ x: p.x, y: p.y }, { x: p.x2, y: p.y2 });
}

export class Vista {
  ctx: CanvasRenderingContext2D;
  escala = 1;
  ox = 0;
  oy = 0;
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
    this.escala = Math.min(r.width / ANCHO, r.height / ALTO);
    this.ox = (r.width - ANCHO * this.escala) / 2;
    this.oy = (r.height - ALTO * this.escala) / 2;
  }

  aMundo(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.ox) / this.escala, y: (clientY - r.top - this.oy) / this.escala };
  }

  preparar() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.dpr * this.escala;
    ctx.setTransform(k, 0, 0, k, this.ox * this.dpr, this.oy * this.dpr);
    ctx.fillStyle = C.fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ANCHO, ALTO);
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
  const quieto = { dx: 0, dy: 0, grabar: false, reiniciar: false };
  for (let i = 0; i < 70; i++) sim.tick(quieto);
  for (const w of [...sim.paredes, ...sim.malas]) (w.rx = 0), (w.ry = 0), (w.rw = w.def.w), (w.rh = w.def.h);
  sim.jugador.r = RADIO_NORMAL;
  sim.jugador.muerto = false;
  for (const m of sim.metas) m.restantes = m.def.n;
  sim.explosiones = [];
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
  ctx.fillStyle = C.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  try {
    dibujarNivel(ctx, simEstatica(nivel));
  } catch {
    return c;
  }
  return c;
}
