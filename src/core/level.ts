export const ANCHO = 1300;
export const ALTO = 680;

export const ARRIBA = 0;
export const DERECHA = 1;
export const ABAJO = 2;
export const IZQUIERDA = 3;
export const DIRECCIONES = ['arriba', 'derecha', 'abajo', 'izquierda'] as const;

export interface ParedDef {
  t: 'pared' | 'paredmala';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  abre: number;
  velAbrir: number;
  velCerrar: number;
  invertida: boolean;
  por: number | null;
}

export interface BotonDef {
  t: 'boton' | 'botonmalo';
  id: number;
  x: number;
  y: number;
  r: number;
  peso: number;
}

export interface InterruptorDef {
  t: 'interruptor';
  id: number;
  x: number;
  y: number;
  r: number;
}

export interface PlacaDef {
  t: 'placa';
  id: number;
  x: number;
  y: number;
  lado: number;
}

export interface LaserDef {
  t: 'laser';
  id: number;
  x: number;
  y: number;
  dir: number;
  blanco: boolean;
  por: number | null;
}

export interface PortalDef {
  t: 'portal';
  id: number;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
}

export interface MetaDef {
  t: 'meta';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  n: number;
}

export interface TextoDef {
  t: 'texto';
  id: number;
  x: number;
  y: number;
  texto: string;
}

export type Objeto =
  | ParedDef
  | BotonDef
  | InterruptorDef
  | PlacaDef
  | LaserDef
  | PortalDef
  | MetaDef
  | TextoDef;

export type Tipo = Objeto['t'];

export const TIPOS: Tipo[] = [
  'pared',
  'paredmala',
  'boton',
  'botonmalo',
  'interruptor',
  'placa',
  'laser',
  'portal',
  'meta',
  'texto',
];

export const NOMBRES_TIPO: Record<Tipo, string> = {
  pared: 'Pared',
  paredmala: 'Pared mala',
  boton: 'Botón',
  botonmalo: 'Botón malo',
  interruptor: 'Interruptor',
  placa: 'Placa',
  laser: 'Láser',
  portal: 'Portal',
  meta: 'Meta',
  texto: 'Texto',
};

export interface Nivel {
  nombre: string;
  autor: string;
  grabaciones: number;
  inicio: { x: number; y: number };
  objetos: Objeto[];
  script?: string;
}

export const LIMITES = {
  nombre: 40,
  autor: 30,
  texto: 120,
  objetos: 400,
  grabaciones: 99,
  radioMin: 25,
  radioMax: 125,
  ladoMin: 50,
  ladoMax: 200,
  metaMin: 50,
  metaMax: 250,
  paredMin: 10,
  vel: 60,
  peso: 20,
};

export function nivelVacio(): Nivel {
  return { nombre: '', autor: '', grabaciones: -1, inicio: { x: 650, y: 340 }, objetos: [] };
}

export function clonar(n: Nivel): Nivel {
  return JSON.parse(JSON.stringify(n));
}

export function siguienteId(n: Nivel): number {
  let m = 0;
  for (const o of n.objetos) if (o.id > m) m = o.id;
  return m + 1;
}

export function esActivador(o: Objeto): o is BotonDef | InterruptorDef | PlacaDef {
  return o.t === 'boton' || o.t === 'botonmalo' || o.t === 'interruptor' || o.t === 'placa';
}

export function esReceptor(o: Objeto): o is ParedDef | LaserDef {
  return o.t === 'pared' || o.t === 'paredmala' || o.t === 'laser';
}

export function crear(t: Tipo, id: number, x: number, y: number): Objeto {
  switch (t) {
    case 'pared':
    case 'paredmala':
      return { t, id, x, y, w: 50, h: 50, abre: ARRIBA, velAbrir: 2, velCerrar: 20, invertida: false, por: null };
    case 'boton':
    case 'botonmalo':
      return { t, id, x, y, r: 50, peso: 1 };
    case 'interruptor':
      return { t, id, x, y, r: 30 };
    case 'placa':
      return { t, id, x, y, lado: 50 };
    case 'laser':
      return { t, id, x, y, dir: ABAJO, blanco: false, por: null };
    case 'portal':
      return { t, id, x, y, x2: x + 150, y2: y, r: 30 };
    case 'meta':
      return { t, id, x, y, w: 100, h: 100, n: 1 };
    case 'texto':
      return { t, id, x, y, texto: 'Texto' };
  }
}

function lim(v: unknown, min: number, max: number, def: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function sanear(n: Nivel): Nivel {
  const L = LIMITES;
  const res: Nivel = {
    nombre: String(n.nombre ?? '').slice(0, L.nombre),
    autor: String(n.autor ?? '').slice(0, L.autor),
    grabaciones: lim(n.grabaciones, -1, L.grabaciones, -1),
    inicio: { x: lim(n.inicio?.x, 0, ANCHO, 650), y: lim(n.inicio?.y, 0, ALTO, 340) },
    objetos: [],
  };
  if (n.script) res.script = n.script;
  const X = (v: unknown) => lim(v, -200, ANCHO + 200, 0);
  const Y = (v: unknown) => lim(v, -200, ALTO + 200, 0);
  const vistos = new Set<number>();
  for (const o of (n.objetos ?? []).slice(0, L.objetos)) {
    let id = lim(o.id, 1, 100000, 0);
    if (!id || vistos.has(id)) id = Math.max(0, ...vistos) + 1;
    vistos.add(id);
    switch (o.t) {
      case 'pared':
      case 'paredmala':
        res.objetos.push({
          t: o.t, id, x: X(o.x), y: Y(o.y),
          w: lim(o.w, L.paredMin, 2000, 50), h: lim(o.h, L.paredMin, 2000, 50),
          abre: lim(o.abre, 0, 3, 0), velAbrir: lim(o.velAbrir, 0, L.vel, 2), velCerrar: lim(o.velCerrar, 0, L.vel, 20),
          invertida: !!o.invertida, por: o.por == null ? null : Number(o.por),
        });
        break;
      case 'boton':
      case 'botonmalo':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), r: lim(o.r, L.radioMin, L.radioMax, 50), peso: lim(o.peso, 1, L.peso, 1) });
        break;
      case 'interruptor':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), r: lim(o.r, L.radioMin, L.radioMax, 30) });
        break;
      case 'placa':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), lado: lim(o.lado, L.ladoMin, L.ladoMax, 50) });
        break;
      case 'laser':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), dir: lim(o.dir, 0, 3, 2), blanco: !!o.blanco, por: o.por == null ? null : Number(o.por) });
        break;
      case 'portal':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), x2: X(o.x2), y2: Y(o.y2), r: lim(o.r, L.radioMin, L.radioMax, 30) });
        break;
      case 'meta':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), w: lim(o.w, L.metaMin, L.metaMax, 100), h: lim(o.h, L.metaMin, L.metaMax, 100), n: lim(o.n, 1, L.peso, 1) });
        break;
      case 'texto':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), texto: String(o.texto ?? '').slice(0, L.texto) });
        break;
    }
  }
  const activadores = new Set(res.objetos.filter(esActivador).map((o) => o.id));
  for (const o of res.objetos) if (esReceptor(o) && o.por != null && !activadores.has(o.por)) o.por = null;
  return res;
}
