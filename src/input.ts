import type { Entrada } from './core/sim';

const pulsadas = new Set<string>();
let grabar = false;
let reiniciar = false;
let palanca = { dx: 0, dy: 0 };

function esCampo(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
}

window.addEventListener('keydown', (e) => {
  if (esCampo(e)) return;
  if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab' || e.code === 'Backspace') e.preventDefault();
  if (e.repeat) return;
  pulsadas.add(e.code);
  if (e.code === 'KeyR') grabar = true;
  if (e.code === 'Backspace') reiniciar = true;
});
window.addEventListener('keyup', (e) => pulsadas.delete(e.code));
window.addEventListener('blur', () => {
  pulsadas.clear();
  palanca = { dx: 0, dy: 0 };
});

export function tecla(codigo: string): boolean {
  return pulsadas.has(codigo);
}

export function pedirGrabar() {
  grabar = true;
}

export function pedirReiniciar() {
  reiniciar = true;
}

export function fijarPalanca(dx: number, dy: number) {
  palanca = { dx, dy };
}

export function limpiarEntrada() {
  grabar = false;
  reiniciar = false;
  palanca = { dx: 0, dy: 0 };
}

export function leerEntrada(): Entrada {
  const arriba = tecla('KeyW') || tecla('ArrowUp');
  const abajo = tecla('KeyS') || tecla('ArrowDown');
  const izquierda = tecla('KeyA') || tecla('ArrowLeft');
  const derecha = tecla('KeyD') || tecla('ArrowRight');
  let dx = izquierda ? -1 : derecha ? 1 : 0;
  let dy = arriba ? -1 : abajo ? 1 : 0;
  if (!dx && !dy) ({ dx, dy } = palanca);
  const e = { dx, dy, grabar, reiniciar };
  grabar = false;
  reiniciar = false;
  return e;
}

export const TACTIL = window.matchMedia('(pointer: coarse)').matches;

export function montarPalanca(zona: HTMLElement): () => void {
  const base = document.createElement('div');
  base.className = 'palanca';
  const pomo = document.createElement('div');
  pomo.className = 'palanca-pomo';
  base.appendChild(pomo);
  zona.appendChild(base);
  let id = -1;
  let ox = 0;
  let oy = 0;
  const R = 46;

  const mover = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    let vx = e.clientX - ox;
    let vy = e.clientY - oy;
    const d = Math.hypot(vx, vy);
    if (d > R) (vx *= R / d), (vy *= R / d);
    pomo.style.transform = `translate(${vx}px, ${vy}px)`;
    if (d < 14) return fijarPalanca(0, 0);
    const s = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
    const DX = [1, 1, 0, -1, -1, -1, 0, 1];
    const DY = [0, 1, 1, 1, 0, -1, -1, -1];
    const k = (s + 8) % 8;
    fijarPalanca(DX[k], DY[k]);
  };
  const soltar = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    base.classList.remove('activa');
    pomo.style.transform = '';
    fijarPalanca(0, 0);
  };
  const pulsar = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || id !== -1) return;
    if ((e.target as HTMLElement).closest('button, a, input, .sin-palanca')) return;
    const r = zona.getBoundingClientRect();
    if (e.clientX - r.left > r.width * 0.6) return;
    id = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    base.style.left = `${ox - r.left}px`;
    base.style.top = `${oy - r.top}px`;
    base.classList.add('activa');
    e.preventDefault();
  };
  zona.addEventListener('pointerdown', pulsar);
  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);
  return () => {
    zona.removeEventListener('pointerdown', pulsar);
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', soltar);
    window.removeEventListener('pointercancel', soltar);
    base.remove();
    fijarPalanca(0, 0);
  };
}
