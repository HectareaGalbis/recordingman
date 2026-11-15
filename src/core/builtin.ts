import { Nivel } from './level';
import { desdeTexto } from './text';

interface Incluido {
  script?: string;
  texto: string;
}

const INCLUIDOS: Incluido[] = [
  {
    texto: `
nombre Museo
inicio 450 -60 200x200
suelo 0 -100 700x315 color=#d8cfbf
texto 300 -90 "ESTACIÓN DEL MUSEO"
texto 30 180 "Andén 1"
pared 0 -120 700x20
pared -20 -120 20x335
pared 700 -120 20x335
pared 0 200 300x15
pared 400 200 300x15
cartel 40 20 220x150 "Estación del Museo. Sube al tren por la puerta: arrancará cuando todos los jugadores estén sobre el botón." todos
switch s1 60 -60 por=t1 invisible
delay d1 120 -60 tiempo=8.5 por=s1 invisible
puerta g1 180 -60 xor a=s1 b=d1 invisible
suelo 625 245 25x105 color=#a08a6f
suelo 705 245 25x105 color=#a08a6f
suelo 785 245 25x105 color=#a08a6f
suelo 865 245 25x105 color=#a08a6f
suelo 945 245 25x105 color=#a08a6f
suelo 1025 245 25x105 color=#a08a6f
suelo 1105 245 25x105 color=#a08a6f
suelo 1185 245 25x105 color=#a08a6f
suelo 1265 245 25x105 color=#a08a6f
suelo 1345 245 25x105 color=#a08a6f
suelo 1425 245 25x105 color=#a08a6f
suelo 1505 245 25x105 color=#a08a6f
suelo 1585 245 25x105 color=#a08a6f
suelo 1665 245 25x105 color=#a08a6f
suelo 1745 245 25x105 color=#a08a6f
suelo 1825 245 25x105 color=#a08a6f
suelo 1905 245 25x105 color=#a08a6f
suelo 1985 245 25x105 color=#a08a6f
suelo 2065 245 25x105 color=#a08a6f
suelo 2145 245 25x105 color=#a08a6f
suelo 605 260 1600x10 color=#6b6b6b
suelo 605 330 1600x10 color=#6b6b6b
movil 100 215 500x160 ruta=1600,0 vel=200 modo=una apagada por=s1
suelo 100 215 500x160 color=#f3ead8
suelo 115 230 470x12 color=#c0392b
suelo 115 348 470x12 color=#c0392b
pared 100 215 200x15
pared 300 215 100x15 abre=derecha tiempo=0.5/0.3 por=g1 invertida
pared 400 215 200x15
pared 100 360 500x15
pared 100 230 15x130
pared 585 230 15x130
botontodos t1 350 295 r=50
cartel 460 245 110x100 "¡Todos al botón! El tren sale cuando todos los jugadores lo pisan." todos
suelo 1500 -1100 1600x845 color=#efe9df
suelo 1500 -130 1600x345 color=#efe9df
suelo 1500 -255 65x125 color=#efe9df
suelo 1865 -255 1235x125 color=#efe9df
pared 1480 -1120 1640x20
pared 1480 -1100 20x1315
pared 3100 -1100 20x1315
pared 1480 200 420x15
pared 2000 200 1120x15
texto 1880 -30 "MUSEO DE OBJETOS"
cartel 1560 20 280x160 "¡Bienvenidos al Museo! Aquí está cada objeto del creador. Acércate a los carteles de cada sala. La salida está al fondo, arriba a la derecha." todos
control 1875 50 150x140
cartel 2050 40 250x150 "Punto de control: al pisarlo, quien caiga al vacío reaparece aquí y no en la estación."
suelo 1540 -1060 350x220 color=#e3d9c6
suelo 1930 -1060 350x220 color=#e3d9c6
suelo 2320 -1060 350x220 color=#e3d9c6
suelo 2710 -1060 350x220 color=#e3d9c6
suelo 1540 -800 350x220 color=#e3d9c6
suelo 1930 -800 350x220 color=#e3d9c6
suelo 2320 -800 350x220 color=#e3d9c6
suelo 2710 -800 350x220 color=#e3d9c6
suelo 1540 -540 350x220 color=#e3d9c6
suelo 1930 -540 350x220 color=#e3d9c6
suelo 2320 -540 350x220 color=#e3d9c6
suelo 2710 -540 350x220 color=#e3d9c6
suelo 1930 -280 350x220 color=#e3d9c6
suelo 2320 -280 350x220 color=#e3d9c6
suelo 2710 -280 350x220 color=#e3d9c6
suelo 1540 -280 350x25 color=#e3d9c6
suelo 1540 -130 350x70 color=#e3d9c6
suelo 1540 -255 25x125 color=#e3d9c6
suelo 1865 -255 25x125 color=#e3d9c6
pared 1580 -1030 120x80
paredmala 1740 -1030 110x80
cartel 1540 -910 350x70 "Pared: bloquea el paso. Pared mala (roja): destruye a quien la toque. ¡Cuidado!"
boton b1 2020 -985 r=45
pared 2130 -1040 100x110 abre=arriba tiempo=0.5/0.5 por=b1
cartel 1930 -910 350x70 "Botón: está activo mientras lo pisa un jugador o una caja. Písalo y se abrirá la pared conectada."
botontodos t2 2410 -985 r=45
pared 2520 -1040 100x110 abre=arriba tiempo=0.5/0.5 por=t2
cartel 2320 -910 350x70 "Botón de todos: solo se activa cuando todos los jugadores lo pisan a la vez. Si juegas solo, basta contigo."
meta 2835 -1040 100x100
cartel 2710 -910 350x70 "Meta: el nivel se completa cuando todos los jugadores entran en una meta. ¡Esta es la salida del museo!"
interruptor i1 1630 -725 r=30
pared 1740 -780 100x110 abre=arriba tiempo=0.5/0.5 por=i1
cartel 1540 -650 350x70 "Interruptor: cambia de estado cada vez que entras en él. Entra una vez para abrir la pared y otra para cerrarla."
caja 1970 -750 50x50
boton b2 2110 -725 r=40
pared 2180 -780 80x110 abre=arriba tiempo=0.5/0.5 por=b2
cartel 1930 -650 350x70 "Caja: acércate y agárrala para arrastrarla. Las cajas también pulsan botones: déjala sobre el botón."
boton b3 2380 -755 r=30
boton b4 2380 -690 r=30
caja 2430 -750 50x50
puerta g2 2520 -725 and a=b3 b=b4
pared 2580 -780 70x110 abre=arriba tiempo=0.5/0.5 por=g2
cartel 2320 -650 350x70 "Puerta lógica: combina señales (and, or, xand, xor, not). Esta es AND: solo abre con los dos botones pulsados. Usa la caja."
boton b5 2780 -725 r=40
switch s2 2880 -725 por=b5
pared 2950 -780 90x110 abre=arriba tiempo=0.5/0.5 por=s2
cartel 2710 -650 350x70 "Switch: en cuanto su entrada se activa, se queda encendido para siempre. Pisa el botón una vez y la pared no volverá a cerrarse."
temporizador r1 1630 -465 activo=1.5 inactivo=1.5
pared 1740 -520 100x110 abre=arriba tiempo=0.3/0.3 por=r1
cartel 1540 -390 350x70 "Temporizador: se enciende y se apaga solo, una y otra vez. Aquí abre y cierra la pared."
boton b6 1990 -465 r=40
delay d2 2090 -465 tiempo=2 por=b6
pared 2170 -520 90x110 abre=arriba tiempo=0.5/0.5 por=d2
cartel 1930 -390 350x70 "Delay: repite su entrada con retraso. Pisa el botón: la pared se abrirá dos segundos después."
temporizador r2 2620 -465 activo=2 inactivo=2
pinchos 2420 -510 150x100 por=r2
cartel 2320 -390 350x70 "Pinchos: cuentan como suelo, pero encendidos destruyen a quien los pise. Estos se encienden y apagan con un temporizador."
boton b7 2800 -465 r=45
terremoto 2940 -465 intensidad=8 frecuencia=12 radio=250 por=b7
cartel 2710 -390 350x70 "Terremoto: hace temblar la pantalla mientras está activo, en todo el nivel o solo cerca. Pisa el botón."
movil 1565 -255 100x125 ruta=200,0 vel=60 modo=idavuelta
suelo 1565 -255 100x125 color=#8fb8ff
cartel 1540 -130 350x70 "Plataforma móvil: invisible, lleva consigo todo lo que toca. Súbete al suelo azul para cruzar el foso. ¡El tren también es una!"
suelo 1960 -260 90x110 color=#ffd166
suelo 2060 -260 90x110 color=#06d6a0
suelo 2160 -260 90x110 color=#7fb3d5
cartel 1930 -130 350x70 "Suelo: de cualquier color. Es por donde se camina: fuera del suelo se cae al vacío."
texto 2360 -235 "Esto es un objeto texto."
texto 2360 -195 "Se ve siempre, sin acercarse."
cartel 2320 -130 350x70 "Texto: un mensaje fijo que se ve siempre en el nivel, sin necesidad de acercarse."
cartel 2770 -260 230x110 "Este cartel lo ven todos: cuando alguien entra, todos los jugadores leen el mensaje." todos
cartel 2710 -130 350x70 "Cartel: muestra un bocadillo al entrar en su área. Puede verlo solo quien entra o todos los jugadores."
`,
  },
  {
    texto: `
nombre Bosque
fondo #1e3b26
inicio 80 230 150x150
suelo 0 0 700x600 color=#8fd16a
suelo 260 230 440x140 color=#cdb98a
suelo 20 20 75x75 color=#2f7a34
suelo 45 45 25x25 color=#8b5a2b
suelo 560 30 75x75 color=#2f7a34
suelo 585 55 25x25 color=#8b5a2b
suelo 30 480 75x75 color=#2f7a34
suelo 55 505 25x25 color=#8b5a2b
suelo 420 470 75x75 color=#2f7a34
suelo 445 495 25x25 color=#8b5a2b
suelo 600 480 75x75 color=#2f7a34
suelo 625 505 25x25 color=#8b5a2b
suelo 180 90 25x25 color=#f2e94e
suelo 330 120 25x25 color=#f28fb0
suelo 250 500 25x25 color=#f2e94e
suelo 120 420 25x25 color=#ffffff
suelo 480 100 25x25 color=#f28fb0
cartel 270 400 200x120 "Bienvenidos al Bosque. Cruzad el río, esquivad las trampas y llegad todos al Gran Árbol." todos
suelo 700 150 600x300 color=#a6dc7f
suelo 700 260 550x80 color=#cdb98a
caja 780 360 50x50
boton b1 1120 210 r=40
pared 1250 150 30x300 abre=arriba tiempo=0.6/0.6 por=b1
cartel 900 170 150x80 "La verja se abre mientras algo pisa el botón. ¿Y si fuera la caja?"
suelo 1150 375 60x60 color=#2f7a34
suelo 1168 393 25x25 color=#8b5a2b
suelo 1280 200 220x200 color=#8fd16a
control 1300 240 90x120
cartel 1395 210 100x80 "El río: subid a los troncos cuando estén cerca de la orilla."
movil 1500 250 120x100 ruta=230,0 vel=70 modo=idavuelta
suelo 1500 250 120x100 color=#8b5a2b
suelo 1850 200 100x200 color=#6fb54f
suelo 1862 210 50x50 color=#2f7a34
suelo 1875 223 25x25 color=#8b5a2b
movil 1950 250 120x100 ruta=130,0 vel=60 modo=idavuelta
suelo 1950 250 120x100 color=#8b5a2b
suelo 1560 140 30x30 color=#6fb54f
suelo 1700 440 30x30 color=#6fb54f
suelo 2010 150 30x30 color=#6fb54f
suelo 1760 160 30x30 color=#6fb54f
suelo 2200 150 200x300 color=#8fd16a
control 2220 240 90x120
suelo 2400 250 600x100 color=#cdb98a
temporizador r1 2650 200 activo=1.5 inactivo=1.5 invisible
pinchos 2500 250 100x100 por=r1
pinchos 2650 250 100x100 apagado por=r1
pinchos 2800 250 100x100 por=r1
cartel 2310 160 90x80 "Sendero de pinchos: se turnan. Esperad entre ellos a que se apaguen."
suelo 2320 370 60x60 color=#2f7a34
suelo 2338 388 25x25 color=#8b5a2b
suelo 3000 100 500x400 color=#6fb54f
control 3005 255 40x90
paredmala 3100 100 50x250
paredmala 3250 250 50x250
paredmala 3400 100 50x250
terremoto 3275 300 intensidad=4 frecuencia=6 radio=320 activo invisible
cartel 3160 400 80x90 "El zarzal: no toquéis las zarzas rojas. ¡Qué viento!"
suelo 3500 50 600x500 color=#8fd16a
suelo 3500 260 550x80 color=#cdb98a
interruptor i1 3680 130 r=35
interruptor i2 3870 130 r=35
interruptor i3 3775 470 r=35
puerta g1 3775 210 xor a=i1 b=i2
puerta g2 3980 470 and a=g1 b=i3
pared 4050 50 40x500 abre=arriba tiempo=0.6/0.6 por=g2
cartel 3530 380 150x120 "Las setas mágicas abren el paso: solo una de las dos de arriba, y además la de abajo."
suelo 3560 80 25x25 color=#f28fb0
suelo 3990 90 25x25 color=#f2e94e
suelo 3600 520 25x25 color=#ffffff
suelo 4090 200 210x200 color=#a6dc7f
control 4100 240 80x120
cartel 4185 210 110x80 "Subid a la balsa y quedaos sobre el botón para cruzar."
movil 4300 230 120x140 ruta=280,0 vel=90 ascensor apagada por=b2
suelo 4300 230 120x140 color=#8b5a2b
boton b2 4360 300 r=40
suelo 4700 150 200x300 color=#8fd16a
control 4720 250 90x100
cartel 4815 160 80x90 "Troncos espinosos barren el puente. Pasad cuando no estén."
suelo 4900 275 500x50 color=#8b5a2b
movil 5040 160 40x60 ruta=0,220 vel=110 modo=idavuelta
paredmala 5040 160 40x60
movil 5220 380 40x60 ruta=0,-220 vel=110 modo=idavuelta
paredmala 5220 380 40x60
suelo 5400 100 500x400 color=#8fd16a
suelo 5625 125 250x250 color=#2f7a34
suelo 5700 200 100x100 color=#8b5a2b
meta 5675 175 150x150
suelo 5450 130 25x25 color=#f2e94e
suelo 5500 430 25x25 color=#f28fb0
suelo 5860 450 25x25 color=#ffffff
suelo 5470 300 25x25 color=#f28fb0
cartel 5430 380 150x100 "¡Lo habéis conseguido! Entrad todos en el Gran Árbol." todos
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
