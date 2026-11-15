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
  tAbrir: number;
  tCerrar: number;
  invertida: boolean;
  por: number | null;
}

export interface BotonDef {
  t: 'boton' | 'botontodos';
  id: number;
  x: number;
  y: number;
  r: number;
}

export interface InterruptorDef {
  t: 'interruptor';
  id: number;
  x: number;
  y: number;
  r: number;
}

export interface MetaDef {
  t: 'meta';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextoDef {
  t: 'texto';
  id: number;
  x: number;
  y: number;
  texto: string;
}

export interface SueloDef {
  t: 'suelo';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface CajaDef {
  t: 'caja';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OPERACIONES = ['and', 'or', 'xand', 'xor', 'not'] as const;
export type Operacion = (typeof OPERACIONES)[number];

export interface PuertaDef {
  t: 'puerta';
  id: number;
  x: number;
  y: number;
  op: Operacion;
  a: number | null;
  b: number | null;
  invisible: boolean;
}

export interface SwitchDef {
  t: 'switch';
  id: number;
  x: number;
  y: number;
  inicial: boolean;
  por: number | null;
  invisible: boolean;
}

export interface TemporizadorDef {
  t: 'temporizador';
  id: number;
  x: number;
  y: number;
  activo: number;
  inactivo: number;
  invisible: boolean;
}

export interface ControlDef {
  t: 'control';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PinchosDef {
  t: 'pinchos';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  inicial: boolean;
  por: number | null;
}

export interface DelayDef {
  t: 'delay';
  id: number;
  x: number;
  y: number;
  tiempo: number;
  por: number | null;
  invisible: boolean;
}

export interface TerremotoDef {
  t: 'terremoto';
  id: number;
  x: number;
  y: number;
  intensidad: number;
  frecuencia: number;
  inicial: boolean;
  global: boolean;
  radio: number;
  por: number | null;
  invisible: boolean;
}

export const MODOS_MOVIL = ['idavuelta', 'bucle', 'una'] as const;
export type ModoMovil = (typeof MODOS_MOVIL)[number];

export interface MovilDef {
  t: 'movil';
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  ruta: { x: number; y: number }[];
  vel: number;
  modo: ModoMovil;
  ascensor: boolean;
  inicial: boolean;
  atras: boolean;
  velAtras: number;
  por: number | null;
}

export type Objeto =
  | ParedDef
  | BotonDef
  | InterruptorDef
  | MetaDef
  | TextoDef
  | SueloDef
  | CajaDef
  | PuertaDef
  | SwitchDef
  | TemporizadorDef
  | ControlDef
  | PinchosDef
  | DelayDef
  | TerremotoDef
  | MovilDef;

export type Tipo = Objeto['t'];

export const TIPOS: Tipo[] = [
  'pared',
  'paredmala',
  'boton',
  'botontodos',
  'interruptor',
  'meta',
  'texto',
  'suelo',
  'caja',
  'puerta',
  'switch',
  'temporizador',
  'control',
  'pinchos',
  'delay',
  'terremoto',
  'movil',
];

export const NOMBRES_TIPO: Record<Tipo, string> = {
  pared: 'Pared',
  paredmala: 'Pared mala',
  boton: 'Botón',
  botontodos: 'Botón de todos',
  interruptor: 'Interruptor',
  meta: 'Meta',
  texto: 'Texto',
  suelo: 'Suelo',
  caja: 'Caja',
  puerta: 'Puerta lógica',
  switch: 'Switch',
  temporizador: 'Temporizador',
  control: 'Punto de control',
  pinchos: 'Pinchos',
  delay: 'Delay',
  terremoto: 'Terremoto',
  movil: 'Plataforma móvil',
};

export const FONDO = '#fafafa';
export const TAM_LOGICA = 50;
export const TAM_INICIO = 100;
export const SEPARACION_INICIO = 25;

export interface Nivel {
  nombre: string;
  autor: string;
  fondo: string;
  inicio: { x: number; y: number; w: number; h: number };
  objetos: Objeto[];
  script?: string;
}

export const LIMITES = {
  nombre: 40,
  autor: 30,
  texto: 120,
  objetos: 400,
  coord: 10000,
  radioMin: 25,
  radioMax: 125,
  metaMin: 50,
  metaMax: 250,
  paredMin: 10,
  sueloMin: 25,
  cajaMin: 50,
  cajaMax: 200,
  vel: 60,
  peso: 20,
  tiempoMin: 1,
  tiempoMax: 600,
  inicioMin: 100,
  intensidadMax: 60,
  frecuenciaMax: 30,
  alcanceMin: 50,
  alcanceMax: 3000,
  velMovilMax: 2000,
  puntosMax: 50,
};

export function decimasDesdeVel(o: { w: number; h: number; abre: number }, vel: number): number {
  if (!(vel > 0)) return LIMITES.tiempoMax;
  const distancia = Math.max(0, (o.abre % 2 === 0 ? o.h : o.w) - LIMITES.paredMin);
  return Math.min(LIMITES.tiempoMax, Math.round(distancia / vel / 4));
}

export function trasladar<T extends Objeto>(o: T, dx: number, dy: number): T {
  o.x += dx;
  o.y += dy;
  return o;
}

export interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function zonasObjeto(o: Objeto): Caja[] {
  if ('w' in o) return [{ x: o.x, y: o.y, w: o.w, h: o.h }];
  if ('r' in o) return [{ x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 }];
  if (o.t === 'puerta' || o.t === 'switch' || o.t === 'temporizador' || o.t === 'delay' || o.t === 'terremoto') {
    return [{ x: o.x - TAM_LOGICA / 2, y: o.y - TAM_LOGICA / 2, w: TAM_LOGICA, h: TAM_LOGICA }];
  }
  return [{ x: o.x, y: o.y, w: 1, h: 1 }];
}

export function miembrosMoviles(n: Nivel): Map<number, Objeto[]> {
  const res = new Map<number, Objeto[]>();
  const usados = new Set<number>();
  for (const m of n.objetos) {
    if (m.t !== 'movil') continue;
    const lista: Objeto[] = [];
    for (const o of n.objetos) {
      if (o.t === 'movil' || o.t === 'caja' || usados.has(o.id)) continue;
      const toca = zonasObjeto(o).some((z) => z.x < m.x + m.w && z.x + z.w > m.x && z.y < m.y + m.h && z.y + z.h > m.y);
      if (toca) {
        lista.push(o);
        usados.add(o.id);
      }
    }
    res.set(m.id, lista);
  }
  return res;
}

export function nivelVacio(): Nivel {
  return { nombre: '', autor: '', fondo: FONDO, inicio: { x: 600, y: 290, w: TAM_INICIO, h: TAM_INICIO }, objetos: [] };
}

export function puntoInicio(n: Nivel): { x: number; y: number } {
  return { x: n.inicio.x + n.inicio.w / 2 + SEPARACION_INICIO, y: n.inicio.y + n.inicio.h / 2 };
}

export function clonar(n: Nivel): Nivel {
  return JSON.parse(JSON.stringify(n));
}

export function siguienteId(n: Nivel): number {
  let m = 0;
  for (const o of n.objetos) if (o.id > m) m = o.id;
  return m + 1;
}

export function esActivador(o: Objeto): o is BotonDef | InterruptorDef | PuertaDef | SwitchDef | TemporizadorDef | DelayDef {
  return o.t === 'boton' || o.t === 'botontodos' || o.t === 'interruptor' || o.t === 'puerta' || o.t === 'switch' || o.t === 'temporizador' || o.t === 'delay';
}

export type Ranura = 'por' | 'a' | 'b';

export function ranuras(o: Objeto): Ranura[] {
  if (o.t === 'pared' || o.t === 'paredmala' || o.t === 'switch' || o.t === 'pinchos' || o.t === 'delay' || o.t === 'terremoto' || o.t === 'movil') return ['por'];
  if (o.t === 'puerta') return o.op === 'not' ? ['a'] : ['a', 'b'];
  return [];
}

export function esReceptor(o: Objeto): o is ParedDef | PuertaDef | SwitchDef | PinchosDef | DelayDef | TerremotoDef | MovilDef {
  return ranuras(o).length > 0;
}

export function esColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

export function crear(t: Tipo, id: number, x: number, y: number): Objeto {
  switch (t) {
    case 'pared':
    case 'paredmala':
      return { t, id, x, y, w: 50, h: 50, abre: ARRIBA, tAbrir: 5, tCerrar: 1, invertida: false, por: null };
    case 'boton':
    case 'botontodos':
      return { t, id, x, y, r: 50 };
    case 'interruptor':
      return { t, id, x, y, r: 30 };
    case 'meta':
      return { t, id, x, y, w: 100, h: 100 };
    case 'texto':
      return { t, id, x, y, texto: 'Texto' };
    case 'suelo':
      return { t, id, x, y, w: 100, h: 100, color: '#e6e6e6' };
    case 'caja':
      return { t, id, x, y, w: 50, h: 50 };
    case 'puerta':
      return { t, id, x, y, op: 'and', a: null, b: null, invisible: false };
    case 'switch':
      return { t, id, x, y, inicial: false, por: null, invisible: false };
    case 'temporizador':
      return { t, id, x, y, activo: 10, inactivo: 10, invisible: false };
    case 'control':
      return { t, id, x, y, w: 100, h: 100 };
    case 'pinchos':
      return { t, id, x, y, w: 100, h: 50, inicial: true, por: null };
    case 'delay':
      return { t, id, x, y, tiempo: 10, por: null, invisible: false };
    case 'movil':
      return { t, id, x, y, w: 100, h: 100, ruta: [{ x: 200, y: 0 }], vel: 100, modo: 'idavuelta', ascensor: false, inicial: true, atras: false, velAtras: 100, por: null };
    case 'terremoto':
      return { t, id, x, y, intensidad: 10, frecuencia: 15, inicial: false, global: true, radio: 300, por: null, invisible: false };
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
    fondo: esColor(n.fondo) ? n.fondo.toLowerCase() : FONDO,
    inicio: { x: 600, y: 290, w: TAM_INICIO, h: TAM_INICIO },
    objetos: [],
  };
  const ini = (n.inicio ?? {}) as Partial<Nivel['inicio']>;
  const antiguo = ini.w == null;
  const centro = antiguo ? TAM_INICIO / 2 : 0;
  res.inicio = {
    x: lim(Number(ini.x) - centro, -L.coord, L.coord, 600),
    y: lim(Number(ini.y) - centro, -L.coord, L.coord, 290),
    w: antiguo ? TAM_INICIO : lim(ini.w, L.inicioMin, 2000, TAM_INICIO),
    h: antiguo ? TAM_INICIO : lim(ini.h, L.inicioMin, 2000, TAM_INICIO),
  };
  if (n.script) res.script = n.script;
  const X = (v: unknown) => lim(v, -L.coord, L.coord, 0);
  const Y = (v: unknown) => lim(v, -L.coord, L.coord, 0);
  const ref = (v: unknown) => (v == null ? null : Number(v));
  const vistos = new Set<number>();
  for (const o of (n.objetos ?? []).slice(0, L.objetos)) {
    let id = lim(o.id, 1, 100000, 0);
    if (!id || vistos.has(id)) id = Math.max(0, ...vistos) + 1;
    vistos.add(id);
    switch (o.t) {
      case 'pared':
      case 'paredmala': {
        const base = { w: lim(o.w, L.paredMin, 2000, 50), h: lim(o.h, L.paredMin, 2000, 50), abre: lim(o.abre, 0, 3, 0) };
        const viejo = o as unknown as { velAbrir?: number; velCerrar?: number };
        const tiempo = (t: unknown, vel: unknown, def: number) =>
          t != null ? lim(t, 0, L.tiempoMax, def) : vel != null ? decimasDesdeVel(base, Number(vel)) : def;
        res.objetos.push({
          t: o.t, id, x: X(o.x), y: Y(o.y), ...base,
          tAbrir: tiempo(o.tAbrir, viejo.velAbrir, 5), tCerrar: tiempo(o.tCerrar, viejo.velCerrar, 1),
          invertida: !!o.invertida, por: ref(o.por),
        });
        break;
      }
      case 'boton':
      case 'botontodos':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), r: lim(o.r, L.radioMin, L.radioMax, 50) });
        break;
      case 'interruptor':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), r: lim(o.r, L.radioMin, L.radioMax, 30) });
        break;
      case 'meta':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), w: lim(o.w, L.metaMin, L.metaMax, 100), h: lim(o.h, L.metaMin, L.metaMax, 100) });
        break;
      case 'texto':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), texto: String(o.texto ?? '').slice(0, L.texto) });
        break;
      case 'suelo':
        res.objetos.push({
          t: o.t, id, x: X(o.x), y: Y(o.y), w: lim(o.w, L.sueloMin, 2000, 100), h: lim(o.h, L.sueloMin, 2000, 100),
          color: esColor(o.color) ? o.color.toLowerCase() : '#e6e6e6',
        });
        break;
      case 'movil': {
        const ruta = (Array.isArray(o.ruta) ? o.ruta : []).slice(0, L.puntosMax).map((p) => ({
          x: lim(p?.x, -2 * L.coord, 2 * L.coord, 0),
          y: lim(p?.y, -2 * L.coord, 2 * L.coord, 0),
        }));
        res.objetos.push({
          t: o.t, id, x: X(o.x), y: Y(o.y), w: lim(o.w, L.sueloMin, 2000, 100), h: lim(o.h, L.sueloMin, 2000, 100),
          ruta, vel: lim(o.vel, 1, L.velMovilMax, 100), modo: MODOS_MOVIL.includes(o.modo) ? o.modo : 'idavuelta',
          ascensor: !!o.ascensor, inicial: o.inicial !== false, atras: !!o.atras, velAtras: lim(o.velAtras, 1, L.velMovilMax, 100), por: ref(o.por),
        });
        break;
      }
      case 'terremoto':
        res.objetos.push({
          t: o.t, id, x: X(o.x), y: Y(o.y),
          intensidad: lim(o.intensidad, 1, L.intensidadMax, 10), frecuencia: lim(o.frecuencia, 1, L.frecuenciaMax, 15),
          inicial: !!o.inicial, global: o.global !== false, radio: lim(o.radio, L.alcanceMin, L.alcanceMax, 300), por: ref(o.por), invisible: !!o.invisible,
        });
        break;
      case 'delay':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), tiempo: lim(o.tiempo, L.tiempoMin, L.tiempoMax, 10), por: ref(o.por), invisible: !!o.invisible });
        break;
      case 'pinchos':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), w: lim(o.w, L.sueloMin, 2000, 100), h: lim(o.h, L.sueloMin, 2000, 50), inicial: o.inicial !== false, por: ref(o.por) });
        break;
      case 'control':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), w: lim(o.w, L.sueloMin, 2000, 100), h: lim(o.h, L.sueloMin, 2000, 100) });
        break;
      case 'caja':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), w: lim(o.w, L.cajaMin, L.cajaMax, 50), h: lim(o.h, L.cajaMin, L.cajaMax, 50) });
        break;
      case 'puerta': {
        const op = OPERACIONES.includes(o.op) ? o.op : 'and';
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), op, a: ref(o.a), b: op === 'not' ? null : ref(o.b), invisible: !!o.invisible });
        break;
      }
      case 'switch':
        res.objetos.push({ t: o.t, id, x: X(o.x), y: Y(o.y), inicial: !!o.inicial, por: ref(o.por), invisible: !!o.invisible });
        break;
      case 'temporizador':
        res.objetos.push({
          t: o.t, id, x: X(o.x), y: Y(o.y),
          activo: lim(o.activo, L.tiempoMin, L.tiempoMax, 10), inactivo: lim(o.inactivo, L.tiempoMin, L.tiempoMax, 10), invisible: !!o.invisible,
        });
        break;
    }
  }
  const activadores = new Set(res.objetos.filter(esActivador).map((o) => o.id));
  for (const o of res.objetos) {
    const libre = o as unknown as Record<Ranura, number | null>;
    for (const r of ranuras(o)) if (libre[r] != null && (libre[r] === o.id || !activadores.has(libre[r]!))) libre[r] = null;
  }
  return res;
}
