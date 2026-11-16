const ECC_POR_BLOQUE = [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26];
const BLOQUES = [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12];
const VERSION_MAX = 25;

function modulosDatos(v: number): number {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const a = Math.floor(v / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (v >= 7) n -= 36;
  }
  return n;
}

function palabrasDatos(v: number): number {
  return Math.floor(modulosDatos(v) / 8) - ECC_POR_BLOQUE[v] * BLOQUES[v];
}

function multiplicar(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function divisor(grado: number): number[] {
  const r = new Array(grado).fill(0);
  r[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < grado; j++) {
      r[j] = multiplicar(r[j], raiz);
      if (j + 1 < grado) r[j] ^= r[j + 1];
    }
    raiz = multiplicar(raiz, 2);
  }
  return r;
}

function resto(datos: number[], div: number[]): number[] {
  const r = new Array(div.length).fill(0);
  for (const b of datos) {
    const f = b ^ r.shift()!;
    r.push(0);
    div.forEach((d, i) => (r[i] ^= multiplicar(d, f)));
  }
  return r;
}

function posicionesAlineacion(v: number, lado: number): number[] {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const paso = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let p = lado - 7; r.length < n; p -= paso) r.splice(1, 0, p);
  return r;
}

const MASCARAS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

export function matrizQR(texto: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(texto)];
  let v = 1;
  while (v <= VERSION_MAX && 4 + (v < 10 ? 8 : 16) + bytes.length * 8 > palabrasDatos(v) * 8) v++;
  if (v > VERSION_MAX) throw new Error(`el enlace tiene ${bytes.length} caracteres y un código QR admite como máximo ${palabrasDatos(VERSION_MAX) - 3}`);

  const bits: number[] = [];
  const poner = (valor: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  const capacidad = palabrasDatos(v) * 8;
  poner(4, 4);
  poner(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) poner(b, 8);
  poner(0, Math.min(4, capacidad - bits.length));
  poner(0, (8 - (bits.length % 8)) % 8);
  for (let p = 0xec; bits.length < capacidad; p ^= 0xec ^ 0x11) poner(p, 8);
  const datos: number[] = [];
  for (let i = 0; i < bits.length; i += 8) datos.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const nBloques = BLOQUES[v];
  const eccLargo = ECC_POR_BLOQUE[v];
  const brutas = Math.floor(modulosDatos(v) / 8);
  const cortos = nBloques - (brutas % nBloques);
  const largoCorto = Math.floor(brutas / nBloques);
  const div = divisor(eccLargo);
  const bloques: number[][] = [];
  for (let i = 0, k = 0; i < nBloques; i++) {
    const d = datos.slice(k, k + largoCorto - eccLargo + (i < cortos ? 0 : 1));
    k += d.length;
    const ecc = resto(d, div);
    if (i < cortos) d.push(0);
    bloques.push(d.concat(ecc));
  }
  const palabras: number[] = [];
  for (let i = 0; i < bloques[0].length; i++) {
    bloques.forEach((b, j) => {
      if (i !== largoCorto - eccLargo || j >= cortos) palabras.push(b[i]);
    });
  }

  const lado = v * 4 + 17;
  const mod = Array.from({ length: lado }, () => new Array<boolean>(lado).fill(false));
  const fijo = Array.from({ length: lado }, () => new Array<boolean>(lado).fill(false));
  const fijar = (x: number, y: number, oscuro: boolean) => {
    mod[y][x] = oscuro;
    fijo[y][x] = true;
  };
  for (let i = 0; i < lado; i++) {
    fijar(6, i, i % 2 === 0);
    fijar(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [lado - 4, 3], [3, lado - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < lado && y >= 0 && y < lado) fijar(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const al = posicionesAlineacion(v, lado);
  al.forEach((ay, i) =>
    al.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fijar(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  const formato = (mascara: number) => {
    const d = (1 << 3) | mascara;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    const bit = (i: number) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) fijar(8, i, bit(i));
    fijar(8, 7, bit(6));
    fijar(8, 8, bit(7));
    fijar(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fijar(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fijar(lado - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fijar(8, lado - 15 + i, bit(i));
    fijar(8, lado - 8, true);
  };
  formato(0);
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) {
      const bit = ((b >>> i) & 1) === 1;
      const a = lado - 11 + (i % 3);
      const c = Math.floor(i / 3);
      fijar(a, c, bit);
      fijar(c, a, bit);
    }
  }

  let i = 0;
  for (let der = lado - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5;
    for (let vert = 0; vert < lado; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = der - j;
        const y = ((der + 1) & 2) === 0 ? lado - 1 - vert : vert;
        if (!fijo[y][x] && i < palabras.length * 8) {
          mod[y][x] = ((palabras[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }

  const aplicar = (m: number) => {
    for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) if (!fijo[y][x] && MASCARAS[m](x, y)) mod[y][x] = !mod[y][x];
  };
  const penalizacion = () => {
    let p = 0;
    for (let k = 0; k < 2; k++) {
      for (let a = 0; a < lado; a++) {
        let racha = 1;
        for (let b = 1; b <= lado; b++) {
          const igual = b < lado && (k ? mod[b][a] === mod[b - 1][a] : mod[a][b] === mod[a][b - 1]);
          if (igual) racha++;
          else {
            if (racha >= 5) p += racha - 2;
            racha = 1;
          }
        }
      }
    }
    let oscuros = 0;
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        if (mod[y][x]) oscuros++;
        if (x < lado - 1 && y < lado - 1 && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
      }
    }
    return p + Math.floor(Math.abs(oscuros * 20 - lado * lado * 10) / (lado * lado)) * 10;
  };
  let mejor = 0;
  let minimo = Infinity;
  for (let m = 0; m < 8; m++) {
    aplicar(m);
    formato(m);
    const p = penalizacion();
    if (p < minimo) (minimo = p), (mejor = m);
    aplicar(m);
  }
  aplicar(mejor);
  formato(mejor);
  return mod;
}

export function svgQR(texto: string, margen = 4): string {
  const m = matrizQR(texto);
  const lado = m.length + margen * 2;
  let camino = '';
  m.forEach((fila, y) => fila.forEach((o, x) => o && (camino += `M${x + margen} ${y + margen}h1v1h-1z`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="${lado}" height="${lado}" fill="#ffffff"/><path d="${camino}" fill="#111111"/></svg>`;
}
