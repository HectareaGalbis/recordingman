import { Nivel } from './core/level';

export interface Ajustes {
  musica: boolean;
  efectos: boolean;
  autor: string;
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

export const ajustes: Ajustes = { musica: true, efectos: true, autor: '', ...leer<Partial<Ajustes>>('ajustes', {}) };

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

export function esFavorito(codigo: string): boolean {
  return favoritos().some((f) => f.codigo === codigo);
}

export function alternarFavorito(f: Favorito): boolean {
  const lista = favoritos();
  const i = lista.findIndex((x) => x.codigo === f.codigo);
  if (i >= 0) lista.splice(i, 1);
  else lista.unshift(f);
  escribir('favoritos', lista);
  return i < 0;
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
}

export function nuevoId(): string {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
