import type { Evento } from './core/sim';
import { ajustes } from './store';

let ctx: AudioContext | null = null;
let musica: HTMLAudioElement | null = null;
let desbloqueado = false;

function contexto(): AudioContext | null {
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tono(f0: number, f1: number, dur: number, tipo: OscillatorType = 'sine', vol = 0.12, retraso = 0) {
  const c = contexto();
  if (!c) return;
  const t = c.currentTime + retraso;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function ruido(dur: number, vol = 0.15) {
  const c = contexto();
  if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1800;
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(f).connect(g).connect(c.destination);
  s.start();
}

const SONIDOS: Record<Evento, () => void> = {
  empezar: () => tono(440, 660, 0.09, 'triangle'),
  grabar: () => {
    tono(520, 520, 0.07, 'square', 0.06);
    tono(780, 780, 0.1, 'square', 0.06, 0.08);
  },
  sin_grabaciones: () => tono(160, 110, 0.18, 'sawtooth', 0.07),
  reiniciar: () => tono(500, 250, 0.12, 'triangle'),
  muerte: () => {
    ruido(0.3);
    tono(220, 55, 0.3, 'sawtooth', 0.08);
  },
  meta: () => tono(520, 1040, 0.22, 'sine', 0.14),
  completado: () => [523, 659, 784, 1047].forEach((f, i) => tono(f, f, 0.22, 'triangle', 0.12, 0.15 + i * 0.11)),
  boton: () => tono(330, 300, 0.06, 'sine', 0.1),
  interruptor: () => tono(900, 600, 0.05, 'square', 0.05),
  portal: () => tono(300, 1200, 0.16, 'sine', 0.1),
};

export function sonar(e: Evento) {
  if (ajustes.efectos && desbloqueado) SONIDOS[e]();
}

export function actualizarMusica() {
  if (!desbloqueado) return;
  if (ajustes.musica) {
    if (!musica) {
      musica = new Audio('audio/musica.mp3');
      musica.loop = true;
      musica.volume = 0.35;
    }
    void musica.play().catch(() => undefined);
  } else musica?.pause();
}

export function pausarMusica(pausa: boolean) {
  if (!musica) return;
  if (pausa) musica.pause();
  else actualizarMusica();
}

function desbloquear() {
  if (desbloqueado) return;
  desbloqueado = true;
  contexto();
  actualizarMusica();
}

for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, desbloquear, { passive: true });
document.addEventListener('visibilitychange', () => pausarMusica(document.hidden));
