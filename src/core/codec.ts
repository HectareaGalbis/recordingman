import { Nivel, Objeto, TIPOS, crear, nivelVacio, sanear } from './level';

const VERSION = 1;
const F_REJILLA = 1;
const F_NEGATIVOS = 2;
const DESPLAZAMIENTO = 200;

class Escritor {
  b: number[] = [];
  byte(v: number) {
    this.b.push(v & 255);
  }
  num(v: number) {
    v = Math.max(0, Math.round(v));
    while (v >= 128) {
      this.b.push((v & 127) | 128);
      v = Math.floor(v / 128);
    }
    this.b.push(v);
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
  if (o.t === 'portal') c.push(o.x2, o.y2);
  return c;
}

export function codificar(nivel: Nivel): string {
  const n = sanear(nivel);
  const todas = [n.inicio.x, n.inicio.y, ...n.objetos.flatMap(coordenadas)];
  const rejilla = todas.every((v) => v % 5 === 0);
  const negativos = todas.some((v) => v < 0);
  const g = rejilla ? 5 : 1;
  const d = negativos ? DESPLAZAMIENTO : 0;
  const w = new Escritor();
  const pos = (v: number) => w.num((v + d) / g);
  const tam = (v: number) => w.num(v / g);
  const indice = new Map(n.objetos.map((o, i) => [o.id, i]));

  w.byte(VERSION);
  w.byte((rejilla ? F_REJILLA : 0) | (negativos ? F_NEGATIVOS : 0));
  w.cadena(n.nombre);
  w.cadena(n.autor);
  w.num(n.grabaciones + 1);
  pos(n.inicio.x);
  pos(n.inicio.y);
  w.num(n.objetos.length);
  for (const o of n.objetos) {
    const base = crear(o.t, 0, 0, 0) as any;
    const tipo = TIPOS.indexOf(o.t);
    const cab = (f: number) => w.byte(tipo | (f << 4));
    switch (o.t) {
      case 'pared':
      case 'paredmala': {
        const con = o.por != null;
        cab(con ? 1 | (o.invertida ? 2 : 0) | (o.abre << 2) : 0);
        pos(o.x), pos(o.y), tam(o.w), tam(o.h);
        if (con) w.num(o.velAbrir), w.num(o.velCerrar), w.num(indice.get(o.por!)!);
        break;
      }
      case 'boton':
      case 'botonmalo': {
        const fr = o.r !== base.r;
        const fp = o.peso !== 1;
        cab((fr ? 1 : 0) | (fp ? 2 : 0));
        pos(o.x), pos(o.y);
        if (fr) w.num(o.r);
        if (fp) w.num(o.peso);
        break;
      }
      case 'interruptor':
      case 'placa': {
        const v = o.t === 'placa' ? o.lado : o.r;
        const f = v !== (o.t === 'placa' ? base.lado : base.r);
        cab(f ? 1 : 0);
        pos(o.x), pos(o.y);
        if (f) w.num(v);
        break;
      }
      case 'laser':
        cab(o.dir | (o.blanco ? 4 : 0) | (o.por != null ? 8 : 0));
        pos(o.x), pos(o.y);
        if (o.por != null) w.num(indice.get(o.por)!);
        break;
      case 'portal': {
        const f = o.r !== base.r;
        cab(f ? 1 : 0);
        pos(o.x), pos(o.y), pos(o.x2), pos(o.y2);
        if (f) w.num(o.r);
        break;
      }
      case 'meta': {
        const f = o.n !== 1;
        cab(f ? 1 : 0);
        pos(o.x), pos(o.y), tam(o.w), tam(o.h);
        if (f) w.num(o.n);
        break;
      }
      case 'texto':
        cab(0);
        pos(o.x), pos(o.y);
        w.cadena(o.texto);
        break;
    }
  }
  return aBase64(new Uint8Array(w.b));
}

export function decodificar(codigo: string): Nivel {
  const r = new Lector(deBase64(codigo));
  const version = r.byte();
  if (version !== VERSION) throw new Error('Este nivel es de una versión más reciente del juego');
  const flags = r.byte();
  const g = flags & F_REJILLA ? 5 : 1;
  const d = flags & F_NEGATIVOS ? DESPLAZAMIENTO : 0;
  const pos = () => r.num() * g - d;
  const tam = () => r.num() * g;
  const n = nivelVacio();
  n.nombre = r.cadena();
  n.autor = r.cadena();
  n.grabaciones = r.num() - 1;
  n.inicio = { x: pos(), y: pos() };
  const total = r.num();
  if (total > 2000) throw new Error('Código de nivel no válido');
  const refs: { o: any; i: number }[] = [];
  for (let k = 0; k < total; k++) {
    const c = r.byte();
    const t = TIPOS[c & 15];
    const f = c >> 4;
    if (!t) throw new Error('Código de nivel no válido');
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
          o.velAbrir = r.num();
          o.velCerrar = r.num();
          refs.push({ o, i: r.num() });
        }
        break;
      case 'boton':
      case 'botonmalo':
        if (f & 1) o.r = r.num();
        if (f & 2) o.peso = r.num();
        break;
      case 'interruptor':
        if (f & 1) o.r = r.num();
        break;
      case 'placa':
        if (f & 1) o.lado = r.num();
        break;
      case 'laser':
        o.dir = f & 3;
        o.blanco = !!(f & 4);
        if (f & 8) refs.push({ o, i: r.num() });
        break;
      case 'portal':
        o.x2 = pos();
        o.y2 = pos();
        if (f & 1) o.r = r.num();
        break;
      case 'meta':
        o.w = tam();
        o.h = tam();
        if (f & 1) o.n = r.num();
        break;
      case 'texto':
        o.texto = r.cadena();
        break;
    }
    n.objetos.push(o);
  }
  for (const { o, i } of refs) o.por = i + 1;
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
