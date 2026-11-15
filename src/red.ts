import { URL_COMPARTIR } from './config';
import { decodificar } from './core/codec';
import type { Entrada } from './core/sim';

const SERVIDOR = 'wss://0.peerjs.com/peerjs?key=peerjs';
const ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const PREFIJO = 'rm-';
const ESPERA_ICE = 2500;
const ESPERA_CONEXION = 20000;
const QUIETO = 4;
const SIN_CONEXION = 'No se pudo conectar con la sala';

export const MAX_JUGADORES = 8;
export const LARGO_NOMBRE = 20;
export const PARAMETRO_SALA = 's';
export const PARAMETRO_ENVIO = 'e';
const LARGO_MAX_CODIGO = 200000;

export interface JugadorSala {
  id: number;
  nombre: string;
}

export interface Sesion {
  jugadores: number;
  local: number;
  semilla: number;
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
  return typeof c === 'number' && Number.isInteger(c) && c >= 0 && c < 36;
}

function aCodigo(e: Entrada): number {
  return e.dx + 1 + (e.dy + 1) * 3 + (e.reiniciar ? 9 : 0) + (e.agarrar ? 18 : 0);
}

function deCodigo(c: unknown): Entrada {
  const n = esCodigo(c) ? c : QUIETO;
  return { dx: (n % 3) - 1, dy: (Math.floor(n / 3) % 3) - 1, agarrar: n >= 18, reiniciar: Math.floor(n / 9) % 2 === 1 };
}

function sinReinicio(c: number): number {
  return (c % 9) + (c >= 18 ? 18 : 0);
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
}

export class Anfitrion {
  readonly anfitrion = true;
  readonly yo = 0;
  conectado = true;
  sala: string | null = null;
  alCambiar: () => void = () => undefined;

  private nombre: string;
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
  private alOcultar = () => this.cerrar();

  constructor(nombre: string, codigo = '') {
    this.nombre = limpiarNombre(nombre);
    this.codigo = codigo;
    window.addEventListener('pagehide', this.alOcultar);
  }

  get lista(): JugadorSala[] {
    return [{ id: 0, nombre: this.nombre }, ...this.remotos.map((r) => ({ id: r.id, nombre: r.nombre }))];
  }

  nombrar(n: string) {
    this.nombre = limpiarNombre(n);
    this.anunciar();
  }

  abrir(): Promise<string> {
    if (this.sala) return Promise.resolve(this.sala);
    if (this.abriendo) return this.abriendo;
    const p = new Promise<string>((ok, mal) => {
      const sala = azar(10);
      const s = new Senal(PREFIJO + sala);
      let abierta = false;
      s.alAbrir = () => {
        if (this.cerrado || this.empezada) return s.cerrar();
        abierta = true;
        this.senal = s;
        this.sala = sala;
        ok(sala);
      };
      s.alMensaje = (m) => {
        if (m.type === 'OFFER') void this.aceptar(s, m);
      };
      s.alCerrar = () => {
        if (this.senal === s) {
          this.senal = null;
          this.sala = null;
          this.alCambiar();
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
    const r: Remoto = { id: this.siguiente++, nombre: '', pc, canal, mov: QUIETO, rei: false, ido: false };
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
    } else if (esCodigo(m?.e)) {
      r.mov = sinReinicio(m.e);
      if (m.e !== r.mov) r.rei = true;
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
    this.senal?.cerrar();
    this.senal = null;
    this.sala = null;
    for (const pc of this.pendientes) pc.close();
    this.pendientes.clear();
    const orden = (this.orden = this.remotos.slice());
    const semilla = crypto.getRandomValues(new Uint32Array(1))[0];
    orden.forEach((r, i) => mandar(r.canal, JSON.stringify({ ini: orden.length + 1, tu: i + 1, se: semilla })));
    return {
      jugadores: orden.length + 1,
      local: 0,
      semilla,
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

  private nombre: string;
  private senal: Senal | null;
  private pc: RTCPeerConnection;
  private canal: RTCDataChannel;
  private cola: (unknown[] | number)[] = [];
  private ultimo = QUIETO;
  private cerrado = false;
  private espera: number;
  private alOcultar = () => this.cerrar();

  constructor(sala: string, nombre: string) {
    this.nombre = limpiarNombre(nombre);
    window.addEventListener('pagehide', this.alOcultar);
    const conexion = 'dc_' + azar(12);
    const pc = (this.pc = new RTCPeerConnection(ICE));
    const canal = (this.canal = pc.createDataChannel(conexion));
    canal.onopen = () => {
      clearTimeout(this.espera);
      this.senal?.cerrar();
      this.senal = null;
      this.conectado = true;
      mandar(canal, JSON.stringify({ n: this.nombre }));
      this.alCambiar();
    };
    canal.onmessage = (ev) => this.mensaje(ev.data);
    const perdida = () => this.caer(this.conectado ? 'Se ha perdido la conexión con el anfitrión' : SIN_CONEXION);
    canal.onclose = perdida;
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') perdida();
    };

    const oferta = (async () => {
      await pc.setLocalDescription(await pc.createOffer());
      await reunir(pc);
    })();
    oferta.catch(() => this.caer(SIN_CONEXION));

    const s = (this.senal = new Senal(PREFIJO + azar(16)));
    s.alAbrir = () => {
      void oferta.then(() => {
        if (!this.cerrado && pc.localDescription) s.enviar('OFFER', PREFIJO + sala, conexion, pc.localDescription);
      });
    };
    s.alMensaje = (m) => {
      const sdp = m.payload?.sdp?.sdp;
      if (m.type === 'ANSWER' && typeof sdp === 'string') pc.setRemoteDescription({ type: 'answer', sdp }).catch(() => this.caer(SIN_CONEXION));
      else if (m.type === 'EXPIRE') this.caer('La sala no existe o ya se ha cerrado');
    };
    s.alCerrar = () => {
      if (!this.conectado) this.caer(SIN_CONEXION);
    };
    this.espera = window.setTimeout(() => this.caer(SIN_CONEXION), ESPERA_CONEXION);
  }

  nombrar(n: string) {
    this.nombre = limpiarNombre(n);
    mandar(this.canal, JSON.stringify({ n: this.nombre }));
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
      this.lista = (m.j as any[]).slice(0, MAX_JUGADORES).map((x) => ({ id: Number(x?.id), nombre: limpiarNombre(x?.nombre) }));
      this.yo = Number(m.tu);
      this.alCambiar();
    } else if (Number.isInteger(m?.ini)) {
      const n = m.ini as number;
      const tu = Number(m.tu);
      if (n < 1 || n > MAX_JUGADORES || !Number.isInteger(tu) || tu < 0 || tu >= n) return this.caer(SIN_CONEXION);
      this.alEmpezar(this.sesion(n, tu, Number.isInteger(m.se) ? m.se : 0));
    } else if (typeof m?.x === 'string') this.caer(m.x.slice(0, 80));
  }

  private sesion(jugadores: number, local: number, semilla: number): Sesion {
    return {
      jugadores,
      local,
      semilla,
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
    clearTimeout(this.espera);
    this.senal?.cerrar();
    this.senal = null;
    this.canal.onclose = null;
    this.canal.onmessage = null;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
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
  private alOcultar = () => this.cerrar();

  constructor(codigo: string) {
    this.codigo = codigo;
    window.addEventListener('pagehide', this.alOcultar);
  }

  abrir(): Promise<string> {
    return new Promise<string>((ok, mal) => {
      const sala = azar(10);
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
        }
        if (!abierta) mal(new Error('No se pudo abrir la sala'));
      };
    });
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
      canal.onmessage = (e) => {
        if (leer(e.data)?.ok !== 1) return;
        fin();
        this.recibidos++;
        this.alCambiar();
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

  private senal: Senal | null;
  private pc: RTCPeerConnection;
  private canal: RTCDataChannel;
  private espera: number;
  private hecho = false;
  private alOcultar = () => this.cerrar();

  constructor(sala: string) {
    let ok: (codigo: string) => void = () => undefined;
    let mal: (e: Error) => void = () => undefined;
    this.nivel = new Promise<string>((a, b) => {
      ok = a;
      mal = b;
    });
    const caer = (motivo: string) => {
      if (this.hecho) return;
      this.hecho = true;
      this.cerrar();
      mal(new Error(motivo));
    };
    window.addEventListener('pagehide', this.alOcultar);
    const conexion = 'dc_' + azar(12);
    const pc = (this.pc = new RTCPeerConnection(ICE));
    const canal = (this.canal = pc.createDataChannel(conexion));
    canal.onopen = () => {
      this.senal?.cerrar();
      this.senal = null;
    };
    canal.onmessage = (ev) => {
      const c = leer(ev.data)?.nv;
      if (typeof c !== 'string' || c.length > LARGO_MAX_CODIGO) return caer('El nivel recibido no es válido');
      try {
        decodificar(c);
      } catch (e) {
        return caer((e as Error).message);
      }
      if (this.hecho) return;
      this.hecho = true;
      clearTimeout(this.espera);
      mandar(canal, JSON.stringify({ ok: 1 }));
      ok(c);
      setTimeout(() => this.cerrar(), 2000);
    };
    canal.onclose = () => caer(SIN_CONEXION);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') caer(SIN_CONEXION);
    };

    const oferta = (async () => {
      await pc.setLocalDescription(await pc.createOffer());
      await reunir(pc);
    })();
    oferta.catch(() => caer(SIN_CONEXION));

    const s = (this.senal = new Senal(PREFIJO + azar(16)));
    s.alAbrir = () => {
      void oferta.then(() => {
        if (!this.hecho && pc.localDescription) s.enviar('OFFER', PREFIJO + sala, conexion, pc.localDescription);
      });
    };
    s.alMensaje = (m) => {
      const sdp = m.payload?.sdp?.sdp;
      if (m.type === 'ANSWER' && typeof sdp === 'string') pc.setRemoteDescription({ type: 'answer', sdp }).catch(() => caer(SIN_CONEXION));
      else if (m.type === 'EXPIRE') caer('El enlace ya no está disponible: quien lo compartió no está conectado');
    };
    s.alCerrar = () => {
      if (!this.senal) return;
      caer(SIN_CONEXION);
    };
    this.espera = window.setTimeout(() => caer(SIN_CONEXION), ESPERA_CONEXION);
  }

  cancelar() {
    this.hecho = true;
    this.cerrar();
  }

  private cerrar() {
    window.removeEventListener('pagehide', this.alOcultar);
    clearTimeout(this.espera);
    this.senal?.cerrar();
    this.senal = null;
    this.canal.onclose = null;
    this.canal.onmessage = null;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
  }
}
