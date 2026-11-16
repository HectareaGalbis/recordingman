import { NUM_INCLUIDOS, nivelIncluido } from './core/builtin';
import { codificar } from './core/codec';
import { Nivel } from './core/level';

export interface Ajustes {
  musica: boolean;
  efectos: boolean;
  autor: string;
  tema: 'auto' | 'claro' | 'oscuro';
}

export interface Favorito {
  codigo: string;
  nombre: string;
  autor: string;
}

export interface NivelPropio {
  id: string;
  nivel: Nivel;
  modificado: number;
}

export interface NivelDescargado {
  id: string;
  codigo: string;
  nombre: string;
  autor: string;
  anadido: number;
}

export interface MetaNivel {
  favorito?: boolean;
  etiquetas?: string[];
}

export const LARGO_ETIQUETA = 20;
export const MAX_ETIQUETAS = 10;

function leer<T>(clave: string, defecto: T): T {
  try {
    const s = localStorage.getItem('rm.' + clave);
    return s ? (JSON.parse(s) as T) : defecto;
  } catch {
    return defecto;
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    localStorage.setItem('rm.' + clave, JSON.stringify(valor));
  } catch {
    return;
  }
}

export const ajustes: Ajustes = { musica: true, efectos: true, autor: '', tema: 'auto', ...leer<Partial<Ajustes>>('ajustes', {}) };

export function guardarAjustes() {
  escribir('ajustes', ajustes);
}

export function progreso(): boolean[] {
  return leer<boolean[]>('progreso', []);
}

export function marcarSuperado(i: number) {
  const p = progreso();
  p[i] = true;
  escribir('progreso', p);
}

export function favoritos(): Favorito[] {
  return leer<Favorito[]>('favoritos', []);
}

export function descargados(): NivelDescargado[] {
  const lista = leer<NivelDescargado[] | null>('descargados', null);
  if (lista) return lista;
  const ahora = Date.now();
  const migrados = favoritos().map((f, i) => ({ id: nuevoId() + i, codigo: f.codigo, nombre: f.nombre, autor: f.autor, anadido: ahora - i }));
  escribir('descargados', migrados);
  if (migrados.length) {
    const m = metas();
    for (const d of migrados) m['d:' + d.id] = { favorito: true };
    escribir('meta', m);
  }
  return migrados;
}

export function guardarDescargado(codigo: string, nivel: Nivel): string {
  const clave = claveDeCodigo(codigo);
  if (clave) return clave;
  const d: NivelDescargado = { id: nuevoId(), codigo, nombre: nivel.nombre, autor: nivel.autor, anadido: Date.now() };
  escribir('descargados', [d, ...descargados()]);
  return 'd:' + d.id;
}

export function borrarDescargado(id: string) {
  escribir('descargados', descargados().filter((d) => d.id !== id));
  borrarMeta('d:' + id);
}

export function claveDeCodigo(codigo: string): string | null {
  const d = descargados().find((x) => x.codigo === codigo);
  if (d) return 'd:' + d.id;
  const p = propios().find((x) => codificar(x.nivel) === codigo);
  if (p) return 'p:' + p.id;
  for (let i = 0; i < NUM_INCLUIDOS; i++) if (codificar(nivelIncluido(i)) === codigo) return 'i:' + i;
  return null;
}

export function metas(): Record<string, MetaNivel> {
  return leer<Record<string, MetaNivel>>('meta', {});
}

export function meta(clave: string): MetaNivel {
  return metas()[clave] ?? {};
}

export function guardarMeta(clave: string, cambio: MetaNivel) {
  const m = metas();
  const nuevo = { ...m[clave], ...cambio };
  if (!nuevo.favorito && !nuevo.etiquetas?.length) delete m[clave];
  else m[clave] = nuevo;
  escribir('meta', m);
}

function borrarMeta(clave: string) {
  const m = metas();
  delete m[clave];
  escribir('meta', m);
}

export function limpiarEtiqueta(e: string): string {
  return e.replace(/\s+/g, ' ').trim().slice(0, LARGO_ETIQUETA);
}

export function todasEtiquetas(): string[] {
  const vistas = new Map<string, string>();
  for (const m of Object.values(metas())) for (const e of m.etiquetas ?? []) if (!vistas.has(e.toLowerCase())) vistas.set(e.toLowerCase(), e);
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

export function esFavorito(codigo: string): boolean {
  const clave = claveDeCodigo(codigo);
  return !!clave && !!meta(clave).favorito;
}

export function alternarFavorito(f: Favorito): boolean {
  const clave = claveDeCodigo(f.codigo) ?? guardarDescargado(f.codigo, { nombre: f.nombre, autor: f.autor } as Nivel);
  const nuevo = !meta(clave).favorito;
  guardarMeta(clave, { favorito: nuevo });
  return nuevo;
}

export function propios(): NivelPropio[] {
  return leer<NivelPropio[]>('propios', []);
}

export function guardarPropio(id: string, nivel: Nivel) {
  const lista = propios().filter((p) => p.id !== id);
  lista.unshift({ id, nivel, modificado: Date.now() });
  escribir('propios', lista);
}

export function borrarPropio(id: string) {
  escribir('propios', propios().filter((p) => p.id !== id));
  borrarMeta('p:' + id);
}

export function nuevoId(): string {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
