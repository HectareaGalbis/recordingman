import { decimasDesdeVel, FONDO, LIMITES, MODOS_MOVIL, Nivel, OPERACIONES, Objeto, crear, nivelVacio, sanear } from './level';

const VERSION = 2;
const F_REJILLA = 1;
const F_NEGATIVOS = 2;
const F_LEJANOS = 4;
const F_FONDO = 8;
const F_INICIO = 16;
const F_INVISIBLE = 128;
const CODIGOS = [
  'pared', 'paredmala', 'boton', 'botontodos', 'interruptor', 'portal', 'meta', 'texto', 'suelo', 'caja', 'puerta', 'switch',
  'temporizador', 'control', 'pinchos', 'delay', 'terremoto', 'movil',
] as const;
const DESPLAZAMIENTO = 200;

class Escritor {
  b: number[] = [];
  byte(v: number) {
    this.b.push(v & 255);
  }
  color(c: string) {
    const v = parseInt(c.slice(1), 16);
    this.b.push((v >> 16) & 255, (v >> 8) & 255, v & 255);
  }
  num(v: number) {
    v = Math.max(0, Math.round(v));
    while (v >= 128) {
      this.b.push((v & 127) | 128);
      v = Math.floor(v / 128);
    }
    this.b.push(v);
  }
  signo(v: number) {
    v = Math.round(v);
    this.num(v < 0 ? -2 * v - 1 : 2 * v);
  }
  cadena(s: string) {
    const u = new TextEncoder().encode(s);
    this.num(u.length);
    for (const c of u) this.b.push(c);
  }
}

class Lector {
  i = 0;
  constructor(private b: Uint8Array) {}
  byte(): number {
    if (this.i >= this.b.length) throw new Error('Código de nivel incompleto');
    return this.b[this.i++];
  }
  color(): string {
    const v = (this.byte() << 16) | (this.byte() << 8) | this.byte();
    return '#' + v.toString(16).padStart(6, '0');
  }
  num(): number {
    let v = 0;
    let m = 1;
    for (let k = 0; k < 5; k++) {
      const c = this.byte();
      v += (c & 127) * m;
      if (c < 128) return v;
      m *= 128;
    }
    throw new Error('Código de nivel no válido');
  }
  signo(): number {
    const v = this.num();
    return v % 2 ? -(v + 1) / 2 : v / 2;
  }
  cadena(): string {
    const n = this.num();
    if (this.i + n > this.b.length) throw new Error('Código de nivel incompleto');
    const s = new TextDecoder().decode(this.b.subarray(this.i, this.i + n));
    this.i += n;
    return s;
  }
}

function coordenadas(o: Objeto): number[] {
  const c = [o.x, o.y];
  if ('w' in o) c.push(o.w, o.h);
  return c;
}

export function codificar(nivel: Nivel): string {
  const n = sanear(nivel);
  const todas = [n.inicio.x, n.inicio.y, n.inicio.w, n.inicio.h, ...n.objetos.flatMap(coordenadas)];
  const rejilla = todas.every((v) => v % 5 === 0);
  const negativos = todas.some((v) => v < 0);
  const g = rejilla ? 5 : 1;
  const lejanos = todas.some((v) => v < -DESPLAZAMIENTO);
  const d = lejanos ? LIMITES.coord : negativos ? DESPLAZAMIENTO : 0;
  const w = new Escritor();
  const pos = (v: number) => w.num((v + d) / g);
  const tam = (v: number) => w.num(v / g);
  const indice = new Map(n.objetos.map((o, i) => [o.id, i]));
  const refOpcional = (id: number | null) => w.num(id == null ? 0 : indice.get(id)! + 1);
  const conFondo = n.fondo !== FONDO;

  w.byte(VERSION);
  w.byte((rejilla ? F_REJILLA : 0) | (lejanos ? F_LEJANOS : negativos ? F_NEGATIVOS : 0) | (conFondo ? F_FONDO : 0) | F_INICIO);
  w.cadena(n.nombre);
  w.cadena(n.autor);
  if (conFondo) w.color(n.fondo);
  pos(n.inicio.x);
  pos(n.inicio.y);
  tam(n.inicio.w);
  tam(n.inicio.h);
  w.num(n.objetos.length);
  for (const o of n.objetos) {
    const base = crear(o.t, 0, 0, 0) as any;
    const tipo = CODIGOS.indexOf(o.t);
    const cab = (f: number) => (w.num(tipo), w.byte(f | ('invisible' in o && o.invisible ? F_INVISIBLE : 0)));
    switch (o.t) {
      case 'pared':
      case 'paredmala': {
        const con = o.por != null;
        cab(con ? 1 | (o.invertida ? 2 : 0) | (o.abre << 2) : 0);
        pos(o.x), pos(o.y), tam(o.w), tam(o.h);
        if (con) w.num(o.tAbrir), w.num(o.tCerrar), w.num(indice.get(o.por!)!);
        break;
      }
      case 'boton':
      case 'botontodos':
      case 'interruptor': {
        const f = o.r !== base.r;
        cab(f ? 1 : 0);
        pos(o.x), pos(o.y);
        if (f) w.num(o.r);
        break;
      }
      case 'meta':
        cab(0);
        pos(o.x), pos(o.y), tam(o.w), tam(o.h);
        break;
      case 'texto':
        cab(0);
        pos(o.x), pos(o.y);
        w.cadena(o.texto);
        break;
      case 'suelo':
        cab(0);
        pos(o.x), pos(o.y), tam(o.w), tam(o.h);
        w.color(o.color);
        break;
      case 'caja':
      case 'control':
        cab(0);
        pos(o.x), pos(o.y), tam(o.w), tam(o.h);
        break;
      case 'puerta':
        cab(OPERACIONES.indexOf(o.op));
        pos(o.x), pos(o.y);
        refOpcional(o.a), refOpcional(o.b);
        break;
      case 'switch':
        cab((o.inicial ? 1 : 0) | (o.por != null ? 2 : 0));
        pos(o.x), pos(o.y);
        if (o.por != null) w.num(indice.get(o.por)!);
        break;
      case 'movil': {
        const con = o.por != null;
        cab((con ? 1 : 0) | (MODOS_MOVIL.indexOf(o.modo) << 1) | (o.ascensor ? 8 : 0) | (o.inicial ? 0 : 16) | (o.atras ? 32 : 0));
        pos(o.x), pos(o.y), tam(o.w), tam(o.h);
        w.num(o.vel);
        if (o.atras) w.num(o.velAtras);
        w.num(o.ruta.length);
        for (const p of o.ruta) w.signo(p.x), w.signo(p.y);
        if (con) w.num(indice.get(o.por!)!);
        break;
      }
      case 'terremoto': {
        const con = o.por != null;
        cab((con ? 1 : 0) | (o.inicial ? 2 : 0) | (o.global ? 0 : 4));
        pos(o.x), pos(o.y);
        w.num(o.intensidad), w.num(o.frecuencia);
        if (!o.global) w.num(o.radio);
        if (con) w.num(indice.get(o.por!)!);
        break;
      }
      case 'delay': {
        const con = o.por != null;
        cab(con ? 1 : 0);
        pos(o.x), pos(o.y);
        w.num(o.tiempo);
        if (con) w.num(indice.get(o.por!)!);
        break;
      }
      case 'pinchos': {
        const con = o.por != null;
        cab((con ? 1 : 0) | (o.inicial ? 0 : 2));
        pos(o.x), pos(o.y), tam(o.w), tam(o.h);
        if (con) w.num(indice.get(o.por!)!);
        break;
      }
      case 'temporizador':
        cab(0);
        pos(o.x), pos(o.y);
        w.num(o.activo), w.num(o.inactivo);
        break;
    }
  }
  return aBase64(new Uint8Array(w.b));
}

export function decodificar(codigo: string): Nivel {
  const r = new Lector(deBase64(codigo));
  const version = r.byte();
  if (version < 1 || version > VERSION) throw new Error('Este nivel es de una versión más reciente del juego');
  const flags = r.byte();
  const g = flags & F_REJILLA ? 5 : 1;
  const d = flags & F_LEJANOS ? LIMITES.coord : flags & F_NEGATIVOS ? DESPLAZAMIENTO : 0;
  const pos = () => r.num() * g - d;
  const tam = () => r.num() * g;
  const n = nivelVacio();
  n.nombre = r.cadena();
  n.autor = r.cadena();
  if (flags & F_FONDO) n.fondo = r.color();
  if (flags & F_INICIO) n.inicio = { x: pos(), y: pos(), w: tam(), h: tam() };
  else n.inicio = { x: pos(), y: pos() } as Nivel['inicio'];
  const total = r.num();
  if (total > 2000) throw new Error('Código de nivel no válido');
  const refs: { o: any; campo: string; i: number }[] = [];
  const refOpcional = (o: any, campo: string) => {
    const i = r.num();
    if (i) refs.push({ o, campo, i: i - 1 });
  };
  for (let k = 0; k < total; k++) {
    let t: (typeof CODIGOS)[number] | undefined;
    let f: number;
    if (version === 1) {
      const c = r.byte();
      t = CODIGOS[c & 15];
      f = c >> 4;
    } else {
      t = CODIGOS[r.num()];
      f = r.byte();
    }
    if (!t) throw new Error('Código de nivel no válido');
    if (t === 'portal') {
      pos(), pos(), pos(), pos();
      if (f & 1) r.num();
      continue;
    }
    const o = crear(t, k + 1, 0, 0) as any;
    o.x = pos();
    o.y = pos();
    switch (t) {
      case 'pared':
      case 'paredmala':
        o.w = tam();
        o.h = tam();
        if (f & 1) {
          o.invertida = !!(f & 2);
          o.abre = (f >> 2) & 3;
          o.tAbrir = version === 1 ? decimasDesdeVel(o, r.num()) : r.num();
          o.tCerrar = version === 1 ? decimasDesdeVel(o, r.num()) : r.num();
          refs.push({ o, campo: 'por', i: r.num() });
        }
        break;
      case 'boton':
      case 'botontodos':
      case 'interruptor':
        if (f & 1) o.r = r.num();
        break;
      case 'meta':
        o.w = tam();
        o.h = tam();
        if (f & 1) r.num();
        break;
      case 'texto':
        o.texto = r.cadena();
        break;
      case 'suelo':
        o.w = tam();
        o.h = tam();
        o.color = r.color();
        break;
      case 'caja':
      case 'control':
        o.w = tam();
        o.h = tam();
        break;
      case 'puerta':
        o.op = OPERACIONES[f & 7] ?? 'and';
        refOpcional(o, 'a');
        refOpcional(o, 'b');
        break;
      case 'switch':
        o.inicial = !!(f & 1);
        if (f & 2) refs.push({ o, campo: 'por', i: r.num() });
        break;
      case 'movil': {
        o.w = tam();
        o.h = tam();
        o.modo = MODOS_MOVIL[(f >> 1) & 3] ?? 'idavuelta';
        o.ascensor = !!(f & 8);
        o.inicial = !(f & 16);
        o.atras = !!(f & 32);
        o.vel = r.num();
        if (o.atras) o.velAtras = r.num();
        const puntos = r.num();
        if (puntos > LIMITES.puntosMax) throw new Error('Código de nivel no válido');
        o.ruta = Array.from({ length: puntos }, () => ({ x: r.signo(), y: r.signo() }));
        if (f & 1) refs.push({ o, campo: 'por', i: r.num() });
        break;
      }
      case 'terremoto':
        o.inicial = !!(f & 2);
        o.global = !(f & 4);
        o.intensidad = r.num();
        o.frecuencia = r.num();
        if (!o.global) o.radio = r.num();
        if (f & 1) refs.push({ o, campo: 'por', i: r.num() });
        break;
      case 'delay':
        o.tiempo = r.num();
        if (f & 1) refs.push({ o, campo: 'por', i: r.num() });
        break;
      case 'pinchos':
        o.w = tam();
        o.h = tam();
        o.inicial = !(f & 2);
        if (f & 1) refs.push({ o, campo: 'por', i: r.num() });
        break;
      case 'temporizador':
        o.activo = r.num();
        o.inactivo = r.num();
        break;
    }
    if (f & F_INVISIBLE && 'invisible' in o) o.invisible = true;
    n.objetos.push(o);
  }
  for (const { o, campo, i } of refs) o[campo] = i + 1;
  return sanear(n);
}

function aBase64(b: Uint8Array): string {
  let s = '';
  for (const c of b) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('Código de nivel no válido');
  let bin: string;
  try {
    bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    throw new Error('Código de nivel no válido');
  }
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

export const PARAMETRO = 'l';

export function aUrl(base: string, nivel: Nivel): string {
  return `${base.replace(/\/+$/, '')}/?${PARAMETRO}=${codificar(nivel)}`;
}

export function extraerCodigo(entrada: string): string | null {
  const s = entrada.trim();
  if (!s) return null;
  const m = /[?&#]l=([A-Za-z0-9_-]+)/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{8,}$/.test(s) ? s : null;
}

export function desdeUrl(entrada: string): Nivel | null {
  const c = extraerCodigo(entrada);
  if (!c) return null;
  try {
    return decodificar(c);
  } catch {
    return null;
  }
}
