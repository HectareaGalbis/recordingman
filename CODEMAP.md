# CODEMAP — RecordingMan

Mapa del proyecto para orientarse rápido al empezar cada sesión. Estado descrito: 2026-11-15.

## Qué es

Juego de puzles 2D (vista cenital) en TypeScript puro + Canvas, sin framework. Un mismo código se compila a tres objetivos:

| Objetivo  | Cómo se empaqueta              | Qué muestra                                                    |
|-----------|--------------------------------|----------------------------------------------------------------|
| `web`     | Vite → `dist/web` → Netlify    | Solo "matchmaking" y niveles compartidos para quien no tiene la app: portada con código de sala/nivel, unirse a salas como invitado, jugar el nivel recibido |
| `android` | Vite → `dist/android` → Capacitor 8 (`android/`) | App completa: menú, niveles, creador, AdMob |
| `desktop` | Vite → `dist/desktop` → Electron (`electron/`)   | App completa, igual que Android sin anuncios |

Los niveles se comparten como enlaces: el nivel entero va codificado en binario+base64url en el parámetro `l`. No hay backend propio.

Todo el código, identificadores y textos están **en español**.

**La web debe gastar lo mínimo** (decisión del usuario): solo lleva el código necesario para unirse a salas y jugar niveles compartidos. Todo lo que es solo de la app se excluye del paquete web con guardas `__OBJETIVO__ !== 'web'` (Vite/Rollup eliminan esas ramas y lo que solo usan ellas) o viviendo en módulos que solo importa `ui/app.ts`. Al añadir algo a módulos compartidos (`juego.ts`, `lobby.ts`, `dom.ts`, `platform.ts`, `core/`), comprobar que no engorda la web (build con `--minify false` y mirar qué entra). Paquete web actual ≈ 22 KB JS + 3,7 KB CSS comprimidos. La web **no descarga nunca `musica.mp3`**: la portada no tiene música y en los niveles la recibe por P2P de quien tiene la app (solo con sala `?s=` o envío `?e=`; los niveles `?l=`/código van sin música). Los efectos son sintetizados, no se transfieren. `public/audio/musica.mp3` se sigue copiando a `dist/web`, pero nadie lo pide.

Nombre: el juego se está renombrando a **partidica**. Por ahora solo lo muestran el menú de la app y la portada web ("¿Una partidica?"); el título de la ventana, la web, Android y Electron siguen como RecordingMan.

## Comandos

`Makefile` envuelve los scripts de `package.json`:

- `make dev` / `make dev-app` — Vite en modo web / desktop (`server.host: true`).
- `make build-web | build-android | build-desktop | build` — siempre `tsc --noEmit` antes.
- `make typecheck`
- `make apk` — build Android + `./gradlew assembleDebug`.
- `make desktop` — build + `electron .`; `make dist-desktop` — electron-builder a `release/`.
- `make deploy` / `make deploy-preview` — `netlify-cli deploy` de `dist/web`.

No hay tests ni linter configurados.

Trampas del entorno (ver memoria `entorno-compilacion`): Android necesita JDK 21 completo; `android/local.properties` (no versionado) tiene `sdk.dir=/home/hectarea/Android/Sdk`, así que `make apk` funciona sin `ANDROID_HOME`; instalar en el móvil con `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`; el binario de Electron se instala con `node node_modules/electron/install.js`; en Ubuntu Electron necesita `chrome-sandbox` con SUID o `--no-sandbox`.

## Configuración

- `vite.config.ts` — el `mode` elige objetivo; define la constante global `__OBJETIVO__` (`'web' | 'android' | 'desktop'`, declarada en `src/global.d.ts`) y la carpeta `dist/<objetivo>`. `base: './'`.
- `.env` (no versionado; plantilla en `.env.example`), leído en `src/config.ts`:
  - `VITE_SHARE_URL` — dominio de los enlaces compartidos (definitivo: `https://recordingman.app`; cambiarlo rompe enlaces ya compartidos).
  - `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT`, `VITE_ADSENSE_SLOT_FIN_IZQ`, `VITE_ADSENSE_SLOT_FIN_DER` — AdSense (web). Opcionales: `VITE_ADSENSE_SLOT_PORTADA_IZQ` / `_DER` (si faltan usan los de fin) y `VITE_ADSENSE_SLOT_PORTADA_MOVIL` (si falta usa `VITE_ADSENSE_SLOT`). No están en `.env.example`; el `.env` actual no tiene IDs de AdSense.
  - `VITE_ADMOB_BANNER_ID` — AdMob (Android); si falta usa el ID de pruebas de Google.
  - `VITE_ANDROID_STORE_URL`, `VITE_DESKTOP_URL` — botones de "descarga la app" en la web.
- `capacitor.config.json` — `appId com.hectarea.recordingman`, `webDir dist/android`, `plugins.SystemBars.hidden: true`.
- `android/app/src/main/java/com/hectarea/recordingman/MainActivity.java` — pantalla completa inmersiva: `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` (Android P+) y `pantallaCompleta()` (`WindowInsetsControllerCompat`, oculta `systemBars()`, reaparecen deslizando); se reaplica en `onWindowFocusChanged`.
- `android/app/src/main/res/values/strings.xml` — `app_link_host` = `recordingman.app` y `admob_app_id` (aún el de pruebas).
- `android/app/src/main/AndroidManifest.xml` — intent-filters: App Links `https://@string/app_link_host` (autoVerify) y esquema `recordingman:`.
- `public/.well-known/assetlinks.json` — `sha256_cert_fingerprints` solo tiene la huella del certificado de **depuración** (`~/.android/debug.keystore`, `09:79:3F:…:3A:0A`), así que los App Links solo se verifican con APKs de depuración. **Pendiente:** al publicar en Play Store, añadir a ese mismo array la huella SHA-256 de "Firma de apps de Google Play" (Play Console → Configuración → Integridad de la app) y volver a desplegar la web. La verificación solo funciona con el archivo ya desplegado en `https://recordingman.app/.well-known/assetlinks.json`.
- `.env.example` y el valor por defecto de `URL_COMPARTIR` en `src/config.ts` siguen con `recordingman.example` (el `.env` real usa `recordingman.app`).
- `public/` — `icono.svg`, `ads.txt`, `privacidad.html`, `audio/musica.mp3`.
- `package.json` → `build` — config de electron-builder (AppImage / nsis / dmg).

## Arranque

`index.html` (`#app`, `#anuncio`) → `src/main.ts`:
1. Añade la clase `obj-<objetivo>` al `body` (el CSS la usa).
2. Si `web` → `ui/web.ts` `iniciarWeb()`; si no → `ui/app.ts` `iniciarApp()` (import dinámico).
3. `platform.iniciarAnuncios()`.

## Estructura de `src/`

```
src/
  main.ts          entrada
  config.ts        constantes de entorno y objetivo
  global.d.ts      declara __OBJETIVO__
  platform.ts      todo lo dependiente de plataforma (portapapeles, compartir, deep links, botón atrás, salir, anuncios)
  store.ts         persistencia en localStorage (prefijo "rm.")
  input.ts         teclado + joystick táctil → Entrada
  audio.ts         efectos con WebAudio (sintetizados) + música mp3
  render.ts        dibujo en canvas (Vista, miniaturas)
  red.ts           multijugador WebRTC (sin dependencias)
  qr.ts            generador de códigos QR propio (matrizQR, svgQR); solo app, import dinámico
  style.css        CSS común (web y app)
  app.css          CSS solo de la app (menú, Niveles, tarjetas, editor); lo importa ui/app.ts, así no viaja a la web
  core/            lógica pura, sin DOM
    level.ts       modelo de datos del nivel, tipos de objeto, límites, sanear()
    sim.ts         simulación determinista por ticks
    codec.ts       nivel ⇄ código binario base64url ⇄ URL
    text.ts        nivel ⇄ lenguaje de texto legible (editor de código)
    scripts.ts     comportamientos programados especiales por nivel
    builtin.ts     niveles incluidos (en texto)
  ui/
    dom.ts         helper h(), iconos SVG, aviso(), modal(), confirmar()
    fondo.ts       fondoCayendo(): iconos del creador cayendo (menú de la app y portada web)
    app.ts         navegación de la app (menú, niveles, creador, ajustes)
    web.ts         página web pública
    lobby.ts       sala multijugador previa a la partida
    juego.ts       pantalla de juego (bucle, cámara, HUD, fin de nivel)
    editor.ts      creador de niveles
```

## `core/` en detalle

### `level.ts` — modelo

- Mundo de referencia `ANCHO 1300 × ALTO 680` (lo que cabe en pantalla); las coordenadas pueden salirse (`LIMITES.coord = ±10000`).
- `Nivel { nombre, autor, fondo, inicio{x,y,w,h}, objetos: Objeto[], script? }`. `inicio` es un rectángulo (esquina superior izquierda, mínimo `LIMITES.inicioMin 100`); `sanear` convierte el formato antiguo `{x,y}` (centro). `puntoInicio(n)` = centro del rectángulo + `SEPARACION_INICIO` en x (donde aparece un jugador solo).
- `Objeto` = unión discriminada por `t`. Orden en `TIPOS` (paleta del editor; el codec usa su propia tabla `CODIGOS`):
  `pared, paredmala, boton, botontodos, interruptor, meta, texto, cartel, suelo, caja, puerta, switch, temporizador, control, pinchos, delay, terremoto, movil`.
  - `cartel`: área rectangular `w×h` con `texto` (≤ `LIMITES.cartel` 300 caracteres). Cuando un jugador entra se muestra un bocadillo con el mensaje **encima del poste** (centro del área). `todos`: lo ven todos aunque solo haya entrado uno; si no, solo quien está dentro. `invisible`: no se dibuja el poste en partida.
  - `pared`/`paredmala`: rect; si `por` apunta a un activador se abre en dirección `abre` (0 arriba,1 derecha,2 abajo,3 izquierda) en `tAbrir` décimas de segundo y se cierra en `tCerrar`; `invertida` invierte. `paredmala` mata al tocarla. `decimasDesdeVel` convierte las velocidades antiguas (`velAbrir/velCerrar`).
  - `boton`: círculo; activo si hay un jugador o una caja encima. `botontodos`: activo solo con todos los jugadores presentes encima.
  - `interruptor`: alterna al entrar.
  - `meta`: rect `w×h`. Un jugador que entra encoge y queda `llego`; el nivel se completa cuando han llegado todos.
  - `texto`, `suelo` (con color; cuenta como suelo para no caerse).
  - `caja`: se agarra y empuja; pulsa botones.
  - `puerta` (puerta lógica `and/or/xand/xor/not`, entradas `a`,`b`) y `switch` (se enclava al activarse `por`; `inicial`). Bloques de `TAM_LOGICA 50`.
  - `temporizador`: alterna activo/inactivo; duraciones `activo`/`inactivo` en décimas.
  - `control`: punto de control rectangular; el primer jugador que entra fija la reaparición para todos.
  - `pinchos`: panel rectangular que cuenta como suelo; activo mata (`inicial`, `por`).
  - `delay`: retrasa `tiempo` décimas la señal de `por`.
  - `terremoto`: tiembla la cámara mientras está activo (`intensidad`, `frecuencia`, `inicial`, `por`); `global` o con `radio` (se atenúa hasta 0 en el borde).
  - `movil`: plataforma rectangular invisible en partida que recorre `ruta` (puntos relativos a la posición inicial) a `vel` px/s con `modo` `idavuelta | bucle | una`. Mueve consigo todo lo que toca al cargar (`miembrosMoviles`, por solape estricto de `zonasObjeto`) y a jugadores/cajas cuyo centro está encima. Con `por`: se mueve mientras esté activa (`inicial` con semántica XOR) o, con `ascensor`, va al final con señal y vuelve al inicio sin ella. `atras`: al desactivarse vuelve hacia el inicio de la ruta a `velAtras` px/s en vez de pararse.
  - Bloques lógicos/efectos (`puerta, switch, temporizador, delay, terremoto`) tienen `invisible`: no se ven en partida y en el editor salen al 35 %.
- Activadores (`esActivador`): boton, botontodos, interruptor, puerta, switch, temporizador, delay. Receptores (`esReceptor`/`ranuras()`): paredes, switch, pinchos, delay, terremoto, movil (`por`) y puerta (`a`,`b`). Un receptor con estado inicial usa XOR: `activo = señal == null ? inicial : señal !== inicial`.
- Los objetos se referencian por `id` numérico. `trasladar(o,dx,dy)` mueve cualquier objeto.
- `crear(t,id,x,y)` da los valores por defecto; `sanear(n)` acota todo con `LIMITES`, re-numera ids duplicados y anula referencias inválidas. Se llama al decodificar, al parsear texto y al abrir el editor.

### `sim.ts` — simulación

- Determinista a `TICKS_POR_SEGUNDO = 40`, `VELOCIDAD 5` px/tick, movimiento en 8 direcciones (`Entrada { dx, dy ∈ {-1,0,1}, agarrar, reiniciar }`).
- `new Sim(nivel, numJugadores = 1, local = 0, semilla = 0)` (clona el nivel); `tick(entradas | entrada[])` avanza un paso y deja en `sim.eventos` los `Evento` del tick (`empezar, reiniciar, muerte, meta, completado, boton, interruptor, caida`) que `juego.ts` traduce a sonidos.
- Azar con semilla (mulberry32, `azar`): con 2+ jugadores cada uno aparece en un punto aleatorio del rectángulo de inicio. La semilla la reparte el anfitrión.
- Estado runtime: `ParedRT` (rect que se encoge al abrir), `BotonRT`, `InterruptorRT`, `CajaRT` (`por` = índice de jugador que la agarra), `PuertaRT`, `SwitchRT`, `TemporizadorRT`, `PinchosRT`, `DelayRT` (cola circular), `TerremotoRT`, `MovilRT { def, miembros, puntos, largo, s, dir, dx, dy }`, `MetaRT`, `Fuego` (fuegos artificiales), `Mono` (jugador: `x,y,r,muerto,llego,ido`).
- Colisiones: punto del jugador contra rect ampliado `MARGEN_PARED 20`. Las cajas tienen núcleo sólido (`BORDE_CAJA 10`).
- Orden de un tick: `objetos()` (botones, interruptores, paredes malas, temporizadores, puertas lógicas, switches, delays, terremotos, paredes, plataformas móviles, pinchos, puntos de control, metas y caídas) → `script.tick` → comprobar completado → empezar (el nivel **empieza en el primer tick**, ya no espera al primer movimiento) → mover jugadores → explosiones y fuegos → reiniciar si se pidió.
- Plataformas: desplazamientos redondeados a píxeles enteros y posiciones absolutas desde el original (determinismo). Si una pared movida aplasta a un jugador, muere.
- Muerte y caída: al morir (pared mala, pinchos, aplastado) hay explosión y el jugador **reaparece al instante**; sin suelo debajo encoge (evento `caida`) y reaparece igual. Reaparece en el centro del último punto de control (`controlActual`) o, si no hay, en el inicio. Volver a pisar el rectángulo de inicio lo convierte otra vez en el punto activo.
- Meta: al entrar en una meta un jugador encoge, queda `llego` y salen fuegos pequeños; cuando todos los no `ido` han llegado → `completado` con fuegos grandes alrededor de `ultimaMeta`.
- `cartelActual()` — el cartel cuyo bocadillo ve el jugador local (está dentro, o es `todos` y hay alguien dentro); `null` si el local está muerto.
- `temblor(ahora)` da el desplazamiento de cámara de los terremotos activos (según el jugador local si tienen radio).
- `quitar(i)` marca un jugador que se ha ido (multijugador). `sim.datos` es almacenamiento libre para scripts. En la web los scripts no se cargan (`__OBJETIVO__ !== 'web'` al elegir `this.script`), así `scripts.ts` no entra en el paquete web.

### `scripts.ts`

`SCRIPTS: Record<string, Script>` con `tick?(sim)` y `textos?(sim)` (textos dinámicos). Existen `tutorial` y `steinitz`. Un nivel los activa con `nivel.script` (solo niveles incluidos; el codec no lo transporta).

### `codec.ts` — enlaces

- `codificar(nivel)` → base64url de: `VERSION(2)`, flags (`F_REJILLA` coords múltiplo de 5, `F_NEGATIVOS` desplaza 200, `F_LEJANOS` desplaza 10000, `F_FONDO`, `F_INICIO` rectángulo de inicio), nombre, autor, [fondo], inicio, nº objetos, y por objeto `num(tipo)` (índice en `CODIGOS`) + byte de flags (bit 128 `F_INVISIBLE`) + varints. Números con signo en zigzag (`signo`, para las rutas). Referencias como índice de objeto.
- Compresión (v3, `VERSION_COMPRIMIDA = 3`): tras generar el v2, el cuerpo (sin el byte de versión) se comprime con un LZ propio síncrono (`comprimir`/`descomprimir`: varint con el largo + flujo de bits; literal = 0 + 8 bits, coincidencia = 1 + gamma(distancia) + gamma(largo−1), ventana 4096). Se emite `[3, …comprimido]` solo si es más corto que el v2; si no, el v2 tal cual. Ahorra ~12–26 % en niveles medianos/grandes. El decodificador acota el tamaño (`MAX_DESCOMPRIMIDO`) y valida distancias.
- `CODIGOS` es la tabla fija de tipos del formato; conserva `'portal'` en el índice 5 para leer enlaces antiguos (se descarta). **No reordenar.**
- `cartel` está al final de `CODIGOS` (índice 18): flag 1 = `todos`, luego x, y, w, h y el texto.
- Flags de `movil`: 1 conectada, `modo<<1`, 8 ascensor, 16 empieza apagada, 32 vuelve atrás (seguido de `velAtras`).
- `decodificar(codigo)` lee v1, v2 y v3 (v3 se descomprime y se procesa como v2; v1: byte `tipo | flags<<4`, velocidades antiguas de pared, `n` de meta ignorado); lanza `Error` con mensaje para el usuario si es inválido o de versión mayor.
- `PARAMETRO = 'l'`; `aUrl`, `extraerCodigo(entrada)` (acepta URL o código suelto ≥ 8 chars), `desdeUrl`.
- **Cambiar el formato rompe los enlaces compartidos**: subir `VERSION` y mantener compatibilidad.

### `text.ts` — lenguaje de niveles

`aTexto(nivel)` / `desdeTexto(texto) → { nivel, errores[] }`. Una instrucción por línea. El comentario de cabecera del archivo está desactualizado (aún muestra `portal`, `vel=` y `n=`); el ejemplo completo y vigente es el del modal de código en `ui/editor.ts`. Sintaxis actual de los objetos nuevos:

```
inicio 600 550 100x100
pared 50 300 350x50 abre=derecha tiempo=1/2 por=b1   segundos para abrir/cerrar (vel= antiguo se convierte)
temporizador r1 x y activo=1 inactivo=2
control x y WxH
pinchos x y WxH apagado por=b1
delay d1 x y tiempo=1.5 por=b1
terremoto x y intensidad=10 frecuencia=8 radio=400 activo por=b1
movil x y WxH ruta=200,0;200,-100 vel=100 modo=idavuelta|bucle|una ascensor apagada atras=50 por=b1
cartel x y WxH "Mensaje del cartel" todos invisible
```

`invisible` se acepta en los bloques lógicos/efectos. `meta … n=` se acepta y se ignora; `portal` es instrucción desconocida. Prefijos de nombre: boton b, botontodos t, interruptor i, puerta g, switch s, temporizador r, delay d. Se usa en el editor (botón "código") y para los niveles incluidos.

### `builtin.ts`

`INCLUIDOS: { script?, texto }[]`, con caché; `NUM_INCLUIDOS`, `nivelIncluido(i)`, `nombreIncluido(i)`. `ui/web.ts` usa `nivelIncluido(0)` como nivel por defecto. Niveles (texto generado con scripts Python sueltos, no versionados):
- **Museo** (131 objetos, fondo `#fafafa`): empieza en una estación (x 0–700) con un tren (`movil` 500×160 `modo=una apagada por=s1`). Cuando todos suben (`botontodos` t1 → switch s1) el tren viaja 1600 px al museo; una puerta lógica `xor s1 d1` con un `delay` de 8,5 s abre la pared de salida al llegar. El museo (x 1500–3100) tiene 16 vitrinas con cada tipo de objeto y un cartel explicativo; punto de control y meta en la vitrina superior derecha.
- **Bosque** (92 objetos, fondo `#1e3b26`, tonos verdes): claro → verja (caja sobre botón) → río (troncos móviles e islote) → pinchos alternos con temporizador → zarzal (paredes malas y terremoto) → setas (interruptores con puertas `xor`/`and`) → balsa (ascensor `apagada` por botón) → puente con barredoras (paredes malas en móviles) → Gran Árbol (meta). Puntos de control entre secciones.

## Resto de `src/`

### `render.ts`

- Paleta `C` (fondo `#fafafa`, tinta, rojo `#ee1c25`, verde, `verdeVivo`, azul, caja, `control`, `controlActivo`, `pinchos`, `pinchosHueco`…).
- `dibujarNivel(ctx, sim, op)` (`op.editor` = modo editor) y `dibujarConexiones(ctx, sim, editor)` (líneas activador→receptor; se ven antes de empezar, con Tab o con el botón; en partida se ocultan las de bloques invisibles).
- Inicio: rectángulo gris claro con bandera de cuadros y monigote al lado. Punto de control: gris hasta activarse, luego bandera verde vivo y fondo verde muy claro. Pinchos: panel gris oscuro con huecos; activos en rojo con triángulos girando. Fuegos artificiales con `COLORES_FUEGO`.
- Carteles: en el editor, área discontinua con un poste en el centro (escalado si el área es pequeña); en partida, poste y, si `sim.cartelActual()` lo indica, `bocadillo()` encima del poste (texto partido con `partirTexto`, ancho máx. 260).
- Colores de jugador: `OpcionesDibujo.colores?: {p, s}[]` (relleno primario y borde secundario por índice de jugador); por defecto negro y blanco.
- Las plataformas móviles solo se dibujan en el editor, con banda de borde rellena de `BORDE_MOVIL 10` px (lo seleccionable).
- `pinSalida/pinEntrada/centroReceptor` — posiciones de pines de conexión (también las usa el editor).
- `class Vista` — canvas con cámara (`cx, cy, escala`), `ajustar()` a tamaño/DPR, `aMundo()`, `dibujar(sim, op)` con interpolación (`alfa`, `previas`). `completa` = el canvas ocupa toda la pantalla (lo usan el editor y la partida).
- `simEstatica(nivel)` y `miniatura(nivel, ancho)` para tarjetas.

### `input.ts`

Estado global de teclado (WASD/flechas, Espacio = agarrar, Backspace = reiniciar, Tab = conexiones; en partida ya no hay botón de conexiones), ignora eventos en campos de texto. `leerEntrada()` consume el reinicio pendiente. `TACTIL` (pointer coarse) → `montarPalanca(zona)`: joystick virtual en el 60 % izquierdo, 8 direcciones.

### `audio.ts`

Efectos sintetizados por `Evento` (WebAudio; incluye `caida`), se desbloquean con el primer gesto. Música en bucle, pausa al ocultar la pestaña. Respetan `ajustes.musica/efectos`. `fuente` es `audio/musica.mp3` en la app y `null` en la web hasta que `ponerMusica(blob)` (lo llama `red.ts` al recibirla por P2P) crea una URL de objeto. `permitirMusica(si)` la silencia por pantalla (la portada web la desactiva y `montarWeb` la reactiva).

### `store.ts`

localStorage con prefijo `rm.`:
- `ajustes {musica, efectos, autor}`.
- `propios` — niveles del creador `{id, nivel, modificado}` (`guardarPropio`, `borrarPropio`).
- `descargados` — niveles de otros `{id, codigo, nombre, autor, anadido}` (`guardarDescargado(codigo, nivel)` no duplica, `borrarDescargado`). La primera lectura migra la lista antigua `favoritos` a descargados marcados como favoritos.
- `meta` — `Record<clave, {favorito?, etiquetas?}>` por nivel. Claves: `p:<id>` propio, `d:<id>` descargado, `i:<n>` incluido (`meta`, `metas`, `guardarMeta`, `todasEtiquetas`, `limpiarEtiqueta`; `MAX_ETIQUETAS 10`, `LARGO_ETIQUETA 20`). `claveDeCodigo(codigo)` busca a qué nivel corresponde un código.
- `esFavorito(codigo)` / `alternarFavorito({codigo,…})` (estrella de la partida) trabajan sobre `meta`; si el nivel no está guardado lo añade a descargados.
- `progreso` / `marcarSuperado` y `favoritos` siguen existiendo pero ya no se usan (salvo `favoritos` para migrar).
- `nuevoId()`.

### `platform.ts`

Abstrae diferencias por `__OBJETIVO__`:
- `copiar`, `compartir` (Capacitor Share / Web Share), `PUEDE_COMPARTIR`.
- `alAbrirUrl` (Capacitor `appUrlOpen` + launch URL / Electron `rmEscritorio`), `alAtras` (botón atrás Android), `salir`, `PUEDE_SALIR`.
- Anuncios web (AdSense, `bloqueAdsense`, consentimiento revocable con `revocarConsentimiento` / Funding Choices). `iniciarAnuncios()` ya no pone nada en la web al arrancar; cada pantalla pide sus huecos: portada en PC (≥1000 px) `huecosAnuncioPortada()` → 160×600 a cada lado (`.anuncio-lado`); portada en móvil `huecoAnuncioMovil()` → rectángulo 300×250 bajo la tarjeta (`.anuncio-movil`); pantalla de nivel completado `huecosAnuncioFin()` → dos laterales en PC, uno solo en móvil (<760 px). Lobby y partida: sin anuncios. El hueco `#anuncio` inferior ya no se usa en la web. Android → AdMob banner adaptativo inferior + formulario UMP; `anuncio(visible)` lo oculta/muestra y ajusta la variable CSS `--anuncio`. Desktop → sin anuncios.

### `red.ts` — multijugador

- WebRTC DataChannel, señalización por el **servidor público de PeerJS** (`wss://0.peerjs.com`) con cliente propio (`Senal`). Solo acepta `OFFER/ANSWER` con la forma exacta de PeerJS o cierra el socket (ver memoria `multijugador-senalizacion`). STUN de Google; ICE no trickle (espera `ESPERA_ICE`).
- Peer IDs `rm-<sala>`; sala = 10 caracteres aleatorios. Máx. 8 jugadores.
- Enlaces: sala multijugador `?s=<sala>` (`urlDeSala(sala)`, `extraerSala`) sin el nivel; los antiguos `?l=…&s=…` siguen funcionando. Envío de nivel `?e=<sala>` (`urlDeEnvio`, `extraerEnvio`, `PARAMETRO_ENVIO`).
- Colores de monigote: `Colores {p, s}` (`COLOR_PRIMARIO` `#111111`, `COLOR_SECUNDARIO` `#ffffff`, validados con `esColor` / `limpiarColores`); cada jugador los manda con `{c}`, van en la lista `{j}` (`JugadorSala extends Colores`), en `ini` (`co`) y en `Sesion.colores`.
- Música por P2P: el cliente web pide `{pm:1}`; el lado app (`enviarMusica`, solo no-web) abre un datachannel `musica`, manda la cabecera `{mu: tamaño}` y trozos de `TROZO` 16 KB con control de flujo por `bufferedAmount` (máx. `MAX_MUSICA` 8 MB, límite `ESPERA_MUSICA` 2 min), y espera el acuse. `recibirMusica` (solo web) junta los trozos en un Blob y llama a `ponerMusica`. `leerMusica()` lee y cachea el mp3 en la app.
- Reconexión de quien comparte (`Anfitrion` y `Emisor`): el id de sala (`idSala`, getter `codigoSala`) se mantiene entre reaperturas, así el enlace y el QR siguen valiendo. Si se cae la señalización, `reabrir(espera)` reintenta con espera creciente 2–15 s; si la app ha estado oculta más de `OCULTO_MAX` (15 s), al volver cierra y reabre la señalización (`alVisibilidad`). `esperando`/`alCambiar` dan el estado a la UI ("Reconectando la sala…").
- Reintento de quien se une (`Invitado` y `Receptor`): si la sala aún no existe o falla antes de conectar, reintenta cada `ESPERA_REINTENTO` 3 s hasta `ESPERA_ANFITRION` 3 min (`esperando = true`, "Esperando al anfitrión…"). Una vez conectado, un corte es definitivo ("Se ha perdido la conexión con el anfitrión").
- `Anfitrion(nombre, codigo, colores)`: abre sala, acepta ofertas, manda `{nv: codigo}` a cada jugador al entrar, mantiene la lista, `empezar()` → `Sesion`. Es la autoridad: cada tick difunde el array de códigos de entrada de todos y ejecuta el tick.
- `Invitado`: conecta, manda nombre y cambios de entrada; al recibir `{nv}` lo valida (`decodificar`, `LARGO_MAX_CODIGO`) y llama a `alNivel(codigo)`; encola los arrays del anfitrión y ejecuta ticks (con recuperación si se retrasa).
- Entrada codificada en un entero 0–35 (`aCodigo/deCodigo`; +9 reiniciar, +18 agarrar). El anfitrión descarta el bit de reinicio de los invitados: **solo el anfitrión reinicia**. Mensajes JSON: `{nv}` código del nivel, `{ok}` recibido (envío), `{n}` nombre, `{c}` colores, `{pm}` pide música, `{e}` entrada, `{j,tu}` lista, `{ini,tu,se,co}` inicio (con semilla y colores), `[...]` tick, `{f}` baja, `{x}` rechazo.
- `Sesion { jugadores, local, semilla, colores, paso(e, tick, quitar) }` la consume `juego.ts`.
- `Emisor(codigo)`: sala solo para enviar un nivel ("Compartir nivel" sin el nivel en el enlace). `abrir()` → sala; a cada conexión le manda `{nv}`, atiende `{pm:1}` con la música, al `{ok:1}` suma `recibidos` y cierra esa conexión cuando termina la música. Se reconecta como el anfitrión.
- `Receptor(sala)`: se conecta a un `Emisor` (reintentando hasta 3 min), valida el código, responde `{ok:1}` y resuelve `nivel: Promise<string>`; en la web pide antes la música y cierra al recibirla; `cancelar()`. Pasado el límite: "El enlace ya no está disponible: quien lo compartió no está conectado".

## `ui/` en detalle

- `dom.ts` — `h(tag, props, ...hijos)` (props `class`, `html`, `on*`, propiedades o atributos), `icono(nombre)` / `botonIcono` con SVG inline en `ICONOS`. `ICONOS` solo tiene los que usa la web (atras, reiniciar, conexiones, musica, sonido, pantalla, jugar, enlace, cerrar, engranaje); los de la app y el editor (compartir, estrella, deshacer, rehacer, codigo, mas, borrar, duplicar, editar, ajustes, candado, seleccionar, desplazar, etiqueta, sala) los añade `ui/app.ts` al cargar con `registrarIconos({...})`. Un icono nuevo solo de la app va ahí; `aviso()` (toast), `modal()`, `confirmar()`.
- `app.ts` (android/desktop) — una pantalla a la vez con `mostrar(el, volver, conAnuncio, limpiar)`. Pantallas:
  - `menu` — logo "¿Una partidica?" (`logo()`, clase `logo-partidica`; "una" y "?" a media escala), botones centrados grises que se vuelven negros al pasar (Niveles, Creador de niveles, Ajustes, Salir si `PUEDE_SALIR`) y `fondoCayendo()` (de `ui/fondo.ts`): canvas `.menu-fondo` con los iconos de la paleta del creador (`iconoHerramienta` de `editor.ts`, todos los `TIPOS`) cayendo con tamaño, velocidad, deriva, giro y opacidad aleatorios; se reciclan arriba, la cantidad depende del área y se para al salir (`mostrar(..., fondo.parar)`); quietos con `prefers-reduced-motion`.
  - `pantallaNiveles` — todos los niveles (`entradasNiveles()`: propios, descargados e incluidos, cada uno `EntradaNivel {clave, origen, nivel, codigo, fecha, borrar?}`). Panel izquierdo (arriba en móvil): búsqueda por nombre, orden (`recientes | nombre | autor`) y filtros de tres estados (sin filtro → incluir → excluir) para Favoritos, Propios, Descargados, Incluidos (si hay) y cada etiqueta. Se combinan con "y": todos los incluir y ningún excluir (`cumple`). Estado en `vista` (solo en memoria). Botón "Añadir desde enlace" (guarda descargado; `?s=` → `unirseSala`).
  - `tarjetaNivel` — jugar solo (`jugarSolo` → `montarJuego` directo), crear sala (`jugarCompartido` → lobby), favorito, etiquetas (`editarEtiquetas`: modal con chips y sugerencias), editar una copia (`editarCopia`: avisa, crea un propio "(copia)" y abre el editor), compartir, borrar (no en incluidos; en propios avisa de que se borra también del creador). No hay duplicar.
  - `jugarCompartido(codigo, volver, sala?, invitado?)` — guarda el nivel en descargados (`guardarDescargado`) y abre el lobby.
  - `creador` — solo niveles propios: editar, compartir, duplicar, borrar y "Nuevo nivel" (ya no tiene "Importar").
  - `abrirEditor`, `abrirAjustes`.
  - Ya no existen `niveles` (desbloqueo secuencial), `jugarIncluido` ni `pantallaFavoritos`. Esc / botón atrás → `atras`. Deep links y "Abrir enlace": `?l=` → `jugarCompartido`; `?e=` → `recibir` (modal "Recibiendo nivel" con `Receptor`); `?s=` → `unirseSala` (modal, `conectarSala`, al llegar el nivel `jugarCompartido(c, volver, undefined, invitado)`). Todo nivel abierto desde un enlace queda guardado en Niveles.
- `web.ts` — `iniciarWeb()`:
  - Sin argumentos → `portada(raiz, error?)`: logo "¿Una partidica?", descripción breve, fondo `fondoCayendo()`, tarjeta con caja "Código de sala o de nivel", botón "Pegar" (si hay `navigator.clipboard.readText`) y "Unirse", huecos de anuncio. `destinoDe(texto)` acepta código de sala (6–20 alfanuméricos; sin distinguir mayúsculas e ignorando espacios), código de nivel (si `decodificar` lo acepta) o un enlace `?s=`/`?e=`/`?l=`, y navega con `location.assign` a esa URL. La portada limpia la URL con `history.replaceState`.
  - `?s=` → `conectarSala` y espera el nivel ("Conectando con la sala…"; mientras reintenta, "Esperando al anfitrión…") → lobby como invitado. `?e=` → `Receptor` ("Recibiendo nivel…"; mientras reintenta, "Esperando a quien compartió el nivel…"). `?l=` → directo.
  - `portada` llama a `permitirMusica(false)` y `montarWeb` a `permitirMusica(true)`.
  - `montarWeb(raiz, codigo, invitado?)`: sin sala → `montarJuego` directo (sin lobby); con sala (o enlace antiguo `?l=…&s=…`) → `montarLobby` con `alCaer` que vuelve a la portada.
  - Cualquier fallo (nivel inválido, sala cerrada, envío no disponible, conexión perdida) → portada con el mensaje en la tarjeta. `pieLegal()` (enlaces de privacidad y cookies, una sola vez). `accionesFin`: "Abrir en la app" (intent de Android), "Crea tus niveles con la app/en PC". La web no comparte niveles ni crea salas.
- `lobby.ts` — `conectarSala(sala)` crea un `Invitado` con el nombre actual. `montarLobby(raiz, op)`: usa `op.invitado` si viene ya conectado, o crea `Anfitrion(nombre, op.codigo)` (o `Invitado` si hay `op.sala`); el enlace de invitación es `urlDeSala(sala)`; lista de jugadores (con muestra de sus colores), nombre, selector de color primario y secundario ("Tu monigote", estado de módulo `colores`, por defecto negro/blanco), botón Invitar (solo app, no web) y Empezar; al empezar llama a `montarJuego` con la `Sesion`. Si el invitado cae: con `op.alCaer` (web) lo llama; si no (app), vuelve a crear sala propia. En la web nunca se crea un `Anfitrion` (guarda `__OBJETIVO__ === 'web'`) y `invitar` no hace nada. Cuando la sala está abierta muestra el código grande (`.lobby-codigo`, mayúsculas en dos grupos de 5, solo el anfitrión), el enlace y un **código QR** del enlace (`.lobby-qr`, import dinámico de `qr.ts`, no en la web), todo a partir de `codigoSala` (no cambia al reconectar). Estados: "Reconectando la sala…" / "Sala abierta. Escanea el código QR o pasa el enlace…"; invitado esperando: "Esperando al anfitrión…".
- `juego.ts` — `montarJuego(raiz, OpcionesJuego) → destruir`. Bucle `requestAnimationFrame` con paso fijo e interpolación; cámara que sigue al jugador local (suavizado). El mapa ocupa toda la pantalla (`vista.completa`, `body.en-partida` quita los rellenos); sin nombre ni autor ni pistas (`ponerPista` siempre vacía). Arriba solo flotan dos botones sin banda: atrás y engranaje, que abre `.menu-juego` con Reiniciar (si puede), sonido, música y Pantalla completa (solo web); se cierra al tocar fuera o con Esc. Ya no hay botones de conexiones (Tab sigue funcionando), favorito ni compartir en partida. En la web pide pantalla completa (y orientación horizontal) al entrar y, si el navegador lo rechaza, en el primer toque/tecla. En multijugador Reiniciar y "Repetir" solo los ve el anfitrión (`local === 0`); pasa `op.sesion.colores` al dibujo; botón contextual "Agarrar"; temblor de terremotos aplicado a la cámara; pantalla de fin 1 s después de completar, con tiempo y `accionesFin`. `urlDeCodigo`. `compartirNivel(codigo, nombre, detalle?)` abre el modal "Compartir nivel" (lo usan todos los botones de compartir): casilla "Incluir el nivel en el enlace" marcada por defecto (`?l=…`); con la casilla marcada también "Copiar código del nivel" (copia solo el código); desmarcada abre un `Emisor` y da `?e=<sala>` (desde `codigoSala`) con un QR del enlace corto (`.compartir-qr`, solo app) y los estados "Abriendo sala…" / "Reconectando la sala…" / "Esperando a que alguien abra el enlace…" / "Recibido por N jugadores", más la nota de dejar la ventana abierta; la sala se cierra al cerrar el modal (MutationObserver) o al volver a marcar.
- `editor.ts` — `montarEditor(raiz, nivel, { alCambiar, alSalir }) → { atras, destruir }`. Exporta también `iconoHerramienta(tipo)` (icono en canvas de 56 px de la paleta; lo usa `ui/fondo.ts`). Paleta de herramientas (en táctil incluye "Mapa" para desplazar), rejilla de 25, selección/arrastre/asas de redimensionado (`asas`, `asasInicio` para el rectángulo de inicio), selección múltiple con Ctrl (`grupo`) para mover/duplicar juntos, conexiones arrastrando pines, inspector lateral por tipo (`campoNumero`, `campoSegundos`, `campoOpciones`), pan con clic derecho y rueda; plataformas móviles: se seleccionan por su banda de borde, ruta con asas por punto (`asasRuta`), "+" en mitad de cada tramo para insertar punto, "Añadir punto"/"Quitar último", miembros resaltados en verde; círculo de radio del terremoto al seleccionarlo; carteles con inspector de ancho, alto, mensaje y "Lo ve: Solo quien entra / Todos"; deshacer/rehacer (historial JSON de 120, Ctrl+Z/Y), Ctrl+D duplicar, Supr borrar, modal de nombre/autor, modal de código (`text.ts`), compartir (exige una meta y nombre/autor; usa `compartirNivel`), "Probar" (monta `montarJuego` en una capa). Cada cambio confirmado llama a `alCambiar` → `store.guardarPropio`.

## Electron (`electron/`)

- `main.cjs` — instancia única, protocolo `recordingman:`, ventana 1300×760 sin menú y a pantalla completa por defecto (`fullscreen: true`), carga `dist/desktop/index.html`, F11 alterna pantalla completa, enlaces externos al navegador, IPC `url-inicial` y `salir`.
- `preload.cjs` — expone `window.rmEscritorio { salir, alAbrirUrl }`.

## Convenciones

- Español en todo (nombres, UI, commits).
- Sin framework ni dependencias de runtime salvo plugins de Capacitor; el multijugador se hizo sin PeerJS a propósito.
- `core/` no toca el DOM.
- Las ramas por plataforma se hacen con `__OBJETIVO__` para que Vite elimine el código muerto; los plugins de Capacitor se importan dinámicamente.
- Toda entrada externa (URL, texto, red) pasa por `sanear` / `limpiarNombre` / validación.

## Estado del trabajo (2026-11-15)

Últimos commits: `f96bb43` (More objects) y `a953d07` (Better sharing) recogen los objetos nuevos, bloques invisibles, caída y reaparición, meta para todos con fuegos artificiales, retirada de los portales, formato de enlace v2 y compresión v3, multijugador (solo reinicia el anfitrión; salas solo con `?s=`), compartir por P2P (`?e=`) y App Links con `recordingman.app`. Sin commitear: nuevo menú ("¿Una partidica?", fondo de objetos cayendo), sección Niveles (favoritos, etiquetas, filtros, orden), portada web con código de sala/nivel, código de sala grande en el lobby, "Copiar código del nivel", web reducida al mínimo (CSS separado en `app.css`, iconos de la app registrados aparte, sin compartir/anfitrión/scripts en la web), nueva colocación de anuncios, pantalla completa en las tres plataformas, partida a pantalla entera con menú de engranaje y sin pistas, inicio automático del nivel, objeto `cartel`, niveles incluidos Museo y Bosque, música por P2P en la web, colores de monigote, reconexión de salas y envíos, y códigos QR.

## Pendientes y decisiones abiertas (anotado 2026-11-15)

### Decisiones que tiene que tomar el usuario
- **Renombre a "partidica"**: hecho solo en el menú de la app y la portada web. Siguen como RecordingMan: `<title>` y metaetiquetas de `index.html`, `document.title` del nivel en la web (`… · RecordingMan`), texto de `compartir()` en `platform.ts` ("Juega a «…» en RecordingMan"), `app_name` de Android, Electron, `appId`/paquete `com.hectarea.recordingman`, este archivo. El dominio sigue siendo `recordingman.app` (cambiarlo rompe enlaces).
- **Código de sala**: solo existe tras pulsar "Invitar" (la sala se abre ahí) y solo lo ve el anfitrión. ¿Abrir la sala al entrar al lobby? ¿Mostrarlo también a los invitados?
- **Niveles incluidos**: solo Museo y Bosque (no hay tutorial; el script `tutorial` existe pero ningún nivel lo usa). Se quitó el desbloqueo secuencial; `progreso`/`marcarSuperado` de `store.ts` quedan sin uso.
- **Compartir en Android sin cortes del todo**: la reconexión cubre salir un rato de la app para mandar el enlace, pero mientras la app está suspendida nadie puede entrar, y salir en mitad de una partida la corta. La alternativa de un servicio en primer plano (opción 2 de las planteadas) no está hecha.
- Filtros/búsqueda/orden de Niveles no se guardan entre sesiones (solo en memoria).
- Un invitado que pulsa Borrar (reiniciar) no recibe ningún aviso de que solo reinicia el anfitrión.

### Configuración / publicación
- **Huella de Play Store en `public/.well-known/assetlinks.json`**: añadir la SHA-256 de "Firma de apps de Google Play" (Play Console → Configuración → Integridad de la app) junto a la de depuración y redesplegar la web. Sin ella, la app publicada no se abrirá desde los enlaces de `recordingman.app`.
- `admob_app_id` en `strings.xml` (aún el de pruebas). No hay firma de release configurada en Gradle.
- AdSense: el `.env` no tiene IDs; los anuncios nunca se han visto reales (solo se comprobó que los huecos se crean en su sitio). Crear bloques para portada (laterales 160×600 y móvil 300×250) si se quieren separados de los de fin.
- `.env.example` no tiene `VITE_ADSENSE_SLOT_PORTADA_IZQ/_DER/_MOVIL` y sigue con `recordingman.example`, igual que el valor por defecto de `URL_COMPARTIR` en `src/config.ts`.
- App Links no probados en un dispositivo real; requieren la web desplegada con `assetlinks.json`.
- Una app instalada antes del formato v3 / los enlaces `?s=` y `?e=` no podrá abrirlos.

### Riesgos conocidos
- Todo el P2P depende del servidor público gratuito de PeerJS (`0.peerjs.com`) y solo de STUN; redes con NAT estricto pueden necesitar TURN.
- En Android, al salir a otra app para mandar un enlace corto (`?e=`) o de sala, el sistema puede suspender la app; al volver la sala se reabre con el mismo código y quien espera (hasta 3 min) entra solo.
- El QR se ha verificado contra valores de referencia (Reed-Solomon, formato, versión) y en la UI, pero **no se ha escaneado con la cámara de un móvil real**.
- El nivel empieza ya en el primer tick: las simulaciones estáticas (`simEstatica`, miniaturas, editor) que avanzan ticks ahora hacen avanzar el nivel (temporizadores, móviles…).
- Si AdSense no tiene anuncio, los laterales de la portada quedan como franjas vacías de 160 px.
- No hay tests ni linter; las pruebas se hicieron con scripts de Electron sueltos (ver memoria `multijugador-senalizacion`).

### Restos y detalles menores sin tocar
- Comentario de cabecera de `src/core/text.ts` desactualizado (`portal`, `vel=`, `n=`; tampoco recoge `cartel`).
- Código y CSS de las pistas de partida (`ponerPista`, textos de pista) siguen ahí aunque ya no se muestran; las funciones de favorito y compartir de la barra antigua de partida ya no se usan desde `juego.ts`.
- CSS del logo antiguo (`.logo`, `.logo .r/.o/.punto`, `@keyframes flotar`) y el hueco `#anuncio` (HTML + CSS) ya no se usan en la web.
- Campo `reaparicion` de `Sim` se rellena pero no se usa; icono `candado` sin uso; `favoritos` en `store.ts` solo sirve para migrar.
- La paleta del editor muestra una barra de scroll horizontal (ya pasaba antes de separar el CSS).
- Iconos del fondo cayendo generados a 56 px y escalados hasta 72 px (algo borrosos en pantallas densas).
- Plataforma móvil "encendida al inicio" + conectada: se mueve mientras el activador está **suelto** (semántica XOR de siempre); puede confundir.
