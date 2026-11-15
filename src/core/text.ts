import { DIRECCIONES, FONDO, MODOS_MOVIL, Nivel, OPERACIONES, Objeto, Operacion, Ranura, Tipo, crear, esActivador, esColor, nivelVacio, ranuras, sanear } from './level';

/*
 * Lenguaje de niveles de RecordingMan. Una instruccion por linea:
 *
 *   # comentario
 *   nombre Bolzano
 *   autor Hector Galbis
 *   fondo #fafafa
 *   inicio 650 600
 *   suelo 100 100 200x100 color=#e6e6e6              decorativo
 *   pared 50 300 350x50                              pared fija
 *   pared 50 300 350x50 abre=derecha vel=2/40 por=b1 puerta que abre el activador b1
 *   paredmala 400 0 50x200 por=b1 invertida          "invertida": se cierra al activarse
 *   boton b1 200 200 r=50
 *   botontodos t1 600 300 r=50                       solo con todos los jugadores encima
 *   interruptor i1 300 300 r=30
 *   caja 500 300 50x50
 *   puerta g1 700 300 and a=b1 b=i1                  and, or, xand, xor o not (not solo usa a=)
 *   switch s1 800 300 activo por=g1                  "activo": empieza encendido
 *   portal 100 100 > 900 500 r=30
 *   meta 1000 100 100x100 n=1
 *   texto 200 500 "Un mensaje para el jugador"
 *
 * Los identificadores (b1, t1, i1, g1, s1...) son opcionales y solo sirven para "por=", "a=" y "b=".
 */

const PREFIJO: Partial<Record<Tipo, string>> = { boton: 'b', botontodos: 't', interruptor: 'i', puerta: 'g', switch: 's', temporizador: 'r', delay: 'd' };

export function aTexto(nivel: Nivel): string {
  const L: string[] = [];
  if (nivel.nombre) L.push(`nombre ${nivel.nombre}`);
  if (nivel.autor) L.push(`autor ${nivel.autor}`);
  if (nivel.fondo !== FONDO) L.push(`fondo ${nivel.fondo}`);
  L.push(`inicio ${nivel.inicio.x} ${nivel.inicio.y} ${nivel.inicio.w}x${nivel.inicio.h}`);

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
          p.push(`abre=${DIRECCIONES[o.abre]}`, `tiempo=${o.tAbrir / 10}/${o.tCerrar / 10}`, `por=${nombres.get(o.por)}`);
          if (o.invertida) p.push('invertida');
        }
        break;
      case 'boton':
      case 'botontodos':
      case 'interruptor':
        if (o.r !== base.r) p.push(`r=${o.r}`);
        break;
      case 'suelo':
        p.push(`${o.w}x${o.h}`, `color=${o.color}`);
        break;
      case 'caja':
      case 'control':
        p.push(`${o.w}x${o.h}`);
        break;
      case 'movil':
        p.push(`${o.w}x${o.h}`);
        if (o.ruta.length) p.push(`ruta=${o.ruta.map((q) => `${q.x},${q.y}`).join(';')}`);
        p.push(`vel=${o.vel}`, `modo=${o.modo}`);
        if (o.ascensor) p.push('ascensor');
        if (!o.inicial) p.push('apagada');
        if (o.atras) p.push(`atras=${o.velAtras}`);
        if (o.por != null) p.push(`por=${nombres.get(o.por)}`);
        break;
      case 'terremoto':
        p.push(`intensidad=${o.intensidad}`, `frecuencia=${o.frecuencia}`);
        if (!o.global) p.push(`radio=${o.radio}`);
        if (o.inicial) p.push('activo');
        if (o.por != null) p.push(`por=${nombres.get(o.por)}`);
        break;
      case 'delay':
        p.push(`tiempo=${o.tiempo / 10}`);
        if (o.por != null) p.push(`por=${nombres.get(o.por)}`);
        break;
      case 'pinchos':
        p.push(`${o.w}x${o.h}`);
        if (!o.inicial) p.push('apagado');
        if (o.por != null) p.push(`por=${nombres.get(o.por)}`);
        break;
      case 'puerta':
        p.push(o.op);
        if (o.a != null) p.push(`a=${nombres.get(o.a)}`);
        if (o.b != null) p.push(`b=${nombres.get(o.b)}`);
        break;
      case 'switch':
        if (o.inicial) p.push('activo');
        if (o.por != null) p.push(`por=${nombres.get(o.por)}`);
        break;
      case 'temporizador':
        p.push(`activo=${o.activo / 10}`, `inactivo=${o.inactivo / 10}`);
        break;
      case 'meta':
        p.push(`${o.w}x${o.h}`);
        break;
      case 'texto':
        p.push(JSON.stringify(o.texto));
        break;
    }
    if ('invisible' in o && o.invisible) p.push('invisible');
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
  const pendientes: { o: Objeto; campo: Ranura; ref: string; linea: number }[] = [];
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
    if (cmd === 'fondo') {
      if (esColor(resto)) nivel.fondo = resto;
      else err('fondo espera un color como #fafafa');
      return;
    }
    const tk = trocear(resto);
    if (cmd === 'inicio') {
      const m = /^(\d+)x(\d+)$/i.exec(tk[2] ?? '');
      if (tk.length >= 2 && tk.slice(0, 2).every(esNum)) nivel.inicio = m ? { x: +tk[0], y: +tk[1], w: +m[1], h: +m[2] } : ({ x: +tk[0], y: +tk[1] } as Nivel['inicio']);
      else err('inicio espera "x y" o "x y anchoxalto"');
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
        if ((k === 'por' || k === 'a' || k === 'b') && k in o) pendientes.push({ o, campo: k, ref: v.toLowerCase(), linea: n });
        else if (k === 'color' && tipo === 'suelo' && esColor(v)) o.color = v;
        else if (k === 'abre' && 'abre' in o && dir(v) >= 0) o.abre = dir(v);
        else if (k === 'ruta' && tipo === 'movil' && /^-?\d+,-?\d+(;-?\d+,-?\d+)*$/.test(v)) o.ruta = v.split(';').map((q) => ({ x: +q.split(',')[0], y: +q.split(',')[1] }));
        else if (k === 'vel' && tipo === 'movil' && esNum(v)) o.vel = +v;
        else if (k === 'atras' && tipo === 'movil' && esNum(v)) (o.atras = true), (o.velAtras = +v);
        else if (k === 'modo' && tipo === 'movil' && (MODOS_MOVIL as readonly string[]).includes(v)) o.modo = v;
        else if (k === 'tiempo' && 'tAbrir' in o && /^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(v)) [o.tAbrir, o.tCerrar] = v.split('/').map((s) => Math.round(+s * 10));
        else if (k === 'vel' && 'tAbrir' in o && /^\d+\/\d+$/.test(v)) {
          [o.velAbrir, o.velCerrar] = v.split('/').map(Number);
          delete o.tAbrir;
          delete o.tCerrar;
        }
        else if (k === 'r' && 'r' in o && esNum(v)) o.r = +v;
        else if (k === 'radio' && tipo === 'terremoto' && esNum(v)) (o.radio = +v), (o.global = false);
        else if (k === 'n' && tipo === 'meta' && esNum(v)) continue;
        else if (k === 'tiempo' && tipo === 'delay' && esNum(v)) o.tiempo = Math.round(+v * 10);
        else if ((k === 'intensidad' || k === 'frecuencia') && tipo === 'terremoto' && esNum(v)) o[k] = +v;
        else if ((k === 'activo' || k === 'inactivo') && tipo === 'temporizador' && esNum(v)) o[k] = Math.round(+v * 10);
        else err(`"${t}" no es válido para ${tipo}`);
      } else {
        const w = t.toLowerCase();
        if (w === 'invertida' && 'invertida' in o) o.invertida = true;
        else if (w === 'invisible' && 'invisible' in o) o.invisible = true;
        else if (tipo === 'puerta' && (OPERACIONES as readonly string[]).includes(w)) o.op = w as Operacion;
        else if (tipo === 'switch' && w === 'activo') o.inicial = true;
        else if (tipo === 'pinchos' && w === 'apagado') o.inicial = false;
        else if (tipo === 'terremoto' && w === 'activo') o.inicial = true;
        else if (tipo === 'movil' && w === 'ascensor') o.ascensor = true;
        else if (tipo === 'movil' && w === 'apagada') o.inicial = false;
        else err(`no entiendo "${t}"`);
      }
    }
    const esperados = 2;
    if (nums.length < esperados) return err(`${tipo} necesita ${esperados} coordenadas`);
    o.x = nums[0];
    o.y = nums[1];
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
    else if (ranuras(p.o).includes(p.campo)) (p.o as any)[p.campo] = destino;
  }
  return { nivel: sanear(nivel), errores };
}

function esNum(s: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(s);
}

function dir(s: string): number {
  return (DIRECCIONES as readonly string[]).indexOf(s.toLowerCase());
}
