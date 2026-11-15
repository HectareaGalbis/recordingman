import { ponerMusica } from './audio';
import { URL_COMPARTIR } from './config';
import { decodificar } from './core/codec';
import { esColor } from './core/level';
import type { Entrada } from './core/sim';

const SERVIDOR = 'wss://0.peerjs.com/peerjs?key=peerjs';
const ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const PREFIJO = 'rm-';
const ESPERA_ICE = 2500;
const ESPERA_CONEXION = 20000;
const PASOS = 16;
const LADO = 2 * PASOS + 1;
const DIRECCIONES = LADO * LADO;
const QUIETO = PASOS + PASOS * LADO;
const SIN_CONEXION = 'No se pudo conectar con la sala';

export const MAX_JUGADORES = 8;
export const LARGO_NOMBRE = 20;
export const PARAMETRO_SALA = 's';
export const PARAMETRO_ENVIO = 'e';
const LARGO_MAX_CODIGO = 200000;
const TROZO = 16384;
const MAX_MUSICA = 8000000;
const ESPERA_MUSICA = 120000;
const ESPERA_ANFITRION = 180000;
const ESPERA_REINTENTO = 3000;
const OCULTO_MAX = 15000;

export const COLOR_PRIMARIO = '#111111';
export const COLOR_SECUNDARIO = '#ffffff';

export interface Colores {
  p: string;
  s: string;
}

export interface JugadorSala extends Colores {
  id: number;
  nombre: string;
}

export interface Sesion {
  jugadores: number;
  local: number;
  semilla: number;
  colores: Colores[];
  paso(e: Entrada, tick: (es: Entrada[]) => void, quitar: (i: number) => void): void;
}

export function extraerSala(entrada: string): string | null {
  return /[?&#]s=([a-z0-9]{6,20})(?![a-z0-9])/.exec(entrada)?.[1] ?? null;
}

export function urlDeSala(sala: string): string {
  return `${URL_COMPARTIR.replace(/\/+$/, '')}/?${PARAMETRO_SALA}=${sala}`;
}

export function extraerEnvio(entrada: string): string | null {
  return /[?&#]e=([a-z0-9]{6,20})(?![a-z0-9])/.exec(entrada)?.[1] ?? null;
}

export function urlDeEnvio(sala: string): string {
  return `${URL_COMPARTIR.replace(/\/+$/, '')}/?${PARAMETRO_ENVIO}=${sala}`;
}

export function limpiarColores(c: unknown): Colores {
  const [p, s] = Array.isArray(c) ? c : [];
  return { p: esColor(p) ? p.toLowerCase() : COLOR_PRIMARIO, s: esColor(s) ? s.toLowerCase() : COLOR_SECUNDARIO };
}

export function limpiarNombre(n: unknown): string {
  return String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, LARGO_NOMBRE);
}

function azar(n: number): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (const b of crypto.getRandomValues(new Uint8Array(n))) s += letras[b % letras.length];
  return s;
}

function esCodigo(c: unknown): c is number {
  return typeof c === 'number' && Number.isInteger(c) && c >= 0 && c < DIRECCIONES * 4;
}

function aCodigo(e: Entrada): number {
  const m = Math.max(Math.abs(e.dx), Math.abs(e.dy));
  const qx = m ? Math.round((e.dx / m) * PASOS) : 0;
  const qy = m ? Math.round((e.dy / m) * PASOS) : 0;
  return qx + PASOS + (qy + PASOS) * LADO + (e.reiniciar ? DIRECCIONES : 0) + (e.agarrar ? DIRECCIONES * 2 : 0);
}

function deCodigo(c: unknown): Entrada {
  const n = esCodigo(c) ? c : QUIETO;
  const dir = n % DIRECCIONES;
  return {
    dx: (dir % LADO) - PASOS,
    dy: Math.floor(dir / LADO) - PASOS,
    agarrar: n >= DIRECCIONES * 2,
    reiniciar: Math.floor(n / DIRECCIONES) % 2 === 1,
  };
}

function sinReinicio(c: number): number {
  return (c % DIRECCIONES) + (c >= DIRECCIONES * 2 ? DIRECCIONES * 2 : 0);
}

function leer(datos: unknown): any {
  try {
    return JSON.parse(String(datos));
  } catch {
    return null;
  }
}

function mandar(canal: RTCDataChannel | null, texto: string) {
  if (canal?.readyState !== 'open') return;
  try {
    canal.send(texto);
  } catch {
    return;
  }
}

function reunir(pc: RTCPeerConnection): Promise<void> {
  return new Promise((ok) => {
    if (pc.iceGatheringState === 'complete') return ok();
    const fin = () => {
      clearTimeout(t);
      pc.removeEventListener('icegatheringstatechange', mirar);
      ok();
    };
    const mirar = () => {
      if (pc.iceGatheringState === 'complete') fin();
    };
    const t = setTimeout(fin, ESPERA_ICE);
    pc.addEventListener('icegatheringstatechange', mirar);
  });
}

let musicaLocal: Promise<ArrayBuffer | null> | null = null;

function leerMusica(): Promise<ArrayBuffer | null> {
  return (musicaLocal ??= new Promise((ok) => {
    const x = new XMLHttpRequest();
    x.open('GET', 'audio/musica.mp3');
    x.responseType = 'arraybuffer';
    x.onload = () => ok((x.status === 200 || x.status === 0) && x.response instanceof ArrayBuffer && x.response.byteLength ? x.response : null);
    x.onerror = () => ok(null);
    x.send();
  }));
}

function esperar(canal: RTCDataChannel, ev: 'open' | 'bufferedamountlow'): Promise<boolean> {
  return new Promise((ok) => {
    const fin = (v: boolean) => {
      canal.removeEventListener(ev, si);
      canal.removeEventListener('close', no);
      ok(v);
    };
    const si = () => fin(true);
    const no = () => fin(false);
    canal.addEventListener(ev, si);
    canal.addEventListener('close', no);
  });
}

async function enviarMusica(pc: RTCPeerConnection): Promise<void> {
  if (__OBJETIVO__ === 'web') return;
  const datos = await leerMusica();
  if (!datos || pc.connectionState === 'closed') return;
  let canal: RTCDataChannel;
  try {
    canal = pc.createDataChannel('musica');
  } catch {
    return;
  }
  canal.binaryType = 'arraybuffer';
  canal.bufferedAmountLowThreshold = TROZO * 16;
  const limite = setTimeout(() => canal.close(), ESPERA_MUSICA);
  const recibida = new Promise<void>((ok) => {
    canal.addEventListener('message', () => ok());
    canal.addEventListener('close', () => ok());
  });
  try {
    if (canal.readyState !== 'open' && !(await esperar(canal, 'open'))) return;
    canal.send(JSON.stringify({ mu: datos.byteLength }));
    for (let i = 0; i < datos.byteLength; i += TROZO) {
      if (canal.bufferedAmount > TROZO * 64 && !(await esperar(canal, 'bufferedamountlow'))) return;
      canal.send(datos.slice(i, i + TROZO));
    }
    await recibida;
  } catch {
    return;
  } finally {
    clearTimeout(limite);
    canal.close();
  }
}

function recibirMusica(pc: RTCPeerConnection): Promise<void> {
  return new Promise((fin) => {
    if (__OBJETIVO__ !== 'web') return fin();
    const limite = setTimeout(fin, ESPERA_MUSICA);
    const acabar = () => {
      clearTimeout(limite);
      fin();
    };
    pc.addEventListener('datachannel', (ev) => {
      const c = ev.channel;
      if (c.label !== 'musica') return;
      c.binaryType = 'arraybuffer';
      let total = -1;
      let n = 0;
      const partes: ArrayBuffer[] = [];
      c.onclose = acabar;
      c.onmessage = (e) => {
        if (typeof e.data === 'string') {
          const t = leer(e.data)?.mu;
          if (Number.isInteger(t) && t > 0 && t <= MAX_MUSICA) total = t;
          else c.close();
          return;
        }
        if (total < 0 || !(e.data instanceof ArrayBuffer)) return void c.close();
        partes.push(e.data);
        n += e.data.byteLength;
        if (n > total) return void c.close();
        if (n < total) return;
        mandar(c, '{"ok":1}');
        ponerMusica(new Blob(partes, { type: 'audio/mpeg' }));
        acabar();
      };
    });
  });
}

interface Mensaje {
  type: string;
  src?: string;
  payload?: any;
}

class Senal {
  private ws: WebSocket;
  private latido: number;
  alAbrir: () => void = () => undefined;
  alMensaje: (m: Mensaje) => void = () => undefined;
  alCerrar: () => void = () => undefined;

  constructor(id: string) {
    this.ws = new WebSocket(`${SERVIDOR}&id=${id}&token=${azar(12)}&version=1.5.4`);
    this.ws.onmessage = (ev) => {
      const m = leer(ev.data) as Mensaje | null;
      if (!m || typeof m.type !== 'string') return;
      if (m.type === 'OPEN') this.alAbrir();
      else this.alMensaje(m);
    };
    this.ws.onclose = () => {
      clearInterval(this.latido);
      this.alCerrar();
    };
    this.latido = window.setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send('{"type":"HEARTBEAT"}');
    }, 5000);
  }

  enviar(type: 'OFFER' | 'ANSWER', dst: string, conexion: string, d: RTCSessionDescription) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    const payload: Record<string, unknown> = { sdp: { type: d.type, sdp: d.sdp }, type: 'data', connectionId: conexion, browser: 'chrome' };
    if (type === 'OFFER') Object.assign(payload, { label: conexion, reliable: true, serialization: 'json' });
    this.ws.send(JSON.stringify({ type, dst, payload }));
  }

  cerrar() {
    clearInterval(this.latido);
    this.ws.onclose = null;
    this.ws.onmessage = null;
    this.ws.close();
  }
}

interface Remoto {
  id: number;
  nombre: string;
  pc: RTCPeerConnection;
  canal: RTCDataChannel;
  mov: number;
  rei: boolean;
  ido: boolean;
  musica: boolean;
  colores: Colores;
}

export class Anfitrion {
  readonly anfitrion = true;
  readonly yo = 0;
  conectado = true;
  sala: string | null = null;
  alCambiar: () => void = () => undefined;

  private nombre: string;
  private colores: Colores;
  private codigo: string;
  private senal: Senal | null = null;
  private abriendo: Promise<string> | null = null;
  private remotos: Remoto[] = [];
  private pendientes = new Set<RTCPeerConnection>();
  private siguiente = 1;
  private empezada = false;
  private cerrado = false;
  private orden: Remoto[] = [];
  private bajas: number[] = [];
  private idSala: string | null = null;
  private reapertura = 0;
  private ocultoDesde = 0;
  private alOcultar = () => this.cerrar();
  private alVisibilidad = () => {
    if (document.hidden) {
      this.ocultoDesde = Date.now();
      return;
    }
    if (this.cerrado || this.empezada || !this.idSala) return;
    if (this.senal && Date.now() - this.ocultoDesde > OCULTO_MAX) {
      const s = this.senal;
      this.senal = null;
      this.sala = null;
      s.cerrar();
    }
    if (!this.senal) this.reabrir(0);
  };

  constructor(nombre: string, codigo = '', colores: Colores = { p: COLOR_PRIMARIO, s: COLOR_SECUNDARIO }) {
    this.nombre = limpiarNombre(nombre);
    this.colores = limpiarColores([colores.p, colores.s]);
    this.codigo = codigo;
    window.addEventListener('pagehide', this.alOcultar);
    document.addEventListener('visibilitychange', this.alVisibilidad);
  }

  get codigoSala(): string | null {
    return this.idSala;
  }

  private reabrir(espera: number) {
    clearTimeout(this.reapertura);
    if (this.cerrado || this.empezada || !this.idSala || document.hidden) return;
    this.reapertura = window.setTimeout(() => {
      this.abrir().catch(() => this.reabrir(Math.min(Math.max(espera * 2, 2000), 15000)));
    }, espera);
  }

  get lista(): JugadorSala[] {
    return [{ id: 0, nombre: this.nombre, ...this.colores }, ...this.remotos.map((r) => ({ id: r.id, nombre: r.nombre, ...r.colores }))];
  }

  nombrar(n: string) {
    this.nombre = limpiarNombre(n);
    this.anunciar();
  }

  colorear(c: Colores) {
    this.colores = limpiarColores([c.p, c.s]);
    if (!this.empezada) this.anunciar();
  }

  abrir(): Promise<string> {
    if (this.sala) return Promise.resolve(this.sala);
    if (this.abriendo) return this.abriendo;
    const sala = (this.idSala ??= azar(10));
    const p = new Promise<string>((ok, mal) => {
      const s = new Senal(PREFIJO + sala);
      let abierta = false;
      s.alAbrir = () => {
        if (this.cerrado || this.empezada) return s.cerrar();
        abierta = true;
        this.senal = s;
        this.sala = sala;
        ok(sala);
        this.alCambiar();
      };
      s.alMensaje = (m) => {
        if (m.type === 'OFFER') void this.aceptar(s, m);
      };
      s.alCerrar = () => {
        if (this.senal === s) {
          this.senal = null;
          this.sala = null;
          this.alCambiar();
          this.reabrir(1000);
        }
        if (!abierta) mal(new Error('No se pudo abrir la sala'));
      };
    });
    const fin = () => {
      this.abriendo = null;
    };
    this.abriendo = p;
    p.then(fin, fin);
    return p;
  }

  private async aceptar(s: Senal, m: Mensaje) {
    const sdp = m.payload?.sdp?.sdp;
    const conexion = m.payload?.connectionId;
    if (!m.src || typeof sdp !== 'string' || typeof conexion !== 'string') return;
    const pc = new RTCPeerConnection(ICE);
    this.pendientes.add(pc);
    pc.ondatachannel = (ev) => {
      const canal = ev.channel;
      if (canal.readyState === 'open') this.entrar(pc, canal);
      else canal.onopen = () => this.entrar(pc, canal);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && this.pendientes.delete(pc)) pc.close();
    };
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await reunir(pc);
      if (pc.localDescription) s.enviar('ANSWER', m.src, conexion, pc.localDescription);
    } catch {
      this.pendientes.delete(pc);
      pc.close();
    }
  }

  private entrar(pc: RTCPeerConnection, canal: RTCDataChannel) {
    this.pendientes.delete(pc);
    if (this.cerrado) return pc.close();
    if (this.empezada || this.remotos.length + 1 >= MAX_JUGADORES) {
      mandar(canal, JSON.stringify({ x: this.empezada ? 'La partida ya ha empezado' : 'La sala está llena' }));
      setTimeout(() => pc.close(), 1000);
      return;
    }
    const r: Remoto = { id: this.siguiente++, nombre: '', pc, canal, mov: QUIETO, rei: false, ido: false, musica: false, colores: limpiarColores(null) };
    this.remotos.push(r);
    canal.onmessage = (ev) => this.mensaje(r, ev.data);
    canal.onclose = () => this.baja(r);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.baja(r);
    };
    if (this.codigo) mandar(canal, JSON.stringify({ nv: this.codigo }));
    this.anunciar();
  }

  private mensaje(r: Remoto, datos: unknown) {
    const m = leer(datos);
    if (typeof m?.n === 'string') {
      r.nombre = limpiarNombre(m.n);
      if (!this.empezada) this.anunciar();
    } else if (Array.isArray(m?.c)) {
      if (this.empezada) return;
      r.colores = limpiarColores(m.c);
      this.anunciar();
    } else if (esCodigo(m?.e)) {
      r.mov = sinReinicio(m.e);
      if (m.e !== r.mov) r.rei = true;
    } else if (m?.pm === 1 && !r.musica) {
      r.musica = true;
      void enviarMusica(r.pc);
    }
  }

  private baja(r: Remoto) {
    if (r.ido || this.cerrado) return;
    r.ido = true;
    r.pc.close();
    if (this.empezada) {
      const i = this.orden.indexOf(r);
      if (i >= 0) this.bajas.push(i + 1);
    } else {
      this.remotos = this.remotos.filter((x) => x !== r);
      this.anunciar();
    }
  }

  private anunciar() {
    const j = this.lista;
    for (const r of this.remotos) mandar(r.canal, JSON.stringify({ j, tu: r.id }));
    this.alCambiar();
  }

  private difundir(o: unknown) {
    const texto = JSON.stringify(o);
    for (const r of this.orden) if (!r.ido) mandar(r.canal, texto);
  }

  empezar(): Sesion {
    this.empezada = true;
    clearTimeout(this.reapertura);
    this.senal?.cerrar();
    this.senal = null;
    this.sala = null;
    for (const pc of this.pendientes) pc.close();
    this.pendientes.clear();
    const orden = (this.orden = this.remotos.slice());
    const semilla = crypto.getRandomValues(new Uint32Array(1))[0];
    const colores = [this.colores, ...orden.map((r) => r.colores)];
    const co = colores.map((c) => [c.p, c.s]);
    orden.forEach((r, i) => mandar(r.canal, JSON.stringify({ ini: orden.length + 1, tu: i + 1, se: semilla, co })));
    return {
      jugadores: orden.length + 1,
      local: 0,
      semilla,
      colores,
      paso: (e, tick, quitar) => {
        for (const i of this.bajas.splice(0)) {
          this.difundir({ f: i });
          quitar(i);
        }
        const codigos = [aCodigo(e), ...orden.map((r) => (r.ido ? QUIETO : r.mov))];
        for (const r of orden) r.rei = false;
        this.difundir(codigos);
        tick(codigos.map(deCodigo));
      },
    };
  }

  cerrar() {
    this.cerrado = true;
    window.removeEventListener('pagehide', this.alOcultar);
    document.removeEventListener('visibilitychange', this.alVisibilidad);
    clearTimeout(this.reapertura);
    this.alCambiar = () => undefined;
    this.senal?.cerrar();
    this.senal = null;
    this.sala = null;
    for (const pc of this.pendientes) pc.close();
    this.pendientes.clear();
    for (const r of this.remotos) r.pc.close();
  }
}

export class Invitado {
  readonly anfitrion = false;
  yo = -1;
  conectado = false;
  lista: JugadorSala[] = [];
  alCambiar: () => void = () => undefined;
  alEmpezar: (s: Sesion) => void = () => undefined;
  alCaer: (motivo: string) => void = () => undefined;
  alNivel: (codigo: string) => void = () => undefined;

  esperando = false;

  private nombre: string;
  private colores: Colores;
  private sala: string;
  private senal: Senal | null = null;
  private pc!: RTCPeerConnection;
  private canal!: RTCDataChannel;
  private cola: (unknown[] | number)[] = [];
  private ultimo = QUIETO;
  private cerrado = false;
  private espera = 0;
  private reintento = 0;
  private limite: number;
  private alOcultar = () => this.cerrar();

  constructor(sala: string, nombre: string, colores: Colores = { p: COLOR_PRIMARIO, s: COLOR_SECUNDARIO }) {
    this.nombre = limpiarNombre(nombre);
    this.colores = limpiarColores([colores.p, colores.s]);
    this.sala = sala;
    this.limite = Date.now() + ESPERA_ANFITRION;
    window.addEventListener('pagehide', this.alOcultar);
    this.intentar();
  }

  private intentar() {
    const conexion = 'dc_' + azar(12);
    const pc = (this.pc = new RTCPeerConnection(ICE));
    const canal = (this.canal = pc.createDataChannel(conexion));
    const vigente = () => !this.cerrado && this.pc === pc;
    const fallo = (motivo: string) => {
      if (!vigente()) return;
      if (this.conectado) this.caer('Se ha perdido la conexión con el anfitrión');
      else this.reintentar(motivo);
    };
    canal.onopen = () => {
      if (!vigente()) return;
      clearTimeout(this.espera);
      this.senal?.cerrar();
      this.senal = null;
      this.conectado = true;
      this.esperando = false;
      mandar(canal, JSON.stringify({ n: this.nombre }));
      mandar(canal, JSON.stringify({ c: [this.colores.p, this.colores.s] }));
      if (__OBJETIVO__ === 'web') mandar(canal, '{"pm":1}');
      this.alCambiar();
    };
    void recibirMusica(pc);
    canal.onmessage = (ev) => vigente() && this.mensaje(ev.data);
    canal.onclose = () => fallo(SIN_CONEXION);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') fallo(SIN_CONEXION);
    };

    const oferta = (async () => {
      await pc.setLocalDescription(await pc.createOffer());
      await reunir(pc);
    })();
    oferta.catch(() => fallo(SIN_CONEXION));

    const s = (this.senal = new Senal(PREFIJO + azar(16)));
    s.alAbrir = () => {
      void oferta.then(() => {
        if (vigente() && pc.localDescription) s.enviar('OFFER', PREFIJO + this.sala, conexion, pc.localDescription);
      });
    };
    s.alMensaje = (m) => {
      const sdp = m.payload?.sdp?.sdp;
      if (m.type === 'ANSWER' && typeof sdp === 'string') pc.setRemoteDescription({ type: 'answer', sdp }).catch(() => fallo(SIN_CONEXION));
      else if (m.type === 'EXPIRE') fallo('La sala no existe o ya se ha cerrado');
    };
    s.alCerrar = () => {
      if (this.senal === s && !this.conectado) fallo(SIN_CONEXION);
    };
    clearTimeout(this.espera);
    this.espera = window.setTimeout(() => fallo(SIN_CONEXION), ESPERA_CONEXION);
  }

  private soltarIntento() {
    clearTimeout(this.espera);
    this.senal?.cerrar();
    this.senal = null;
    this.canal.onclose = null;
    this.canal.onmessage = null;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
  }

  private reintentar(motivo: string) {
    this.soltarIntento();
    if (Date.now() + ESPERA_REINTENTO > this.limite) return this.caer(motivo);
    if (!this.esperando) {
      this.esperando = true;
      this.alCambiar();
    }
    clearTimeout(this.reintento);
    this.reintento = window.setTimeout(() => !this.cerrado && this.intentar(), ESPERA_REINTENTO);
  }

  nombrar(n: string) {
    this.nombre = limpiarNombre(n);
    mandar(this.canal, JSON.stringify({ n: this.nombre }));
  }

  colorear(c: Colores) {
    this.colores = limpiarColores([c.p, c.s]);
    mandar(this.canal, JSON.stringify({ c: [this.colores.p, this.colores.s] }));
  }

  private mensaje(datos: unknown) {
    const m = leer(datos);
    if (Array.isArray(m)) this.cola.push(m);
    else if (typeof m?.nv === 'string') {
      if (m.nv.length > LARGO_MAX_CODIGO) return this.caer('El nivel recibido no es válido');
      try {
        decodificar(m.nv);
      } catch (e) {
        return this.caer((e as Error).message);
      }
      this.alNivel(m.nv);
    } else if (Number.isInteger(m?.f)) this.cola.push(m.f as number);
    else if (Array.isArray(m?.j)) {
      this.lista = (m.j as any[]).slice(0, MAX_JUGADORES).map((x) => ({ id: Number(x?.id), nombre: limpiarNombre(x?.nombre), ...limpiarColores([x?.p, x?.s]) }));
      this.yo = Number(m.tu);
      this.alCambiar();
    } else if (Number.isInteger(m?.ini)) {
      const n = m.ini as number;
      const tu = Number(m.tu);
      if (n < 1 || n > MAX_JUGADORES || !Number.isInteger(tu) || tu < 0 || tu >= n) return this.caer(SIN_CONEXION);
      const co: unknown[] = Array.isArray(m.co) ? m.co : [];
      this.alEmpezar(this.sesion(n, tu, Number.isInteger(m.se) ? m.se : 0, Array.from({ length: n }, (_, i) => limpiarColores(co[i]))));
    } else if (typeof m?.x === 'string') this.caer(m.x.slice(0, 80));
  }

  private sesion(jugadores: number, local: number, semilla: number, colores: Colores[]): Sesion {
    return {
      jugadores,
      local,
      semilla,
      colores,
      paso: (e, tick, quitar) => {
        const c = aCodigo(e);
        if (sinReinicio(c) !== this.ultimo || c !== sinReinicio(c)) {
          this.ultimo = sinReinicio(c);
          mandar(this.canal, JSON.stringify({ e: c }));
        }
        let hechos = 0;
        while (this.cola.length && (hechos < 1 || this.cola.length > 2) && hechos < 400) {
          const x = this.cola.shift()!;
          if (typeof x === 'number') quitar(x);
          else {
            tick(Array.from({ length: jugadores }, (_, i) => deCodigo(x[i])));
            hechos++;
          }
        }
      },
    };
  }

  private caer(motivo: string) {
    if (this.cerrado) return;
    this.cerrar();
    this.alCaer(motivo);
  }

  cerrar() {
    this.cerrado = true;
    window.removeEventListener('pagehide', this.alOcultar);
    clearTimeout(this.reintento);
    this.soltarIntento();
  }
}

export type Red = Anfitrion | Invitado;

export class Emisor {
  sala: string | null = null;
  recibidos = 0;
  alCambiar: () => void = () => undefined;

  private codigo: string;
  private senal: Senal | null = null;
  private conexiones = new Set<RTCPeerConnection>();
  private cerrado = false;
  private idSala: string | null = null;
  private abriendo: Promise<string> | null = null;
  private reapertura = 0;
  private ocultoDesde = 0;
  private alOcultar = () => this.cerrar();
  private alVisibilidad = () => {
    if (document.hidden) {
      this.ocultoDesde = Date.now();
      return;
    }
    if (this.cerrado || !this.idSala) return;
    if (this.senal && Date.now() - this.ocultoDesde > OCULTO_MAX) {
      const s = this.senal;
      this.senal = null;
      this.sala = null;
      s.cerrar();
    }
    if (!this.senal) this.reabrir(0);
  };

  constructor(codigo: string) {
    this.codigo = codigo;
    window.addEventListener('pagehide', this.alOcultar);
    document.addEventListener('visibilitychange', this.alVisibilidad);
  }

  get codigoSala(): string | null {
    return this.idSala;
  }

  private reabrir(espera: number) {
    clearTimeout(this.reapertura);
    if (this.cerrado || !this.idSala || document.hidden) return;
    this.reapertura = window.setTimeout(() => {
      this.abrir().catch(() => this.reabrir(Math.min(Math.max(espera * 2, 2000), 15000)));
    }, espera);
  }

  abrir(): Promise<string> {
    if (this.sala) return Promise.resolve(this.sala);
    if (this.abriendo) return this.abriendo;
    const sala = (this.idSala ??= azar(10));
    const p = new Promise<string>((ok, mal) => {
      const s = new Senal(PREFIJO + sala);
      let abierta = false;
      s.alAbrir = () => {
        if (this.cerrado) return s.cerrar();
        abierta = true;
        this.senal = s;
        this.sala = sala;
        ok(sala);
        this.alCambiar();
      };
      s.alMensaje = (m) => {
        if (m.type === 'OFFER') void this.aceptar(s, m);
      };
      s.alCerrar = () => {
        if (this.senal === s) {
          this.senal = null;
          this.sala = null;
          this.alCambiar();
          this.reabrir(1000);
        }
        if (!abierta) mal(new Error('No se pudo abrir la sala'));
      };
    });
    const fin = () => {
      this.abriendo = null;
    };
    this.abriendo = p;
    p.then(fin, fin);
    return p;
  }

  private async aceptar(s: Senal, m: Mensaje) {
    const sdp = m.payload?.sdp?.sdp;
    const conexion = m.payload?.connectionId;
    if (this.cerrado || !m.src || typeof sdp !== 'string' || typeof conexion !== 'string') return;
    const pc = new RTCPeerConnection(ICE);
    this.conexiones.add(pc);
    const fin = () => {
      clearTimeout(t);
      this.conexiones.delete(pc);
      pc.close();
    };
    const t = setTimeout(fin, ESPERA_CONEXION * 2);
    pc.ondatachannel = (ev) => {
      const canal = ev.channel;
      let musica: Promise<void> | null = null;
      canal.onmessage = (e) => {
        const m = leer(e.data);
        if (m?.pm === 1) {
          musica ??= enviarMusica(pc);
          return;
        }
        if (m?.ok !== 1) return;
        clearTimeout(t);
        this.recibidos++;
        this.alCambiar();
        void (musica ?? Promise.resolve()).then(fin);
      };
      const enviar = () => mandar(canal, JSON.stringify({ nv: this.codigo }));
      if (canal.readyState === 'open') enviar();
      else canal.onopen = enviar;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') fin();
    };
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await reunir(pc);
      if (pc.localDescription) s.enviar('ANSWER', m.src, conexion, pc.localDescription);
    } catch {
      fin();
    }
  }

  cerrar() {
    this.cerrado = true;
    window.removeEventListener('pagehide', this.alOcultar);
    document.removeEventListener('visibilitychange', this.alVisibilidad);
    clearTimeout(this.reapertura);
    this.alCambiar = () => undefined;
    this.senal?.cerrar();
    this.senal = null;
    this.sala = null;
    for (const pc of this.conexiones) pc.close();
    this.conexiones.clear();
  }
}

export class Receptor {
  readonly nivel: Promise<string>;
  esperando = false;
  alCambiar: () => void = () => undefined;

  private sala: string;
  private senal: Senal | null = null;
  private pc!: RTCPeerConnection;
  private canal!: RTCDataChannel;
  private espera = 0;
  private reintento = 0;
  private limite: number;
  private hecho = false;
  private ok: (codigo: string) => void = () => undefined;
  private mal: (e: Error) => void = () => undefined;
  private alOcultar = () => this.cerrar();

  constructor(sala: string) {
    this.nivel = new Promise<string>((a, b) => {
      this.ok = a;
      this.mal = b;
    });
    this.sala = sala;
    this.limite = Date.now() + ESPERA_ANFITRION;
    window.addEventListener('pagehide', this.alOcultar);
    this.intentar();
  }

  private caer(motivo: string) {
    if (this.hecho) return;
    this.hecho = true;
    this.cerrar();
    this.mal(new Error(motivo));
  }

  private intentar() {
    const conexion = 'dc_' + azar(12);
    const pc = (this.pc = new RTCPeerConnection(ICE));
    const canal = (this.canal = pc.createDataChannel(conexion));
    const vigente = () => !this.hecho && this.pc === pc;
    const fallo = (motivo: string) => {
      if (vigente()) this.reintentar(motivo);
    };
    const musica = recibirMusica(pc);
    canal.onopen = () => {
      if (!vigente()) return;
      this.senal?.cerrar();
      this.senal = null;
      if (__OBJETIVO__ === 'web') mandar(canal, '{"pm":1}');
    };
    canal.onmessage = (ev) => {
      if (!vigente()) return;
      const c = leer(ev.data)?.nv;
      if (typeof c !== 'string' || c.length > LARGO_MAX_CODIGO) return this.caer('El nivel recibido no es válido');
      try {
        decodificar(c);
      } catch (e) {
        return this.caer((e as Error).message);
      }
      this.hecho = true;
      this.esperando = false;
      clearTimeout(this.espera);
      mandar(canal, JSON.stringify({ ok: 1 }));
      this.ok(c);
      void musica.then(() => this.cerrar());
    };
    canal.onclose = () => fallo(SIN_CONEXION);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') fallo(SIN_CONEXION);
    };

    const oferta = (async () => {
      await pc.setLocalDescription(await pc.createOffer());
      await reunir(pc);
    })();
    oferta.catch(() => fallo(SIN_CONEXION));

    const s = (this.senal = new Senal(PREFIJO + azar(16)));
    s.alAbrir = () => {
      void oferta.then(() => {
        if (vigente() && pc.localDescription) s.enviar('OFFER', PREFIJO + this.sala, conexion, pc.localDescription);
      });
    };
    s.alMensaje = (m) => {
      const sdp = m.payload?.sdp?.sdp;
      if (m.type === 'ANSWER' && typeof sdp === 'string') pc.setRemoteDescription({ type: 'answer', sdp }).catch(() => fallo(SIN_CONEXION));
      else if (m.type === 'EXPIRE') fallo('El enlace ya no está disponible: quien lo compartió no está conectado');
    };
    s.alCerrar = () => {
      if (this.senal === s) fallo(SIN_CONEXION);
    };
    clearTimeout(this.espera);
    this.espera = window.setTimeout(() => fallo(SIN_CONEXION), ESPERA_CONEXION);
  }

  private reintentar(motivo: string) {
    this.soltarIntento();
    if (Date.now() + ESPERA_REINTENTO > this.limite) return this.caer(motivo);
    if (!this.esperando) {
      this.esperando = true;
      this.alCambiar();
    }
    clearTimeout(this.reintento);
    this.reintento = window.setTimeout(() => !this.hecho && this.intentar(), ESPERA_REINTENTO);
  }

  private soltarIntento() {
    clearTimeout(this.espera);
    this.senal?.cerrar();
    this.senal = null;
    this.canal.onclose = null;
    this.canal.onmessage = null;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
  }

  cancelar() {
    this.hecho = true;
    this.cerrar();
  }

  private cerrar() {
    window.removeEventListener('pagehide', this.alOcultar);
    clearTimeout(this.reintento);
    this.soltarIntento();
  }
}
