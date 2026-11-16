import { h, modal } from './dom';

export function aHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let hue = 0;
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hue * 60 + 360) % 360, max ? d / max : 0, max];
}

export function aRgb(hue: number, sat: number, val: number): [number, number, number] {
  const f = (k: number) => {
    const m = (k + hue / 60) % 6;
    return Math.round((val - val * sat * Math.max(0, Math.min(m, 4 - m, 1))) * 255);
  };
  return [f(5), f(3), f(1)];
}

export function aHex(hue: number, sat: number, val: number): string {
  return '#' + aRgb(hue, sat, val).map((c) => c.toString(16).padStart(2, '0')).join('');
}

export function ruedaColor(titulo: string, inicial: string, alCambiar: (hex: string) => void): HTMLElement {
  let [hue, sat, val] = aHsv(inicial);
  const lienzo = h('canvas', { class: 'rueda', role: 'img', 'aria-label': titulo });
  const luz = h('input', { type: 'range', class: 'rueda-luz', min: 0, max: 100, step: 1, value: Math.round(val * 100), 'aria-label': `${titulo}: luminosidad` });
  const ctx = lienzo.getContext('2d')!;
  let fondo: ImageData | null = null;
  let fondoVal = -1;

  const dibujar = () => {
    const lado = lienzo.width;
    if (!lado) return;
    const radio = lado / 2;
    if (!fondo || fondo.width !== lado || fondoVal !== val) {
      fondo = ctx.createImageData(lado, lado);
      for (let y = 0; y < lado; y++) {
        for (let x = 0; x < lado; x++) {
          const dx = x + 0.5 - radio;
          const dy = y + 0.5 - radio;
          const dist = Math.hypot(dx, dy);
          if (dist > radio) continue;
          const [r, g, b] = aRgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, dist / radio, val);
          const i = (y * lado + x) * 4;
          fondo.data[i] = r;
          fondo.data[i + 1] = g;
          fondo.data[i + 2] = b;
          fondo.data[i + 3] = Math.round(255 * Math.min(1, radio - dist));
        }
      }
      fondoVal = val;
    }
    ctx.putImageData(fondo, 0, 0);
    const ang = (hue * Math.PI) / 180;
    const mx = radio + Math.cos(ang) * sat * (radio - 1);
    const my = radio + Math.sin(ang) * sat * (radio - 1);
    const k = lado / lienzo.getBoundingClientRect().width || 1;
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.arc(mx, my, 7 * k, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, my, 9 * k, 0, Math.PI * 2);
    ctx.strokeStyle = '#111111';
    ctx.stroke();
  };

  const actualizar = (avisar: boolean) => {
    const hex = aHex(hue, sat, val);
    luz.style.background = `linear-gradient(to top, #000000, ${aHex(hue, sat, 1)})`;
    dibujar();
    if (avisar) alCambiar(hex);
  };

  const ajustarTam = () => {
    const r = lienzo.getBoundingClientRect();
    const lado = Math.round(r.width * Math.min(3, window.devicePixelRatio || 1));
    if (lado && lienzo.width !== lado) {
      lienzo.width = lienzo.height = lado;
      dibujar();
    }
  };
  const observador = new ResizeObserver(() => {
    if (!lienzo.isConnected) return observador.disconnect();
    ajustarTam();
  });
  observador.observe(lienzo);

  const elegir = (e: PointerEvent) => {
    const r = lienzo.getBoundingClientRect();
    const radio = r.width / 2;
    const dx = e.clientX - r.left - radio;
    const dy = e.clientY - r.top - radio;
    hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    sat = Math.min(1, Math.hypot(dx, dy) / radio);
    actualizar(true);
  };
  let pulsado = -1;
  lienzo.addEventListener('pointerdown', (e) => {
    pulsado = e.pointerId;
    lienzo.setPointerCapture(e.pointerId);
    elegir(e);
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (e.pointerId === pulsado) elegir(e);
  });
  const soltar = (e: PointerEvent) => {
    if (e.pointerId === pulsado) pulsado = -1;
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  luz.addEventListener('input', () => {
    val = Number(luz.value) / 100;
    actualizar(true);
  });

  actualizar(false);
  return h('div', { class: 'lobby-color' }, lienzo, luz);
}

export function abrirColor(muestra: HTMLElement, titulo: string, inicial: string, alCambiar: (hex: string) => void, alCerrar?: () => void) {
  const m = modal('',
    h('div', { class: 'color-ventana' },
      muestra,
      h('span', { class: 'color-separador' }),
      ruedaColor(titulo, inicial, alCambiar),
    ),
  );
  m.caja.classList.add('modal-color');
  m.caja.setAttribute('aria-label', titulo);
  if (!alCerrar) return;
  const vigia = new MutationObserver(() => {
    if (m.caja.isConnected) return;
    vigia.disconnect();
    alCerrar();
  });
  vigia.observe(document.body, { childList: true });
}
