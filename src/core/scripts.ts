import type { Sim } from './sim';

export interface Script {
  tick?(sim: Sim): void;
  textos?(sim: Sim): { x: number; y: number; texto: string }[];
}

const T = (x: number, y: number, texto: string) => ({ x, y, texto });

const PASOS_TUTORIAL = [
  [
    T(60, 100, 'Bienvenido a RecordingMan'),
    T(455, 450, 'Muévete con A-S-D-W, con las'),
    T(455, 470, 'flechas o con el joystick.'),
    T(880, 485, 'Dirígete hasta este botón.'),
  ],
  [T(460, 400, 'Bien, la puerta se ha abierto.')],
  [
    T(460, 400, 'Ups, no podemos pasar.'),
    T(460, 450, 'Tendremos que llamar a algún amigo.'),
    T(460, 470, 'Pulsa R (o el botón REC) para llamarlo.'),
  ],
  [
    T(460, 460, 'Ya ha llegado tu amigo.'),
    T(460, 500, 'Este eres el «tú» de antes, una'),
    T(460, 520, 'grabación de tus movimientos.'),
    T(460, 560, 'Haz tantas grabaciones como quieras.'),
    T(460, 580, 'Úsalas bien para pasarte cualquier nivel.'),
  ],
];

export const SCRIPTS: Record<string, Script> = {
  tutorial: {
    tick(sim) {
      const d = sim.datos;
      d.paso ??= 0;
      const pulsado = sim.botones[0]?.activo;
      if (sim.replicas.length) d.paso = 3;
      else if (d.paso === 3) d.paso = 0;
      else if (pulsado && d.paso === 0) d.paso = 1;
      else if (!pulsado && d.paso === 1) d.paso = 2;
    },
    textos(sim) {
      return PASOS_TUTORIAL[sim.datos.paso ?? 0];
    },
  },

  steinitz: {
    tick(sim) {
      const d = sim.datos;
      const mala = sim.malas[0];
      const [a, b] = sim.botones;
      const abajo = sim.paredes[2];
      const arriba = sim.paredes[3];
      if (!mala || !a || !b || !abajo || !arriba) return;
      if (!sim.empezado && !sim.replicas.length) d.elegido = 0;
      d.elegido ??= 0;
      if (d.elegido === 0) {
        mala.abrir(0, 2);
        if (b.activo) d.elegido = 2;
        if (a.activo) d.elegido = 1;
      }
      if (d.elegido === 0) return;
      const cierra = d.elegido === 1 ? a : b;
      const abre = d.elegido === 1 ? b : a;
      if (cierra.activo) mala.cerrar(0, 40);
      else mala.abrir(0, 2);
      if (abre.activo) {
        abajo.abrir(2, 2);
        arriba.abrir(0, 2);
      } else {
        abajo.cerrar(2, 40);
        arriba.cerrar(0, 40);
      }
    },
  },
};
