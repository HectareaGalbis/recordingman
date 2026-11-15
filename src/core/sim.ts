import {
  clonar, miembrosMoviles, MovilDef, Objeto, trasladar,
  puntoInicio,
  BotonDef, CajaDef, ControlDef, DelayDef, PinchosDef, TerremotoDef, InterruptorDef, MetaDef, Nivel, ParedDef, PuertaDef, SueloDef, SwitchDef, TemporizadorDef, TextoDef,
} from './level';
import { SCRIPTS, Script } from './scripts';

export const VELOCIDAD = 5;
export const MARGEN_PARED = 20;
export const TICKS_POR_SEGUNDO = 40;
export const RADIO_INICIAL = 3;
export const RADIO_NORMAL = 20;
export const BORDE_CAJA = 10;
const TAM_MIN = 10;

export type Evento =
  | 'empezar' | 'reiniciar' | 'muerte' | 'meta' | 'completado'
  | 'boton' | 'interruptor' | 'caida';

export interface Entrada {
  dx: number;
  dy: number;
  agarrar: boolean;
  reiniciar: boolean;
}

export interface Mono {
  x: number;
  y: number;
  r: number;
  muerto: boolean;
  llego: boolean;
  ido: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class ParedRT {
  rx = 0;
  ry = 0;
  rw: number;
  rh: number;
  constructor(public def: ParedDef) {
    this.rw = def.w;
    this.rh = def.h;
  }
  rect(): Rect {
    return { x: this.def.x + this.rx, y: this.def.y + this.ry, w: this.rw, h: this.rh };
  }
  abrir(dir: number, vel: number) {
    const d = this.def;
    if (dir === 0) {
      if (this.rh > TAM_MIN) this.rh -= vel;
      if (this.rh < TAM_MIN) this.rh = TAM_MIN;
    } else if (dir === 1) {
      if (this.rw > TAM_MIN) (this.rx += vel), (this.rw -= vel);
      if (this.rw < TAM_MIN) (this.rx = d.w - TAM_MIN), (this.rw = TAM_MIN);
    } else if (dir === 2) {
      if (this.rh > TAM_MIN) (this.ry += vel), (this.rh -= vel);
      if (this.rh < TAM_MIN) (this.ry = d.h - TAM_MIN), (this.rh = TAM_MIN);
    } else {
      if (this.rw > TAM_MIN) this.rw -= vel;
      if (this.rw < TAM_MIN) this.rw = TAM_MIN;
    }
  }
  cerrar(dir: number, vel: number) {
    const d = this.def;
    if (dir === 0) {
      if (this.rh < d.h) this.rh += vel;
      if (this.rh > d.h) this.rh = d.h;
    } else if (dir === 1) {
      if (this.rw < d.w) (this.rx -= vel), (this.rw += vel);
      if (this.rw > d.w) (this.rw = d.w), (this.rx = 0);
    } else if (dir === 2) {
      if (this.rh < d.h) (this.ry -= vel), (this.rh += vel);
      if (this.rh > d.h) (this.rh = d.h), (this.ry = 0);
    } else {
      if (this.rw < d.w) this.rw += vel;
      if (this.rw > d.w) this.rw = d.w;
    }
  }
}

export interface BotonRT {
  def: BotonDef;
  pulsados: number;
  faltan: number;
  activo: boolean;
}
export interface CajaRT {
  def: CajaDef;
  x: number;
  y: number;
  por: number;
}
export interface PuertaRT {
  def: PuertaDef;
  valor: boolean;
}
export interface SwitchRT {
  def: SwitchDef;
  cambiado: boolean;
}
export interface MovilRT {
  def: MovilDef;
  miembros: { o: Objeto; orig: Objeto }[];
  puntos: { x: number; y: number }[];
  largo: number;
  s: number;
  dir: number;
  dx: number;
  dy: number;
}
export interface TerremotoRT {
  def: TerremotoDef;
  activo: boolean;
}
export interface DelayRT {
  def: DelayDef;
  cola: boolean[];
  i: number;
  valor: boolean;
}
export interface PinchosRT {
  def: PinchosDef;
  activo: boolean;
}
export interface TemporizadorRT {
  def: TemporizadorDef;
  cuenta: number;
  valor: boolean;
}
export interface InterruptorRT {
  def: InterruptorDef;
  activo: boolean;
  ocupado: boolean;
}
export interface MetaRT {
  def: MetaDef;
}
export const DURACION_FUEGO = 24;
export const DURACION_FUEGO_GRANDE = 48;
export interface Fuego {
  x: number;
  y: number;
  edad: number;
  grande: boolean;
  semilla: number;
}
export interface Explosion {
  x: number;
  y: number;
  edad: number;
}

function cerca(dx: number, dy: number, r: number): boolean {
  return dx * dx + dy * dy < r * r;
}

function dentroAmpliado(x: number, y: number, r: Rect): boolean {
  return y > r.y - MARGEN_PARED && x < r.x + r.w + MARGEN_PARED && y < r.y + r.h + MARGEN_PARED && x > r.x - MARGEN_PARED;
}

function solapan(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectCaja(c: CajaRT, x = c.x, y = c.y): Rect {
  return { x, y, w: c.def.w, h: c.def.h };
}

function nucleoCaja(c: CajaRT, x = c.x, y = c.y): Rect {
  return { x: x + BORDE_CAJA, y: y + BORDE_CAJA, w: c.def.w - 2 * BORDE_CAJA, h: c.def.h - 2 * BORDE_CAJA };
}

export class Sim {
  paredes: ParedRT[] = [];
  malas: ParedRT[] = [];
  botones: BotonRT[] = [];
  interruptores: InterruptorRT[] = [];
  metas: MetaRT[] = [];
  textos: TextoDef[] = [];
  suelos: SueloDef[] = [];
  cajas: CajaRT[] = [];
  puertas: PuertaRT[] = [];
  switches: SwitchRT[] = [];
  temporizadores: TemporizadorRT[] = [];
  controles: ControlDef[] = [];
  pinchos: PinchosRT[] = [];
  delays: DelayRT[] = [];
  terremotos: TerremotoRT[] = [];
  moviles: MovilRT[] = [];
  reaparicion: { x: number; y: number } | null = null;
  controlActual: number | null = null;

  jugadores: Mono[] = [];
  jugador: Mono;
  explosiones: Explosion[] = [];
  fuegos: Fuego[] = [];
  private ultimaMeta: MetaDef | null = null;
  empezado = false;
  completado = false;
  ticks = 0;
  eventos: Evento[] = [];
  datos: Record<string, any> = {};
  script: Script | null;

  private activos = new Map<number, () => boolean>();
  private azar: () => number;

  constructor(public nivel: Nivel, num = 1, public local = 0, semilla = 0) {
    let a = semilla >>> 0;
    this.azar = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    nivel = this.nivel = clonar(nivel);
    const miembros = miembrosMoviles(nivel);
    for (const o of nivel.objetos) {
      switch (o.t) {
        case 'pared':
          this.paredes.push(new ParedRT(o));
          break;
        case 'paredmala':
          this.malas.push(new ParedRT(o));
          break;
        case 'boton':
        case 'botontodos': {
          const b: BotonRT = { def: o, pulsados: 0, faltan: 1, activo: false };
          this.botones.push(b);
          this.activos.set(o.id, () => b.activo);
          break;
        }
        case 'interruptor': {
          const s: InterruptorRT = { def: o, activo: false, ocupado: false };
          this.interruptores.push(s);
          this.activos.set(o.id, () => s.activo);
          break;
        }
        case 'meta':
          this.metas.push({ def: o });
          break;
        case 'texto':
          this.textos.push(o);
          break;
        case 'suelo':
          this.suelos.push(o);
          break;
        case 'caja':
          this.cajas.push({ def: o, x: o.x, y: o.y, por: -1 });
          break;
        case 'puerta': {
          const g: PuertaRT = { def: o, valor: false };
          this.puertas.push(g);
          this.activos.set(o.id, () => g.valor);
          break;
        }
        case 'switch': {
          const s: SwitchRT = { def: o, cambiado: false };
          this.switches.push(s);
          this.activos.set(o.id, () => s.cambiado !== o.inicial);
          break;
        }
        case 'control':
          this.controles.push(o);
          break;
        case 'pinchos':
          this.pinchos.push({ def: o, activo: false });
          break;
        case 'movil': {
          const puntos = [{ x: 0, y: 0 }, ...o.ruta];
          if (o.modo === 'bucle' && !o.ascensor) puntos.push({ x: 0, y: 0 });
          let largo = 0;
          for (let i = 1; i < puntos.length; i++) largo += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
          const lista = (miembros.get(o.id) ?? []).map((m) => ({ o: m, orig: clonar({ objetos: [m] } as Nivel).objetos[0] }));
          this.moviles.push({ def: o, miembros: lista, puntos, largo, s: 0, dir: 1, dx: 0, dy: 0 });
          break;
        }
        case 'terremoto':
          this.terremotos.push({ def: o, activo: false });
          break;
        case 'delay': {
          const d: DelayRT = { def: o, cola: new Array(Math.max(1, Math.round((o.tiempo * TICKS_POR_SEGUNDO) / 10))).fill(false), i: 0, valor: false };
          this.delays.push(d);
          this.activos.set(o.id, () => d.valor);
          break;
        }
        case 'temporizador': {
          const z: TemporizadorRT = { def: o, cuenta: 0, valor: false };
          this.temporizadores.push(z);
          this.activos.set(o.id, () => z.valor);
          break;
        }
      }
    }
    for (let i = 0; i < num; i++) this.jugadores.push({ x: 0, y: 0, r: RADIO_INICIAL, muerto: false, llego: false, ido: false });
    for (const j of this.jugadores) {
      const p = this.puntoAparicion();
      (j.x = p.x), (j.y = p.y);
    }
    this.jugador = this.jugadores[local];
    this.script = (nivel.script && SCRIPTS[nivel.script]) || null;
  }

  private puntoAparicion(): { x: number; y: number } {
    if (this.jugadores.length < 2) return puntoInicio(this.nivel);
    const { x, y, w, h } = this.nivel.inicio;
    const m = RADIO_NORMAL;
    return { x: Math.floor(x + m + this.azar() * (w - 2 * m)), y: Math.floor(y + m + this.azar() * (h - 2 * m)) };
  }

  temblor(ms: number): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const q of this.terremotos) {
      if (!q.activo) continue;
      const d = q.def;
      const k = d.global ? 1 : Math.max(0, 1 - Math.hypot(this.jugador.x - d.x, this.jugador.y - d.y) / d.radio);
      if (!k) continue;
      const a = (2 * Math.PI * d.frecuencia * ms) / 1000;
      x += d.intensidad * k * Math.sin(a + d.id);
      y += d.intensidad * k * Math.sin(a * 1.31 + d.id * 2);
    }
    return { x, y };
  }

  monos(): Mono[] {
    return this.jugadores;
  }

  activo(id: number | null): boolean | null {
    if (id == null) return null;
    const f = this.activos.get(id);
    return f ? f() : null;
  }

  textosVisibles(): { x: number; y: number; texto: string }[] {
    return this.script?.textos ? [...this.textos, ...this.script.textos(this)] : this.textos;
  }

  tick(e: Entrada | Entrada[]) {
    const es = Array.isArray(e) ? e : [e];
    this.eventos.length = 0;
    this.ticks++;
    this.objetos();
    this.script?.tick?.(this);
    const presentes = this.jugadores.filter((j) => !j.ido);
    if (!this.completado && this.metas.length && presentes.length && presentes.every((j) => j.llego)) {
      this.completado = true;
      this.eventos.push('completado');
      const d = this.ultimaMeta ?? this.metas[0].def;
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      [[0, 0], [-70, -40], [70, -30], [-50, 50], [60, 45]].forEach(([ox, oy], k) =>
        this.fuegos.push({ x: cx + ox, y: cy + oy, edad: -k * 6, grande: true, semilla: k + 1 }),
      );
    }
    if (!this.empezado && es.some((x) => x.dx || x.dy)) this.empezar();
    if (this.empezado) {
      this.jugadores.forEach((j, i) => es[i] && this.moverJugador(i, es[i]));
    }
    for (const x of this.explosiones) x.edad++;
    this.explosiones = this.explosiones.filter((x) => x.edad < 26);
    for (const f of this.fuegos) f.edad++;
    this.fuegos = this.fuegos.filter((f) => f.edad < (f.grande ? DURACION_FUEGO_GRANDE : DURACION_FUEGO));
    if (this.empezado && es.some((x) => x.reiniciar)) this.reiniciar();
  }

  quitar(i: number) {
    const j = this.jugadores[i];
    if (!j) return;
    j.ido = true;
    j.muerto = true;
    this.soltar(i);
  }

  private soltar(i: number) {
    for (const c of this.cajas) if (c.por === i) c.por = -1;
  }

  cajaAgarrada(i = this.local): CajaRT | null {
    return this.cajas.find((c) => c.por === i) ?? null;
  }

  cajaAlAlcance(i = this.local): CajaRT | null {
    const j = this.jugadores[i];
    if (!j || j.muerto) return null;
    return this.cajas.find((c) => c.por < 0 && dentroAmpliado(j.x, j.y, rectCaja(c))) ?? null;
  }

  puedeAgarrar(): boolean {
    return !this.completado && !!(this.cajaAgarrada() ?? this.cajaAlAlcance());
  }

  private empezar() {
    this.empezado = true;
    this.eventos.push('empezar');
  }

  reiniciar() {
    for (const j of this.jugadores) {
      const p = this.puntoAparicion();
      this.colocar(j, p.x, p.y);
    }
    this.reiniciarEstado();
    this.empezado = false;
    this.eventos.push('reiniciar');
  }

  private colocar(m: Mono, x: number, y: number) {
    m.x = x;
    m.y = y;
    m.r = RADIO_INICIAL;
    m.muerto = m.ido;
    m.llego = false;
  }

  private reiniciarEstado() {
    this.fuegos = [];
    this.ultimaMeta = null;
    for (const s of this.interruptores) (s.activo = false), (s.ocupado = false);
    for (const c of this.cajas) (c.x = c.def.x), (c.y = c.def.y), (c.por = -1);
    for (const g of this.puertas) g.valor = false;
    for (const s of this.switches) s.cambiado = false;
    for (const z of this.temporizadores) (z.cuenta = 0), (z.valor = false);
    for (const d of this.delays) d.cola.fill(false), (d.i = 0), (d.valor = false);
    for (const m of this.moviles) (m.s = 0), (m.dir = 1);
    if (this.moviles.length) this.moverPlataformas(true);
    this.reaparicion = null;
    this.controlActual = null;
    this.completado = false;
  }

  matar(m: Mono) {
    if (m.muerto) return;
    this.explosiones.push({ x: m.x, y: m.y, edad: 0 });
    this.eventos.push('muerte');
    this.reaparecer(m);
  }

  private haySuelo(x: number, y: number): boolean {
    const dentro = (s: Rect) => x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h;
    return this.suelos.some(dentro) || this.pinchos.some((p) => dentro(p.def));
  }

  private avanzar(m: MovilRT) {
    const d = m.def;
    const paso = d.vel / TICKS_POR_SEGUNDO;
    const senal = this.activo(d.por);
    const activa = senal == null ? d.inicial : senal !== d.inicial;
    if (!m.largo) return;
    if (d.por != null && d.ascensor) {
      const objetivo = activa ? m.largo : 0;
      m.s = m.s < objetivo ? Math.min(objetivo, m.s + paso) : Math.max(objetivo, m.s - paso);
      return;
    }
    if (!activa) {
      if (d.atras) m.s = Math.max(0, m.s - d.velAtras / TICKS_POR_SEGUNDO);
      return;
    }
    if (d.modo === 'bucle') m.s = (m.s + paso) % m.largo;
    else if (d.modo === 'una') m.s = Math.min(m.largo, m.s + paso);
    else {
      m.s += m.dir * paso;
      if (m.s >= m.largo) (m.s = Math.max(0, 2 * m.largo - m.s)), (m.dir = -1);
      if (m.s <= 0) (m.s = Math.min(m.largo, -m.s)), (m.dir = 1);
    }
  }

  private posicionRuta(m: MovilRT): { x: number; y: number } {
    let resto = m.s;
    for (let i = 1; i < m.puntos.length; i++) {
      const a = m.puntos[i - 1];
      const b = m.puntos[i];
      const tramo = Math.hypot(b.x - a.x, b.y - a.y);
      if (resto <= tramo || i === m.puntos.length - 1) {
        const k = tramo ? Math.min(1, resto / tramo) : 0;
        return { x: Math.round(a.x + (b.x - a.x) * k), y: Math.round(a.y + (b.y - a.y) * k) };
      }
      resto -= tramo;
    }
    return { x: 0, y: 0 };
  }

  private moverPlataformas(reinicio: boolean) {
    let hayMovimiento = false;
    for (const m of this.moviles) {
      if (!reinicio && this.empezado) this.avanzar(m);
      const p = this.posicionRuta(m);
      const ddx = p.x - m.dx;
      const ddy = p.y - m.dy;
      if (!ddx && !ddy) continue;
      hayMovimiento = true;
      if (!reinicio) {
        const zona = { x: m.def.x + m.dx, y: m.def.y + m.dy, w: m.def.w, h: m.def.h };
        const dentro = (x: number, y: number) => x > zona.x && x < zona.x + zona.w && y > zona.y && y < zona.y + zona.h;
        for (const j of this.jugadores) if (!j.muerto && dentro(j.x, j.y)) (j.x += ddx), (j.y += ddy);
        for (const c of this.cajas) if (dentro(c.x + c.def.w / 2, c.y + c.def.h / 2)) (c.x += ddx), (c.y += ddy);
      }
      m.dx = p.x;
      m.dy = p.y;
      for (const { o, orig } of m.miembros) Object.assign(o, trasladar({ ...orig }, p.x, p.y));
    }
    if (!hayMovimiento || reinicio) return;
    this.jugadores.forEach((j, i) => {
      if (!j.muerto && this.choca(j.x, j.y, this.cajaAgarrada(i))) this.matar(j);
    });
  }

  private reaparecer(m: Mono) {
    this.soltar(this.jugadores.indexOf(m));
    const control = this.controles.find((c) => c.id === this.controlActual);
    const p = control ? { x: control.x + control.w / 2, y: control.y + control.h / 2 } : this.puntoAparicion();
    this.colocar(m, p.x, p.y);
  }

  private caer(m: Mono) {
    this.reaparecer(m);
    this.eventos.push('caida');
  }

  choca(x: number, y: number, salvo: CajaRT | null = null): boolean {
    for (const w of this.paredes) if (dentroAmpliado(x, y, w.rect())) return true;
    for (const c of this.cajas) if (c !== salvo && dentroAmpliado(x, y, nucleoCaja(c))) return true;
    return false;
  }

  private cabeCaja(c: CajaRT, x: number, y: number, quien: Mono): boolean {
    const r = rectCaja(c, x, y);
    for (const w of this.paredes) if (solapan(r, w.rect())) return false;
    for (const o of this.cajas) if (o !== c && solapan(r, rectCaja(o))) return false;
    const n = nucleoCaja(c, x, y);
    for (const m of this.jugadores) if (m !== quien && !m.muerto && dentroAmpliado(m.x, m.y, n)) return false;
    return true;
  }

  private moverJugador(i: number, e: Entrada) {
    const j = this.jugadores[i];
    if (j.muerto) return;
    let c = this.cajaAgarrada(i);
    if (!e.agarrar) {
      if (c) c.por = -1;
      c = null;
    } else if (!c) {
      c = this.cajaAlAlcance(i);
      if (c) c.por = i;
    }
    if (!e.dx && !e.dy) return;
    const mx = e.dx * VELOCIDAD;
    const my = e.dy * VELOCIDAD;
    if (this.choca(j.x + mx, j.y + my, c)) return;
    if (c) {
      if (!this.cabeCaja(c, c.x + mx, c.y + my, j)) return;
      c.x += mx;
      c.y += my;
    }
    j.x += mx;
    j.y += my;
  }

  private objetos() {
    const monos = this.monos();
    const vivos = () => monos.filter((m) => !m.muerto);

    const presentes = monos.filter((m) => !m.ido).length;
    for (const b of this.botones) {
      const d = b.def;
      b.pulsados = vivos().filter((m) => cerca(m.x - d.x, m.y - d.y, d.r)).length;
      if (d.t === 'botontodos') b.faltan = Math.max(1, presentes) - b.pulsados;
      else {
        b.pulsados += this.cajas.filter((c) => cerca(c.x + c.def.w / 2 - d.x, c.y + c.def.h / 2 - d.y, d.r)).length;
        b.faltan = 1 - b.pulsados;
      }
      this.marcar(b, b.faltan <= 0);
    }

    for (const s of this.interruptores) {
      const ocupado = vivos().some((m) => cerca(m.x - s.def.x, m.y - s.def.y, s.def.r));
      if (ocupado && !s.ocupado) {
        s.activo = !s.activo;
        this.eventos.push('interruptor');
      }
      s.ocupado = ocupado;
    }

    for (const m of vivos()) {
      for (const w of this.malas) {
        if (dentroAmpliado(m.x, m.y, w.rect())) {
          this.matar(m);
          break;
        }
      }
    }

    for (const z of this.temporizadores) {
      if (this.empezado) z.cuenta++;
      const inactivo = (z.def.inactivo * TICKS_POR_SEGUNDO) / 10;
      const ciclo = inactivo + (z.def.activo * TICKS_POR_SEGUNDO) / 10;
      z.valor = z.cuenta % ciclo >= inactivo;
    }

    const valores = this.puertas.map((g) => {
      const a = !!this.activo(g.def.a);
      const b = !!this.activo(g.def.b);
      switch (g.def.op) {
        case 'and':
          return a && b;
        case 'or':
          return a || b;
        case 'xand':
          return a === b;
        case 'xor':
          return a !== b;
        case 'not':
          return !a;
      }
    });
    this.puertas.forEach((g, i) => (g.valor = valores[i]));
    for (const s of this.switches) if (this.activo(s.def.por)) s.cambiado = true;
    for (const d of this.delays) {
      const entrada = !!this.activo(d.def.por);
      d.valor = d.cola[d.i];
      d.cola[d.i] = entrada;
      d.i = (d.i + 1) % d.cola.length;
    }

    for (const q of this.terremotos) {
      const senal = this.activo(q.def.por);
      q.activo = senal == null ? q.def.inicial : senal !== q.def.inicial;
    }

    for (const w of this.malas) this.accionar(w);
    for (const w of this.paredes) this.accionar(w);

    if (this.moviles.length) this.moverPlataformas(false);

    for (const p of this.pinchos) {
      const senal = this.activo(p.def.por);
      p.activo = senal == null ? p.def.inicial : senal !== p.def.inicial;
      if (!p.activo) continue;
      const d = p.def;
      for (const m of vivos()) if (m.x > d.x && m.x < d.x + d.w && m.y > d.y && m.y < d.y + d.h) this.matar(m);
    }

    const ini = this.nivel.inicio;
    if (this.controlActual != null && vivos().some((m) => m.x > ini.x && m.x < ini.x + ini.w && m.y > ini.y && m.y < ini.y + ini.h)) {
      this.controlActual = null;
      this.reaparicion = null;
    }
    for (const c of this.controles) {
      if (c.id !== this.controlActual && vivos().some((m) => m.x > c.x && m.x < c.x + c.w && m.y > c.y && m.y < c.y + c.h)) {
        this.controlActual = c.id;
        this.reaparicion = { x: c.x + c.w / 2, y: c.y + c.h / 2 };
      }
    }

    for (const m of vivos()) {
      let enMeta = false;
      for (const g of this.metas) {
        const d = g.def;
        if (m.x > d.x && m.x < d.x + d.w && m.y > d.y && m.y < d.y + d.h) {
          enMeta = true;
          m.r--;
          if (m.r < 5) {
            m.muerto = true;
            m.llego = true;
            this.soltar(this.jugadores.indexOf(m));
            this.ultimaMeta = d;
            this.fuegos.push({ x: m.x, y: m.y, edad: 0, grande: false, semilla: this.ticks % 97 });
            this.eventos.push('meta');
          }
          break;
        }
      }
      if (enMeta) continue;
      if (this.empezado && !this.haySuelo(m.x, m.y)) {
        m.r--;
        if (m.r < 5) this.caer(m);
      } else if (m.r < RADIO_NORMAL) m.r++;
    }
  }

  private marcar(b: BotonRT, activo: boolean) {
    if (activo && !b.activo) this.eventos.push('boton');
    b.activo = activo;
  }

  private accionar(w: ParedRT) {
    const a = this.activo(w.def.por);
    if (a == null) return;
    const d = w.def;
    const distancia = Math.max(0, (d.abre % 2 === 0 ? d.h : d.w) - TAM_MIN);
    const vel = (t: number) => (t ? distancia / ((t * TICKS_POR_SEGUNDO) / 10) : distancia);
    if (a !== d.invertida) w.abrir(d.abre, vel(d.tAbrir));
    else w.cerrar(d.abre, vel(d.tCerrar));
  }
}
