import {
  ALTO, ANCHO, BotonDef, InterruptorDef, LaserDef, MetaDef, Nivel, ParedDef, PlacaDef, PortalDef, TextoDef,
} from './level';
import { SCRIPTS, Script } from './scripts';

export const VELOCIDAD = 5;
export const MARGEN_PARED = 20;
export const TICKS_POR_SEGUNDO = 40;
export const RADIO_INICIAL = 3;
export const RADIO_NORMAL = 20;
const ESPERA = 4;
const TAM_MIN = 10;
const LASER_CRECE = 20;
const LASER_MAX = 1350;
const LASER_CUERPO = 30;
const ALCANCE_MALO = 20;

export type Evento =
  | 'empezar' | 'grabar' | 'sin_grabaciones' | 'reiniciar' | 'muerte' | 'meta' | 'completado'
  | 'boton' | 'interruptor' | 'portal';

export interface Entrada {
  dx: number;
  dy: number;
  grabar: boolean;
  reiniciar: boolean;
}

export interface Mono {
  x: number;
  y: number;
  r: number;
  muerto: boolean;
  jugador: boolean;
  grab: number[];
  i: number;
  portal: number;
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
  restantes: number;
  activo: boolean;
}
export interface InterruptorRT {
  def: InterruptorDef;
  activo: boolean;
  ocupado: boolean;
}
export interface PlacaRT {
  def: PlacaDef;
  color: number;
}
export interface LaserRT {
  def: LaserDef;
  largo: number;
  blanco: boolean;
}
export interface MetaRT {
  def: MetaDef;
  restantes: number;
}
export interface Explosion {
  x: number;
  y: number;
  edad: number;
}

function dentroAmpliado(x: number, y: number, r: Rect): boolean {
  return y > r.y - MARGEN_PARED && x < r.x + r.w + MARGEN_PARED && y < r.y + r.h + MARGEN_PARED && x > r.x - MARGEN_PARED;
}

export class Sim {
  paredes: ParedRT[] = [];
  malas: ParedRT[] = [];
  botones: BotonRT[] = [];
  botonesMalos: BotonRT[] = [];
  interruptores: InterruptorRT[] = [];
  placas: PlacaRT[] = [];
  laseres: LaserRT[] = [];
  portales: PortalDef[] = [];
  metas: MetaRT[] = [];
  textos: TextoDef[] = [];

  jugador: Mono;
  replicas: Mono[] = [];
  explosiones: Explosion[] = [];
  empezado = false;
  completado = false;
  restantes: number;
  placasActivas = false;
  ticks = 0;
  grabacionesUsadas = 0;
  eventos: Evento[] = [];
  datos: Record<string, any> = {};
  script: Script | null;

  private activos = new Map<number, () => boolean>();

  constructor(public nivel: Nivel) {
    for (const o of nivel.objetos) {
      switch (o.t) {
        case 'pared':
          this.paredes.push(new ParedRT(o));
          break;
        case 'paredmala':
          this.malas.push(new ParedRT(o));
          break;
        case 'boton': {
          const b: BotonRT = { def: o, pulsados: 0, restantes: o.peso, activo: false };
          this.botones.push(b);
          this.activos.set(o.id, () => b.pulsados >= o.peso);
          break;
        }
        case 'botonmalo': {
          const b: BotonRT = { def: o, pulsados: 0, restantes: o.peso, activo: false };
          this.botonesMalos.push(b);
          this.activos.set(o.id, () => b.restantes <= 0);
          break;
        }
        case 'interruptor': {
          const s: InterruptorRT = { def: o, activo: false, ocupado: false };
          this.interruptores.push(s);
          this.activos.set(o.id, () => s.activo);
          break;
        }
        case 'placa':
          this.placas.push({ def: o, color: -1 });
          this.activos.set(o.id, () => this.placasActivas);
          break;
        case 'laser':
          this.laseres.push({ def: o, largo: 5, blanco: o.blanco });
          break;
        case 'portal':
          this.portales.push(o);
          break;
        case 'meta':
          this.metas.push({ def: o, restantes: o.n });
          break;
        case 'texto':
          this.textos.push(o);
          break;
      }
    }
    this.jugador = { x: nivel.inicio.x, y: nivel.inicio.y, r: RADIO_INICIAL, muerto: false, jugador: true, grab: [], i: 0, portal: 0 };
    this.restantes = nivel.grabaciones;
    this.script = (nivel.script && SCRIPTS[nivel.script]) || null;
  }

  monos(): Mono[] {
    return [this.jugador, ...this.replicas];
  }

  activo(id: number | null): boolean | null {
    if (id == null) return null;
    const f = this.activos.get(id);
    return f ? f() : null;
  }

  textosVisibles(): { x: number; y: number; texto: string }[] {
    return this.script?.textos ? [...this.textos, ...this.script.textos(this)] : this.textos;
  }

  tick(e: Entrada) {
    this.eventos.length = 0;
    this.ticks++;
    for (const l of this.laseres) this.haz(l);
    this.objetos();
    this.script?.tick?.(this);
    if (!this.completado && this.metas.length && this.metas.every((m) => m.restantes <= 0)) {
      this.completado = true;
      this.eventos.push('completado');
    }
    if (!this.empezado && (e.dx || e.dy)) this.empezar();
    if (this.empezado) {
      this.moverJugador(e.dx, e.dy);
      for (const r of this.replicas) {
        if (r.muerto || r.i >= r.grab.length) continue;
        const c = r.grab[r.i++];
        r.x += ((c % 3) - 1) * VELOCIDAD;
        r.y += (Math.floor(c / 3) - 1) * VELOCIDAD;
      }
      this.cruzarPortales();
    }
    for (const x of this.explosiones) x.edad++;
    this.explosiones = this.explosiones.filter((x) => x.edad < 26);
    if (e.grabar) this.pulsarGrabar();
    if (e.reiniciar && this.empezado) this.reiniciar();
  }

  private empezar() {
    this.empezado = true;
    this.eventos.push('empezar');
  }

  pulsarGrabar() {
    if (!this.empezado) this.empezar();
    else if (this.restantes !== 0) this.nuevaGrabacion();
    else this.eventos.push('sin_grabaciones');
  }

  private nuevaGrabacion() {
    const j = this.jugador;
    this.replicas.unshift({ ...j, jugador: false, grab: j.grab });
    j.grab = [];
    for (const m of this.monos()) this.colocar(m);
    this.reiniciarEstado();
    if (this.restantes > 0) this.restantes--;
    this.grabacionesUsadas++;
    this.eventos.push('grabar');
  }

  reiniciar() {
    this.replicas = [];
    this.jugador.grab = [];
    this.colocar(this.jugador);
    this.reiniciarEstado();
    this.restantes = this.nivel.grabaciones;
    this.grabacionesUsadas = 0;
    this.empezado = false;
    this.eventos.push('reiniciar');
  }

  private colocar(m: Mono) {
    m.x = this.nivel.inicio.x;
    m.y = this.nivel.inicio.y;
    m.r = RADIO_INICIAL;
    m.muerto = false;
    m.i = 0;
    m.portal = 0;
  }

  private reiniciarEstado() {
    for (const b of this.botonesMalos) b.restantes = b.def.peso;
    for (const m of this.metas) m.restantes = m.def.n;
    for (const p of this.placas) p.color = -1;
    for (const s of this.interruptores) (s.activo = false), (s.ocupado = false);
    this.completado = false;
  }

  matar(m: Mono) {
    if (m.muerto) return;
    this.explosiones.push({ x: m.x, y: m.y, edad: 0 });
    m.muerto = true;
    this.eventos.push('muerte');
  }

  choca(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x > ANCHO || y > ALTO) return true;
    for (const w of this.paredes) if (dentroAmpliado(x, y, w.rect())) return true;
    return false;
  }

  private moverJugador(dx: number, dy: number) {
    const j = this.jugador;
    if (j.muerto) return;
    let codigo = ESPERA;
    if (dx || dy) {
      const x = j.x + dx * VELOCIDAD;
      const y = j.y + dy * VELOCIDAD;
      if (!this.choca(x, y)) {
        j.x = x;
        j.y = y;
        codigo = dx + 1 + (dy + 1) * 3;
      }
    }
    j.grab.push(codigo);
  }

  private cruzarPortales() {
    if (!this.portales.length) return;
    for (const m of this.monos()) {
      if (m.muerto) continue;
      let dentro = 0;
      for (const p of this.portales) {
        const a = Math.hypot(m.x - p.x, m.y - p.y) < p.r;
        const b = !a && Math.hypot(m.x - p.x2, m.y - p.y2) < p.r;
        if (!a && !b) continue;
        dentro = p.id;
        if (m.portal === p.id) break;
        m.x += a ? p.x2 - p.x : p.x - p.x2;
        m.y += a ? p.y2 - p.y : p.y - p.y2;
        this.eventos.push('portal');
        break;
      }
      m.portal = dentro;
    }
  }

  private objetos() {
    const monos = this.monos();
    const vivos = () => monos.filter((m) => !m.muerto);

    for (const m of vivos()) {
      for (const b of this.botonesMalos) {
        if (Math.hypot(m.x - b.def.x, m.y - b.def.y) < b.def.r + ALCANCE_MALO) {
          b.restantes--;
          this.matar(m);
          break;
        }
      }
    }
    for (const b of this.botonesMalos) this.marcar(b, b.restantes <= 0);

    for (const p of this.placas) {
      const d = p.def;
      const en = (m: Mono) => !m.muerto && m.x > d.x && m.x < d.x + d.lado && m.y > d.y && m.y < d.y + d.lado;
      const j = en(this.jugador);
      const r = this.replicas.some(en);
      if (j && r) p.color = -1;
      else if (j) p.color = 1;
      else if (r) p.color = 2;
    }
    const c0 = this.placas[0]?.color ?? -1;
    this.placasActivas = c0 !== -1 && this.placas.every((p) => p.color === c0);

    for (const b of this.botones) {
      b.pulsados = vivos().filter((m) => Math.hypot(m.x - b.def.x, m.y - b.def.y) < b.def.r).length;
      this.marcar(b, b.pulsados >= b.def.peso);
    }

    for (const s of this.interruptores) {
      const ocupado = vivos().some((m) => Math.hypot(m.x - s.def.x, m.y - s.def.y) < s.def.r);
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

    for (const w of this.malas) this.accionar(w);
    for (const w of this.paredes) this.accionar(w);
    for (const l of this.laseres) {
      const a = this.activo(l.def.por);
      if (a != null) l.blanco = a ? !l.def.blanco : l.def.blanco;
    }

    for (const m of vivos()) {
      let enMeta = false;
      for (const g of this.metas) {
        const d = g.def;
        if (g.restantes > 0 && m.x > d.x && m.x < d.x + d.w && m.y > d.y && m.y < d.y + d.h) {
          enMeta = true;
          m.r--;
          if (m.r < 5) {
            m.muerto = true;
            g.restantes--;
            this.eventos.push('meta');
          }
          break;
        }
      }
      if (!enMeta && m.r < RADIO_NORMAL) m.r++;
    }
  }

  private marcar(b: BotonRT, activo: boolean) {
    if (activo && !b.activo) this.eventos.push('boton');
    b.activo = activo;
  }

  private accionar(w: ParedRT) {
    const a = this.activo(w.def.por);
    if (a == null) return;
    if (a !== w.def.invertida) w.abrir(w.def.abre, w.def.velAbrir);
    else w.cerrar(w.def.abre, w.def.velCerrar);
  }

  private haz(l: LaserRT) {
    const { x, y, dir } = l.def;
    const vertical = dir === 0 || dir === 2;
    let bloqueado = false;

    for (const pared of this.paredes) {
      const r = pared.rect();
      const cruza = vertical ? r.x < x + 15 && r.x + r.w > x + 25 : r.y < y + 15 && r.y + r.h > y + 25;
      if (!cruza) continue;
      const d = dir === 0 ? y - (r.y + r.h) : dir === 1 ? r.x - x : dir === 2 ? r.y - y : x - (r.x + r.w);
      if (d > LASER_CUERPO && d < l.largo) {
        l.largo = d + 1;
        bloqueado = true;
      }
    }

    const enHaz: [number, Mono][] = [];
    for (const m of this.monos()) {
      if (m.muerto) continue;
      const cruza = vertical ? m.x - m.r < x + 15 && m.x + m.r > x + 25 : m.y - m.r < y + 15 && m.y + m.r > y + 25;
      if (!cruza) continue;
      const d = dir === 0 ? y - m.y : dir === 1 ? m.x - x : dir === 2 ? m.y - y : x - m.x;
      if (d > 0) enHaz.push([d, m]);
    }
    enHaz.sort((a, b) => a[0] - b[0]);
    for (const [d, m] of enHaz) {
      if (d >= l.largo) break;
      if (m.jugador !== l.blanco) {
        l.largo = d + 1;
        bloqueado = true;
        break;
      }
      this.matar(m);
    }

    if (!bloqueado) {
      l.largo += LASER_CRECE;
      if (l.largo > LASER_MAX) l.largo -= LASER_CRECE;
    }
  }
}
