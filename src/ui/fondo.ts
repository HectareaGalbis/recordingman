import { TIPOS } from '../core/level';
import { h } from './dom';
import { iconoHerramienta } from './editor';

interface Cayendo {
  ico: HTMLCanvasElement;
  x: number;
  y: number;
  tam: number;
  vel: number;
  deriva: number;
  ang: number;
  giro: number;
  alfa: number;
}

export function fondoCayendo(): { el: HTMLCanvasElement; parar: () => void } {
  const el = h('canvas', { class: 'menu-fondo', 'aria-hidden': 'true' });
  const ctx = el.getContext('2d')!;
  const iconos = TIPOS.map((t) => iconoHerramienta(t) as HTMLCanvasElement);
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ancho = 0;
  let alto = 0;
  let objetos: Cayendo[] = [];
  const azar = (a: number, b: number) => a + Math.random() * (b - a);
  const nuevo = (arriba: boolean): Cayendo => {
    const tam = azar(22, 72);
    return {
      ico: iconos[Math.floor(Math.random() * iconos.length)],
      x: azar(-tam / 2, ancho + tam / 2),
      y: arriba ? -tam - azar(0, alto * 0.5) : azar(-tam, alto),
      tam,
      vel: azar(25, 110),
      deriva: azar(-15, 15),
      ang: azar(0, Math.PI * 2),
      giro: azar(-1.6, 1.6),
      alfa: azar(0.35, 0.8),
    };
  };
  const ajustar = () => {
    const dpr = window.devicePixelRatio || 1;
    ancho = el.clientWidth;
    alto = el.clientHeight;
    el.width = Math.round(ancho * dpr);
    el.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cuantos = Math.min(45, Math.max(10, Math.round((ancho * alto) / 26000)));
    while (objetos.length < cuantos) objetos.push(nuevo(false));
    objetos.length = cuantos;
  };
  const dibujar = () => {
    ctx.clearRect(0, 0, ancho, alto);
    for (const o of objetos) {
      ctx.save();
      ctx.globalAlpha = o.alfa;
      ctx.translate(o.x, o.y);
      ctx.rotate(o.ang);
      ctx.drawImage(o.ico, -o.tam / 2, -o.tam / 2, o.tam, o.tam);
      ctx.restore();
    }
  };
  let antes = 0;
  let marco = 0;
  const paso = (ahora: number) => {
    const dt = antes ? Math.min(0.05, (ahora - antes) / 1000) : 0;
    antes = ahora;
    for (let i = 0; i < objetos.length; i++) {
      const o = objetos[i];
      o.y += o.vel * dt;
      o.x += o.deriva * dt;
      o.ang += o.giro * dt;
      if (o.y - o.tam > alto) objetos[i] = nuevo(true);
    }
    dibujar();
    marco = requestAnimationFrame(paso);
  };
  const observador = new ResizeObserver(() => {
    ajustar();
    dibujar();
  });
  observador.observe(el);
  if (!quieto) marco = requestAnimationFrame(paso);
  return {
    el,
    parar: () => {
      cancelAnimationFrame(marco);
      observador.disconnect();
    },
  };
}
