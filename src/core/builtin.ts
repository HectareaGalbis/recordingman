import { Nivel } from './level';
import { desdeTexto } from './text';

interface Incluido {
  script?: string;
  texto: string;
}

const INCLUIDOS: Incluido[] = [];

export const NUM_INCLUIDOS = INCLUIDOS.length;

const cache: (Nivel | undefined)[] = [];

export function nivelIncluido(i: number): Nivel {
  if (!cache[i]) {
    const n = desdeTexto(INCLUIDOS[i].texto).nivel;
    if (INCLUIDOS[i].script) n.script = INCLUIDOS[i].script;
    cache[i] = n;
  }
  return cache[i]!;
}

export function nombreIncluido(i: number): string {
  return /^nombre (.*)$/m.exec(INCLUIDOS[i].texto)?.[1] ?? `Nivel ${i}`;
}
