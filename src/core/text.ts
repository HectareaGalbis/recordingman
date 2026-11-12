import { DIRECCIONES, Nivel, Objeto, Tipo, crear, esActivador, esReceptor, nivelVacio, sanear } from './level';

/*
 * Lenguaje de niveles de RecordingMan. Una instruccion por linea:
 *
 *   # comentario
 *   nombre Bolzano
 *   autor Hector Galbis
 *   grabaciones 3            (o "inf")
 *   inicio 650 600
 *   pared 50 300 350x50                              pared fija
 *   pared 50 300 350x50 abre=derecha vel=2/40 por=b1 puerta que abre el activador b1
 *   paredmala 400 0 50x200 por=b1 invertida          "invertida": se cierra al activarse
 *   boton b1 200 200 r=50 peso=1
 *   botonmalo m1 600 300 r=50 peso=2
 *   interruptor i1 300 300 r=30
 *   placa p1 100 100 lado=50
 *   laser 500 0 abajo blanco por=i1
 *   portal 100 100 > 900 500 r=30
 *   meta 1000 100 100x100 n=1
 *   texto 200 500 "Un mensaje para el jugador"
 *
 * Los identificadores (b1, m1, i1, p1...) son opcionales y solo sirven para "por=".
 */

const PREFIJO: Partial<Record<Tipo, string>> = { boton: 'b', botonmalo: 'm', interruptor: 'i', placa: 'p' };

export function aTexto(nivel: Nivel): string {
  const L: string[] = [];
  if (nivel.nombre) L.push(`nombre ${nivel.nombre}`);
  if (nivel.autor) L.push(`autor ${nivel.autor}`);
  L.push(`grabaciones ${nivel.grabaciones < 0 ? 'inf' : nivel.grabaciones}`);
  L.push(`inicio ${nivel.inicio.x} ${nivel.inicio.y}`);

  const nombres = new Map<number, string>();
  const cuenta: Record<string, number> = {};
  for (const o of nivel.objetos) {
    const p = PREFIJO[o.t];
    if (p) {
      cuenta[p] = (cuenta[p] ?? 0) + 1;
      nombres.set(o.id, p + cuenta[p]);
    }
  }

  for (const o of nivel.objetos) {
    const base = crear(o.t, 0, 0, 0) as any;
    const p: string[] = [o.t];
    if (esActivador(o)) p.push(nombres.get(o.id)!);
    p.push(String(o.x), String(o.y));
    switch (o.t) {
      case 'pared':
      case 'paredmala':
        p.push(`${o.w}x${o.h}`);
        if (o.por != null) {
          p.push(`abre=${DIRECCIONES[o.abre]}`, `vel=${o.velAbrir}/${o.velCerrar}`, `por=${nombres.get(o.por)}`);
          if (o.invertida) p.push('invertida');
        }
        break;
      case 'boton':
      case 'botonmalo':
        if (o.r !== base.r) p.push(`r=${o.r}`);
        if (o.peso !== 1) p.push(`peso=${o.peso}`);
        break;
      case 'interruptor':
        if (o.r !== base.r) p.push(`r=${o.r}`);
        break;
      case 'placa':
        if (o.lado !== base.lado) p.push(`lado=${o.lado}`);
        break;
      case 'laser':
        p.push(DIRECCIONES[o.dir]);
        if (o.blanco) p.push('blanco');
        if (o.por != null) p.push(`por=${nombres.get(o.por)}`);
        break;
      case 'portal':
        p.push('>', String(o.x2), String(o.y2));
        if (o.r !== base.r) p.push(`r=${o.r}`);
        break;
      case 'meta':
        p.push(`${o.w}x${o.h}`);
        if (o.n !== 1) p.push(`n=${o.n}`);
        break;
      case 'texto':
        p.push(JSON.stringify(o.texto));
        break;
    }
    L.push(p.join(' '));
  }
  return L.join('\n') + '\n';
}

export interface ResultadoTexto {
  nivel: Nivel;
  errores: string[];
}

function trocear(linea: string): string[] {
  const res: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linea))) {
    if (m[1] !== undefined) {
      let s = m[1];
      try {
        s = JSON.parse(`"${m[1]}"`);
      } catch {
        /* se deja tal cual */
      }
      res.push('"' + s);
    } else res.push(m[2]);
  }
  return res;
}

export function desdeTexto(texto: string): ResultadoTexto {
  const nivel = nivelVacio();
  const errores: string[] = [];
  const ids = new Map<string, number>();
  const pendientes: { o: Objeto; ref: string; linea: number }[] = [];
  let id = 1;

  texto.split(/\r?\n/).forEach((cruda, i) => {
    const n = i + 1;
    const linea = cruda.trim();
    if (!linea || linea.startsWith('#')) return;
    const esp = linea.search(/\s/);
    const cmd = (esp < 0 ? linea : linea.slice(0, esp)).toLowerCase();
    const resto = esp < 0 ? '' : linea.slice(esp).trim();
    const err = (m: string) => errores.push(`Línea ${n}: ${m}`);

    if (cmd === 'nombre') return void (nivel.nombre = resto);
    if (cmd === 'autor') return void (nivel.autor = resto);
    if (cmd === 'grabaciones') {
      if (/^(inf|ilimitadas|-1)$/i.test(resto)) nivel.grabaciones = -1;
      else if (/^\d+$/.test(resto)) nivel.grabaciones = parseInt(resto, 10);
      else err('grabaciones espera un número o "inf"');
      return;
    }
    const tk = trocear(resto);
    if (cmd === 'inicio') {
      if (tk.length >= 2 && tk.slice(0, 2).every(esNum)) nivel.inicio = { x: +tk[0], y: +tk[1] };
      else err('inicio espera "x y"');
      return;
    }
    const tipo = cmd as Tipo;
    const o = crear(tipo, id, 0, 0) as any;
    if (!o) return err(`instrucción desconocida "${cmd}"`);

    let nombre: string | null = null;
    if (tk.length && esActivador(o) && !esNum(tk[0])) nombre = tk.shift()!.toLowerCase();
    const nums: number[] = [];
    for (const t of tk) {
      let m: RegExpExecArray | null;
      if (t.startsWith('"')) {
        if (tipo === 'texto') o.texto = t.slice(1);
        else err('texto inesperado');
      } else if (esNum(t)) nums.push(+t);
      else if (t === '>') continue;
      else if ((m = /^(-?\d+)x(-?\d+)$/i.exec(t))) {
        if ('w' in o) (o.w = +m[1]), (o.h = +m[2]);
        else err(`"${t}" no aplica a ${tipo}`);
      } else if ((m = /^(\w+)=(.+)$/.exec(t))) {
        const k = m[1].toLowerCase();
        const v = m[2];
        if (k === 'por' && esReceptor(o)) pendientes.push({ o, ref: v.toLowerCase(), linea: n });
        else if (k === 'abre' && 'abre' in o && dir(v) >= 0) o.abre = dir(v);
        else if (k === 'dir' && tipo === 'laser' && dir(v) >= 0) o.dir = dir(v);
        else if (k === 'vel' && 'velAbrir' in o && /^\d+\/\d+$/.test(v)) [o.velAbrir, o.velCerrar] = v.split('/').map(Number);
        else if (k === 'r' && 'r' in o && esNum(v)) o.r = +v;
        else if (k === 'peso' && 'peso' in o && esNum(v)) o.peso = +v;
        else if (k === 'lado' && tipo === 'placa' && esNum(v)) o.lado = +v;
        else if (k === 'n' && tipo === 'meta' && esNum(v)) o.n = +v;
        else err(`"${t}" no es válido para ${tipo}`);
      } else {
        const w = t.toLowerCase();
        if (w === 'invertida' && 'invertida' in o) o.invertida = true;
        else if (tipo === 'laser' && (w === 'blanco' || w === 'negro')) o.blanco = w === 'blanco';
        else if (tipo === 'laser' && dir(w) >= 0) o.dir = dir(w);
        else err(`no entiendo "${t}"`);
      }
    }
    const esperados = tipo === 'portal' ? 4 : 2;
    if (nums.length < esperados) return err(`${tipo} necesita ${esperados} coordenadas`);
    o.x = nums[0];
    o.y = nums[1];
    if (tipo === 'portal') (o.x2 = nums[2]), (o.y2 = nums[3]);
    if (nombre) {
      if (ids.has(nombre)) err(`el identificador "${nombre}" está repetido`);
      ids.set(nombre, id);
    }
    nivel.objetos.push(o);
    id++;
  });

  for (const p of pendientes) {
    const destino = ids.get(p.ref);
    if (destino == null) errores.push(`Línea ${p.linea}: no existe el activador "${p.ref}"`);
    else (p.o as any).por = destino;
  }
  return { nivel: sanear(nivel), errores };
}

function esNum(s: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(s);
}

function dir(s: string): number {
  return (DIRECCIONES as readonly string[]).indexOf(s.toLowerCase());
}
