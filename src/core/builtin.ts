import { Nivel } from './level';
import { desdeTexto } from './text';

interface Incluido {
  script?: string;
  texto: string;
}

const INCLUIDOS: Incluido[] = [
  {
    script: 'tutorial',
    texto: `
nombre Tutorial
autor Hector Galbis Sanchis
grabaciones inf
inicio 650 600
meta 550 100 200x150
boton b1 985 425
pared 650 290 200x50 abre=derecha vel=2/40 por=b1
pared 450 290 200x50 abre=izquierda vel=2/40 por=b1
pared 1070 290 50x270
pared 900 510 170x50
pared 900 290 170x50
pared 850 510 50x170
pared 850 0 50x340
pared 450 630 400x50
pared 400 0 50x680
pared 450 0 400x50
`,
  },
  {
    texto: `
nombre Bolzano
autor Hector Galbis Sanchis
grabaciones inf
inicio 650 600
meta 1000 100 100x100
boton b1 200 200
boton b2 675 300
pared 950 300 300x50 abre=izquierda vel=2/40 por=b1
pared 50 300 350x50 abre=derecha vel=2/40 por=b2
pared 900 50 50x300
pared 400 50 50x300
pared 50 630 1200x50
pared 50 0 1200x50
pared 1250 0 50x680
pared 0 0 50x680
texto 200 500 "Si una de tus grabaciones termina, simplemente se quedara quieta."
`,
  },
  {
    texto: `
nombre Pitagoras
autor Hector Galbis Sanchis
grabaciones inf
inicio 650 340
meta 1000 290 200x100 n=3
meta 100 290 200x100 n=3
boton b1 650 530 peso=3
boton b2 650 150 peso=3
pared 900 240 50x200 abre=arriba vel=2/40 por=b2
pared 850 240 50x200 abre=abajo vel=2/40 por=b1
pared 350 240 50x200 abre=arriba vel=2/40 por=b1
pared 400 240 50x200 abre=abajo vel=2/40 por=b2
pared 1250 240 50x200
pared 0 240 50x200
pared 450 630 400x50
pared 450 0 400x50
pared 850 440 450x50
pared 850 190 450x50
pared 0 440 450x50
pared 0 190 450x50
pared 850 490 50x190
pared 400 490 50x190
pared 850 0 50x190
pared 400 0 50x190
`,
  },
  {
    texto: `
nombre Descartes
autor Hector Galbis Sanchis
grabaciones inf
inicio 220 550
meta 1000 250 200x180 n=2
boton b1 200 200 r=70
pared 900 340 50x140 abre=abajo vel=2/20 por=b1 invertida
pared 900 200 50x140 abre=arriba vel=2/20 por=b1 invertida
pared 600 340 50x140 abre=abajo vel=2/20 por=b1
pared 600 200 50x140 abre=arriba vel=2/20 por=b1
pared 450 480 800x50
pared 450 150 800x50
pared 400 50 50x150
pared 400 480 50x150
pared 1250 0 50x680
pared 50 630 1200x50
pared 50 0 1200x50
pared 0 0 50x680
texto 80 480 "Presiona la tecla BORRAR para"
texto 80 500 "reiniciar el nivel."
`,
  },
  {
    texto: `
nombre Perelman
autor Hector Galbis Sanchis
grabaciones 1
inicio 300 350
meta 975 275 100x150
boton b1 550 550
boton b2 550 150
pared 900 250 50x200 abre=arriba vel=2/20 por=b2
pared 700 250 50x200 abre=abajo vel=2/20 por=b1
pared 700 0 50x200
pared 400 0 300x50
pared 350 0 50x200
pared 1100 250 50x200
pared 700 200 450x50
pared 200 200 200x50
pared 150 200 50x300
pared 700 450 450x50
pared 200 450 200x50
pared 700 500 50x180
pared 350 500 50x180
pared 400 630 300x50
texto 770 50 "Se ahorrador, en este nivel tienes"
texto 770 70 "un maximo de una grabacion."
`,
  },
  {
    texto: `
nombre Galileo
autor Hector Galbis Sanchis
grabaciones 2
inicio 220 550
meta 1050 100 150x150
boton b1 850 500 r=80 peso=2
boton b2 550 500 r=80 peso=2
pared 950 50 50x250 abre=arriba vel=2/20 por=b1 invertida
pared 700 50 50x250 abre=abajo vel=2/20 por=b1
pared 650 50 50x250 abre=abajo vel=2/20 por=b2 invertida
pared 400 50 50x250 abre=arriba vel=2/20 por=b2
pared 400 300 850x50
pared 1250 50 50x580
pared 0 50 50x580
pared 0 630 1300x50
pared 0 0 1300x50
`,
  },
  {
    script: 'steinitz',
    texto: `
nombre Steinitz
autor Hector Galbis Sanchis
grabaciones 3
inicio 650 600
meta 950 100 150x250
boton b1 350 150
boton b2 350 300
boton b3 900 550 r=65
pared 850 225 50x175 abre=abajo vel=2/20 por=b3
pared 850 50 50x175 abre=arriba vel=2/20 por=b3
pared 800 225 50x175
pared 800 50 50x175
pared 450 50 50x350 abre=arriba vel=2/20 por=b3
pared 200 50 50x350
pared 200 0 1000x50
pared 200 400 250x50
pared 800 400 400x50
pared 980 450 50x230
pared 500 630 480x50
pared 450 400 50x280
pared 1150 50 50x350
paredmala 250 50 200x350
`,
  },
  {
    texto: `
nombre Heine
autor Hector Galbis Sanchis
grabaciones 2
inicio 650 600
meta 375 75 100x150
boton b1 425 375
pared 300 50 50x200
pared 700 300 50x150
pared 300 0 650x50
pared 950 0 50x630
pared 550 450 200x50
pared 500 300 50x200
pared 350 250 400x50
pared 300 250 50x380
pared 300 630 700x50
paredmala 500 50 250x200 abre=arriba vel=50/2 por=b1
paredmala 750 250 200x250 abre=derecha vel=50/2 por=b1
paredmala 350 300 150x200 abre=derecha vel=2/40 por=b1 invertida
`,
  },
  {
    texto: `
nombre Tales
autor Hector Galbis Sanchis
grabaciones 2
inicio 350 550
meta 900 150 100x100
botonmalo m1 775 500
botonmalo m2 575 500
pared 550 100 50x200 abre=abajo vel=2/20 por=m2 invertida
pared 800 100 50x200 abre=arriba vel=2/20 por=m1
pared 650 350 50x250 abre=abajo vel=2/20 por=m2
pared 1050 100 50x200
pared 250 50 850x50
pared 500 300 600x50
pared 850 350 50x250
pared 250 600 650x50
pared 200 50 50x600
`,
  },
  {
    texto: `
nombre Grassman
autor Hector Galbis Sanchis
grabaciones 1
inicio 350 550
meta 875 475 150x100
boton b1 675 325
botonmalo m1 525 175
pared 800 450 50x150 abre=arriba vel=2/20 por=m1
pared 600 450 50x150 abre=abajo vel=2/20 por=b1
pared 1050 450 50x150
pared 600 400 500x50
pared 750 250 50x150
pared 650 200 150x50
pared 600 50 50x200
pared 450 50 150x50
pared 400 50 50x200
pared 250 200 150x50
pared 200 200 50x400
pared 200 600 900x50
`,
  },
  {
    texto: `
nombre De Morgan
autor Hector Galbis Sanchis
grabaciones 3
inicio 450 350
meta 200 275 100x150
boton b1 1037 500 r=75
boton b2 750 350
botonmalo m1 1037 225 r=75
pared 350 350 50x125 abre=abajo vel=2/20 por=m1
pared 350 225 50x125 abre=arriba vel=2/20 por=m1
pared 875 375 50x225 abre=abajo vel=2/20 por=b2
pared 875 100 50x225 abre=arriba vel=2/20 por=b2 invertida
pared 825 100 50x225 abre=arriba vel=2/20 por=b1
pared 100 225 50x250
pared 100 475 250x50
pared 100 175 250x50
pared 350 475 50x175
pared 350 50 50x175
pared 825 325 325x50
pared 400 50 750x50
pared 1150 50 50x550
pared 400 600 800x50
`,
  },
  {
    texto: `
nombre Sophie
autor Hector Galbis Sanchis
grabaciones 4
inicio 300 125
meta 975 75 150x100
boton b1 475 140 peso=2
botonmalo m1 125 140
pared 900 50 50x150 abre=abajo vel=2/40 por=m1
pared 850 200 350x50
pared 800 200 50x480
pared 200 640 600x40
pared 150 250 50x430
pared 450 400 150x50
pared 400 250 50x200
pared 550 50 50x350
pared 400 200 150x50
pared 0 200 200x50
pared 1150 50 50x150
pared 0 50 50x150
pared 0 0 1200x50
paredmala 600 250 200x200 abre=derecha vel=20/2 por=b1
paredmala 400 450 200x200 abre=abajo vel=20/2 por=b1
paredmala 200 250 200x200 abre=izquierda vel=20/2 por=b1
paredmala 400 50 150x150 abre=arriba vel=2/10 por=b1 invertida
`,
  },
  {
    texto: `
nombre Arquimedes
autor Hector Galbis Sanchis
grabaciones 3
inicio 650 600
meta 575 75 150x150
boton b1 925 165 r=65
boton b2 350 550
botonmalo m1 375 165 r=65
botonmalo m2 950 550 peso=2
pared 800 250 250x50 abre=derecha vel=2/20 por=b2
pared 550 300 200x50 abre=derecha vel=2/20 por=m1
pared 550 250 200x50 abre=izquierda vel=2/20 por=m2
pared 250 250 250x50 abre=izquierda vel=2/20 por=b2 invertida
pared 250 300 250x50 abre=izquierda vel=2/20 por=b1
pared 250 630 800x50
pared 750 50 50x300
pared 500 50 50x300
pared 1050 50 50x630
pared 200 50 50x630
pared 200 0 900x50
`,
  },
  {
    texto: `
nombre Heron
autor Hector Galbis Sanchis
grabaciones 1
inicio 350 325
meta 800 250 200x150 n=2
pared 1050 200 50x250
pared 200 450 900x50
pared 200 200 50x250
pared 200 150 900x50
laser 650 200 abajo
texto 300 120 "Procura que seais todos del mismo color que el laser..."
`,
  },
  {
    texto: `
nombre Alhazen
autor Hector Galbis Sanchis
grabaciones 1
inicio 350 325
meta 800 250 200x150
pared 1050 200 50x250
pared 200 450 900x50
pared 200 200 50x250
pared 200 150 900x50
laser 450 200 abajo
laser 650 200 abajo blanco
`,
  },
  {
    texto: `
nombre Hausdorff
autor Hector Galbis Sanchis
grabaciones 1
inicio 250 325
meta 900 200 200x150
boton b1 250 475
pared 350 450 50x150
pared 100 550 250x50
pared 1150 150 50x250
pared 350 400 850x50
pared 100 150 50x400
pared 100 100 1100x50
laser 800 150 abajo blanco por=b1
laser 650 150 abajo por=b1
laser 500 150 abajo blanco por=b1
laser 350 150 abajo por=b1
`,
  },
  {
    texto: `
nombre Tartaglia
autor Hector Galbis Sanchis
grabaciones 1
inicio 400 300
meta 175 75 150x100
meta 375 475 100x100
boton b1 775 530
boton b2 1025 310 r=60
pared 600 400 100x50 abre=derecha vel=2/20 por=b2
pared 500 400 100x50 abre=izquierda vel=2/20 por=b2
pared 350 600 500x50
pared 850 450 50x200
pared 300 450 50x200
pared 700 400 500x50
pared 150 400 350x50
pared 100 50 50x400
pared 100 0 250x50
pared 350 0 50x200
pared 1150 200 50x200
pared 400 150 800x50
laser 850 200 abajo por=b1
`,
  },
  {
    texto: `
nombre Bernoulli
autor Hector Galbis Sanchis
grabaciones 2
inicio 250 300
meta 900 200 200x150 n=2
boton b1 250 475
pared 350 450 50x150
pared 100 550 250x50
pared 1150 150 50x250
pared 350 400 850x50
pared 100 150 50x400
pared 100 100 1100x50
laser 800 150 abajo por=b1
laser 650 150 abajo blanco por=b1
laser 500 150 abajo por=b1
laser 350 150 abajo blanco por=b1
`,
  },
  {
    texto: `
nombre Apolonio
autor Hector Galbis Sanchis
grabaciones 3
inicio 250 300
meta 950 450 150x100
boton b1 225 125
botonmalo m1 1050 125
botonmalo m2 850 125
botonmalo m3 650 125
pared 850 400 50x200 abre=arriba vel=2/20 por=m1
pared 650 400 50x200 abre=arriba vel=2/20 por=m2
pared 450 400 50x200 abre=arriba vel=2/20 por=m3
pared 450 350 700x50
pared 1150 50 50x550
pared 150 600 1050x50
pared 550 0 650x50
pared 500 0 50x150
pared 350 100 150x50
pared 300 50 50x100
pared 150 0 200x50
pared 100 0 50x650
laser 465 350 arriba por=b1
laser 465 148 abajo por=b1
`,
  },
  {
    texto: `
nombre Omar
autor Hector Galbis Sanchis
grabaciones 3
inicio 450 300
meta 125 225 150x150
boton b1 525 530
boton b2 425 130
boton b3 1075 300 peso=2
pared 300 200 50x200 abre=abajo vel=2/20 por=b3
pared 1200 150 50x300
pared 650 400 550x50
pared 550 150 650x50
pared 600 400 50x200
pared 450 600 200x50
pared 500 50 50x150
pared 350 0 200x50
pared 400 400 50x250
pared 300 0 50x200
pared 100 400 300x50
pared 100 150 200x50
pared 50 150 50x300
paredmala 450 400 150x50 abre=izquierda vel=10/40 por=b2 invertida
laser 900 200 abajo blanco por=b1
laser 750 200 abajo por=b1
laser 600 200 abajo blanco por=b1
`,
  },
  {
    texto: `
nombre Cardano
autor Hector Galbis Sanchis
grabaciones 4
inicio 450 350
meta 125 275 150x150
botonmalo m1 1125 380
botonmalo m2 875 180
botonmalo m3 425 530
botonmalo m4 425 180
pared 1000 300 50x150 abre=arriba vel=2/20 por=m2
pared 950 300 50x150 abre=abajo vel=2/20 por=m3
pared 300 250 50x200 abre=arriba vel=2/20 por=m1
pared 1200 300 50x200
pared 1000 250 250x50
pared 950 100 50x200
pared 800 50 200x50
pared 750 50 50x150
pared 550 450 650x50
pared 550 200 250x50
pared 500 450 50x150
pared 500 100 50x150
pared 350 600 200x50
pared 300 500 50x150
pared 350 50 200x50
pared 300 50 50x150
pared 100 450 250x50
pared 100 200 250x50
pared 50 200 50x300
laser 630 450 arriba por=m4
laser 630 245 abajo por=m4
`,
  },
  {
    texto: `
nombre Cantor
autor Hector Galbis Sanchis
grabaciones 1
inicio 550 350
meta 175 275 150x150
botonmalo m1 1000 450
placa p1 500 200 lado=100
placa p2 700 200 lado=100
pared 350 250 50x200 abre=arriba vel=2/20 por=m1
pared 1100 300 50x300
pared 900 300 200x50
pared 850 150 50x200
pared 650 550 450x50
pared 600 500 50x100
pared 400 100 500x50
pared 350 100 50x100
pared 150 450 500x50
pared 150 200 250x50
pared 100 200 50x300
paredmala 850 350 50x200 abre=abajo vel=2/20 por=p1
`,
  },
  {
    texto: `
nombre Lebesgue
autor Hector Galbis Sanchis
grabaciones 1
inicio 550 350
meta 925 275 150x150
botonmalo m1 300 250 r=60
placa p1 575 425 lado=100
placa p2 575 175 lado=100
pared 850 250 50x200 abre=abajo vel=2/20 por=p1 invertida
pared 800 250 50x200 abre=arriba vel=2/20 por=m1
pared 400 200 150x50
pared 400 100 50x100
pared 1100 250 50x200
pared 750 450 400x50
pared 750 200 400x50
pared 700 450 50x100
pared 700 150 50x100
pared 550 550 200x50
pared 550 100 200x50
pared 500 500 50x100
pared 500 100 50x100
pared 200 450 350x50
pared 200 100 200x50
pared 150 100 50x400
paredmala 400 250 50x200 abre=abajo vel=2/20 por=p1
`,
  },
  {
    texto: `
nombre Godel
autor Hector Galbis Sanchis
grabaciones 2
inicio 550 350
meta 475 475 100x100
boton b1 1075 325
botonmalo m1 525 175
placa p1 175 125 lado=100
placa p2 1025 125 lado=100
placa p3 725 125 lado=100
pared 400 100 50x300 abre=arriba vel=2/20 por=b1
pared 150 400 250x50 abre=izquierda vel=2/20 por=p1
pared 850 100 50x300 abre=arriba vel=2/20 por=m1
pared 400 450 50x150 abre=abajo vel=2/20 por=p1 invertida
pared 1150 100 50x300
pared 600 450 50x200
pared 400 400 800x50
pared 100 50 1100x50
pared 100 100 50x550
pared 150 600 450x50
`,
  },
  {
    texto: `
nombre Noether
autor Hector Galbis Sanchis
grabaciones 1
inicio 150 500
meta 1000 250 150x150 n=2
pared 0 0 1300x50
pared 0 630 1300x50
pared 0 50 50x580
pared 1250 50 50x580
pared 300 250 50x380
interruptor i1 175 150
laser 680 50 abajo blanco por=i1
texto 380 90 "Un interruptor cambia cada vez que alguien lo pisa."
texto 380 115 "Y recuerda: cada uno con el laser de su color."
`,
  },
  {
    texto: `
nombre Euler
autor Hector Galbis Sanchis
grabaciones 1
inicio 200 500
meta 975 450 150x120
pared 0 0 1300x50
pared 0 630 1300x50
pared 0 50 50x580
pared 1250 50 50x580
pared 800 50 50x350
pared 850 315 400x50
boton b1 1130 180
pared 800 400 50x230 abre=abajo vel=2/40 por=b1
portal 200 150 > 950 180
texto 280 140 "Los portales te llevan al otro extremo."
`,
  },
  {
    texto: `
nombre Gauss
autor Hector Galbis Sanchis
grabaciones 2
inicio 200 250
meta 1015 345 120x120
pared 0 0 1300x50
pared 0 630 1300x50
pared 0 50 50x580
pared 1250 50 50x580
pared 400 50 50x180
pared 400 450 50x180
boton b1 200 500
pared 400 230 50x220 abre=arriba vel=2/40 por=b1
pared 850 50 50x180
pared 850 450 50x180
pared 900 180 350x50
boton b2 1000 115
pared 850 230 50x220 abre=abajo vel=2/40 por=b2
portal 650 500 > 1175 115
`,
  },
];

export const NUM_INCLUIDOS = INCLUIDOS.length;

const cache: (Nivel | undefined)[] = [];

export function nivelIncluido(i: number): Nivel {
  if (!cache[i]) {
    const n = desdeTexto(INCLUIDOS[i].texto).nivel;
    if (INCLUIDOS[i].script) n.script = INCLUIDOS[i].script;
    cache[i] = n;
  }
  return cache[i]!;
}

export function nombreIncluido(i: number): string {
  return /^nombre (.*)$/m.exec(INCLUIDOS[i].texto)?.[1] ?? `Nivel ${i}`;
}
