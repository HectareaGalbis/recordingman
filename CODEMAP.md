# CODEMAP — RecordingMan

Mapa del proyecto para orientarse rápido al empezar cada sesión. Estado descrito: 2026-11-15.

## Qué es

Juego de puzles 2D (vista cenital) en TypeScript puro + Canvas, sin framework. Un mismo código se compila a tres objetivos:

| Objetivo  | Cómo se empaqueta              | Qué muestra                                                    |
|-----------|--------------------------------|----------------------------------------------------------------|
| `web`     | Vite → `dist/web` → Netlify    | Solo juega el nivel que va en la URL (`?l=…`) o el nivel 0; con sala multijugador |
| `android` | Vite → `dist/android` → Capacitor 8 (`android/`) | App completa: menú, niveles, creador, favoritos, AdMob |
| `desktop` | Vite → `dist/desktop` → Electron (`electron/`)   | App completa, igual que Android sin anuncios |

Los niveles se comparten como enlaces: el nivel entero va codificado en binario+base64url en el parámetro `l`. No hay backend propio.

Todo el código, identificadores y textos están **en español**.

## Comandos

`Makefile` envuelve los scripts de `package.json`:

- `make dev` / `make dev-app` — Vite en modo web / desktop (`server.host: true`).
- `make build-web | build-android | build-desktop | build` — siempre `tsc --noEmit` antes.
- `make typecheck`
- `make apk` — build Android + `./gradlew assembleDebug`.
- `make desktop` — build + `electron .`; `make dist-desktop` — electron-builder a `release/`.
- `make deploy` / `make deploy-preview` — `netlify-cli deploy` de `dist/web`.

No hay tests ni linter configurados.

Trampas del entorno (ver memoria `entorno-compilacion`): Android necesita JDK 21 completo; el binario de Electron se instala con `node node_modules/electron/install.js`; en Ubuntu Electron necesita `chrome-sandbox` con SUID o `--no-sandbox`.

## Configuración

- `vite.config.ts` — el `mode` elige objetivo; define la constante global `__OBJETIVO__` (`'web' | 'android' | 'desktop'`, declarada en `src/global.d.ts`) y la carpeta `dist/<objetivo>`. `base: './'`.
- `.env` (no versionado; plantilla en `.env.example`), leído en `src/config.ts`:
  - `VITE_SHARE_URL` — dominio de los enlaces compartidos (definitivo: `https://recordingman.app`; cambiarlo rompe enlaces ya compartidos).
  - `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT`, `VITE_ADSENSE_SLOT_FIN_IZQ`, `VITE_ADSENSE_SLOT_FIN_DER` — AdSense (web).
  - `VITE_ADMOB_BANNER_ID` — AdMob (Android); si falta usa el ID de pruebas de Google.
  - `VITE_ANDROID_STORE_URL`, `VITE_DESKTOP_URL` — botones de "descarga la app" en la web.
- `capacitor.config.json` — `appId com.hectarea.recordingman`, `webDir dist/android`.
- `android/app/src/main/res/values/strings.xml` — `app_link_host` (aún `recordingman.example`) y `admob_app_id` (aún el de pruebas).
- `android/app/src/main/AndroidManifest.xml` — intent-filters: App Links `https://@string/app_link_host` (autoVerify) y esquema `recordingman:`.
- `public/.well-known/assetlinks.json` — huella SHA-256 aún sin rellenar (`REEMPLAZAR_…`).
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
  style.css        todo el CSS (~1200 líneas)
  core/            lógica pura, sin DOM
    level.ts       modelo de datos del nivel, tipos de objeto, límites, sanear()
    sim.ts         simulación determinista por ticks
    codec.ts       nivel ⇄ código binario base64url ⇄ URL
    text.ts        nivel ⇄ lenguaje de texto legible (editor de código)
    scripts.ts     comportamientos programados especiales por nivel
    builtin.ts     niveles incluidos (en texto)
  ui/
    dom.ts         helper h(), iconos SVG, aviso(), modal(), confirmar()
    app.ts         navegación de la app (menú, niveles, favoritos, creador, ajustes)
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
  `pared, paredmala, boton, botontodos, interruptor, meta, texto, suelo, caja, puerta, switch, temporizador, control, pinchos, delay, terremoto, movil`.
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
- Orden de un tick: `objetos()` (botones, interruptores, paredes malas, temporizadores, puertas lógicas, switches, delays, terremotos, paredes, plataformas móviles, pinchos, puntos de control, metas y caídas) → `script.tick` → comprobar completado → empezar con el primer movimiento → mover jugadores → explosiones y fuegos → reiniciar si se pidió.
- Plataformas: desplazamientos redondeados a píxeles enteros y posiciones absolutas desde el original (determinismo). Si una pared movida aplasta a un jugador, muere.
- Muerte y caída: al morir (pared mala, pinchos, aplastado) hay explosión y el jugador **reaparece al instante**; sin suelo debajo encoge (evento `caida`) y reaparece igual. Reaparece en el centro del último punto de control (`controlActual`) o, si no hay, en el inicio. Volver a pisar el rectángulo de inicio lo convierte otra vez en el punto activo.
- Meta: al entrar en una meta un jugador encoge, queda `llego` y salen fuegos pequeños; cuando todos los no `ido` han llegado → `completado` con fuegos grandes alrededor de `ultimaMeta`.
- `temblor(ahora)` da el desplazamiento de cámara de los terremotos activos (según el jugador local si tienen radio).
- `quitar(i)` marca un jugador que se ha ido (multijugador). `sim.datos` es almacenamiento libre para scripts.

### `scripts.ts`

`SCRIPTS: Record<string, Script>` con `tick?(sim)` y `textos?(sim)` (textos dinámicos). Existen `tutorial` y `steinitz`. Un nivel los activa con `nivel.script` (solo niveles incluidos; el codec no lo transporta).

### `codec.ts` — enlaces

- `codificar(nivel)` → base64url de: `VERSION(2)`, flags (`F_REJILLA` coords múltiplo de 5, `F_NEGATIVOS` desplaza 200, `F_LEJANOS` desplaza 10000, `F_FONDO`, `F_INICIO` rectángulo de inicio), nombre, autor, [fondo], inicio, nº objetos, y por objeto `num(tipo)` (índice en `CODIGOS`) + byte de flags (bit 128 `F_INVISIBLE`) + varints. Números con signo en zigzag (`signo`, para las rutas). Referencias como índice de objeto.
- `CODIGOS` es la tabla fija de tipos del formato; conserva `'portal'` en el índice 5 para leer enlaces antiguos (se descarta). **No reordenar.**
- Flags de `movil`: 1 conectada, `modo<<1`, 8 ascensor, 16 empieza apagada, 32 vuelve atrás (seguido de `velAtras`).
- `decodificar(codigo)` lee v1 y v2 (v1: byte `tipo | flags<<4`, velocidades antiguas de pared, `n` de meta ignorado); lanza `Error` con mensaje para el usuario si es inválido o de versión mayor.
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
```

`invisible` se acepta en los bloques lógicos/efectos. `meta … n=` se acepta y se ignora; `portal` es instrucción desconocida. Prefijos de nombre: boton b, botontodos t, interruptor i, puerta g, switch s, temporizador r, delay d. Se usa en el editor (botón "código") y para los niveles incluidos.

### `builtin.ts`

`INCLUIDOS: { script?, texto }[]`, con caché; `NUM_INCLUIDOS`, `nivelIncluido(i)`, `nombreIncluido(i)`. En el estado actual del árbol de trabajo la lista está **vacía** (los niveles antiguos usaban la mecánica de "grabaciones", ya retirada del simulador). `ui/web.ts` usa `nivelIncluido(0)` como nivel por defecto.

## Resto de `src/`

### `render.ts`

- Paleta `C` (fondo `#fafafa`, tinta, rojo `#ee1c25`, verde, `verdeVivo`, azul, caja, `control`, `controlActivo`, `pinchos`, `pinchosHueco`…).
- `dibujarNivel(ctx, sim, op)` (`op.editor` = modo editor) y `dibujarConexiones(ctx, sim, editor)` (líneas activador→receptor; se ven antes de empezar, con Tab o con el botón; en partida se ocultan las de bloques invisibles).
- Inicio: rectángulo gris claro con bandera de cuadros y monigote al lado. Punto de control: gris hasta activarse, luego bandera verde vivo y fondo verde muy claro. Pinchos: panel gris oscuro con huecos; activos en rojo con triángulos girando. Fuegos artificiales con `COLORES_FUEGO`.
- Las plataformas móviles solo se dibujan en el editor, con banda de borde rellena de `BORDE_MOVIL 10` px (lo seleccionable).
- `pinSalida/pinEntrada/centroReceptor` — posiciones de pines de conexión (también las usa el editor).
- `class Vista` — canvas con cámara (`cx, cy, escala`), `ajustar()` a tamaño/DPR, `aMundo()`, `dibujar(sim, op)` con interpolación (`alfa`, `previas`). `completa` = modo editor.
- `simEstatica(nivel)` y `miniatura(nivel, ancho)` para tarjetas.

### `input.ts`

Estado global de teclado (WASD/flechas, Espacio = agarrar, Backspace = reiniciar, Tab = conexiones), ignora eventos en campos de texto. `leerEntrada()` consume el reinicio pendiente. `TACTIL` (pointer coarse) → `montarPalanca(zona)`: joystick virtual en el 60 % izquierdo, 8 direcciones.

### `audio.ts`

Efectos sintetizados por `Evento` (WebAudio; incluye `caida`), se desbloquean con el primer gesto. Música `audio/musica.mp3` en bucle, pausa al ocultar la pestaña. Respetan `ajustes.musica/efectos`.

### `store.ts`

localStorage con prefijo `rm.`: `ajustes {musica, efectos, autor}`, `progreso` (bool[] por nivel incluido), `favoritos` ({codigo, nombre, autor}), `propios` (niveles del creador `{id, nivel, modificado}`), `nuevoId()`.

### `platform.ts`

Abstrae diferencias por `__OBJETIVO__`:
- `copiar`, `compartir` (Capacitor Share / Web Share), `PUEDE_COMPARTIR`.
- `alAbrirUrl` (Capacitor `appUrlOpen` + launch URL / Electron `rmEscritorio`), `alAtras` (botón atrás Android), `salir`, `PUEDE_SALIR`.
- Anuncios: web → AdSense en `#anuncio` y huecos laterales en la pantalla de fin (`huecosAnuncioFin`), consentimiento revocable (`revocarConsentimiento`, Funding Choices). Android → AdMob banner adaptativo inferior + formulario UMP; `anuncio(visible)` lo oculta/muestra y ajusta la variable CSS `--anuncio`. Desktop → sin anuncios.

### `red.ts` — multijugador

- WebRTC DataChannel, señalización por el **servidor público de PeerJS** (`wss://0.peerjs.com`) con cliente propio (`Senal`). Solo acepta `OFFER/ANSWER` con la forma exacta de PeerJS o cierra el socket (ver memoria `multijugador-senalizacion`). STUN de Google; ICE no trickle (espera `ESPERA_ICE`).
- Peer IDs `rm-<sala>`; sala = 10 caracteres aleatorios; enlace `?l=<codigo>&s=<sala>` (`urlDeSala`, `extraerSala`). Máx. 8 jugadores.
- `Anfitrion`: abre sala, acepta ofertas, mantiene la lista, `empezar()` → `Sesion`. Es la autoridad: cada tick difunde el array de códigos de entrada de todos y ejecuta el tick.
- `Invitado`: conecta, manda nombre y cambios de entrada; encola los arrays del anfitrión y ejecuta ticks (con recuperación si se retrasa).
- Entrada codificada en un entero 0–35 (`aCodigo/deCodigo`; +9 reiniciar, +18 agarrar). El anfitrión descarta el bit de reinicio de los invitados: **solo el anfitrión reinicia**. Mensajes JSON: `{n}` nombre, `{e}` entrada, `{j,tu}` lista, `{ini,tu,se}` inicio (con semilla), `[...]` tick, `{f}` baja, `{x}` rechazo.
- `Sesion { jugadores, local, semilla, paso(e, tick, quitar) }` la consume `juego.ts`.

## `ui/` en detalle

- `dom.ts` — `h(tag, props, ...hijos)` (props `class`, `html`, `on*`, propiedades o atributos), `icono(nombre)` / `botonIcono` con SVG inline en `ICONOS`, `aviso()` (toast), `modal()`, `confirmar()`.
- `app.ts` (android/desktop) — una pantalla a la vez con `mostrar(el, volver, conAnuncio, limpiar)`. Pantallas: `menu`, `niveles` (desbloqueo secuencial), `jugarIncluido`, `jugarCompartido` (pasa por lobby), `pantallaFavoritos`, `creador` (lista de propios: editar, compartir, duplicar, borrar, importar), `abrirEditor`, `abrirAjustes`. Esc / botón atrás → `atras`. Deep links → `jugarCompartido`.
- `web.ts` — lee `?l=` (y `s=`), monta el lobby con ese nivel o con `nivelIncluido(0)`; enlaces a privacidad y a la app (intent de Android con fallback a la tienda).
- `lobby.ts` — `montarLobby(raiz, op)`: crea `Anfitrion` (o `Invitado` si hay sala), lista de jugadores, nombre, botón Invitar (solo app, no web) y Empezar; al empezar llama a `montarJuego` con la `Sesion`. Si el invitado cae vuelve a crear sala propia.
- `juego.ts` — `montarJuego(raiz, OpcionesJuego) → destruir`. Bucle `requestAnimationFrame` con paso fijo e interpolación; cámara que sigue al jugador local (suavizado) y se puede arrastrar antes de empezar; botones de barra (conexiones, reiniciar, sonido, música, favorito, compartir, pantalla completa); en multijugador el botón de reiniciar y "Repetir" solo los ve el anfitrión (`local === 0`); botón contextual "Agarrar"; temblor de terremotos aplicado a la cámara; pantalla de fin 1 s después de completar, con tiempo y `accionesFin`. `compartirNivel`, `urlDeCodigo`.
- `editor.ts` — `montarEditor(raiz, nivel, { alCambiar, alSalir }) → { atras, destruir }`. Paleta de herramientas (en táctil incluye "Mapa" para desplazar), rejilla de 25, selección/arrastre/asas de redimensionado (`asas`, `asasInicio` para el rectángulo de inicio), selección múltiple con Ctrl (`grupo`) para mover/duplicar juntos, conexiones arrastrando pines, inspector lateral por tipo (`campoNumero`, `campoSegundos`, `campoOpciones`), pan con clic derecho y rueda; plataformas móviles: se seleccionan por su banda de borde, ruta con asas por punto (`asasRuta`), "+" en mitad de cada tramo para insertar punto, "Añadir punto"/"Quitar último", miembros resaltados en verde; círculo de radio del terremoto al seleccionarlo; deshacer/rehacer (historial JSON de 120, Ctrl+Z/Y), Ctrl+D duplicar, Supr borrar, modal de nombre/autor, modal de código (`text.ts`), compartir (exige una meta), "Probar" (monta `montarJuego` en una capa). Cada cambio confirmado llama a `alCambiar` → `store.guardarPropio`.

## Electron (`electron/`)

- `main.cjs` — instancia única, protocolo `recordingman:`, ventana 1300×760 sin menú, carga `dist/desktop/index.html`, F11 pantalla completa, enlaces externos al navegador, IPC `url-inicial` y `salir`.
- `preload.cjs` — expone `window.rmEscritorio { salir, alAbrirUrl }`.

## Convenciones

- Español en todo (nombres, UI, commits).
- Sin framework ni dependencias de runtime salvo plugins de Capacitor; el multijugador se hizo sin PeerJS a propósito.
- `core/` no toca el DOM.
- Las ramas por plataforma se hacen con `__OBJETIVO__` para que Vite elimine el código muerto; los plugins de Capacitor se importan dinámicamente.
- Toda entrada externa (URL, texto, red) pasa por `sanear` / `limpiarNombre` / validación.

## Estado del trabajo (2026-11-15)

Hay cambios sin commitear amplios sobre el último commit (`5203e75`): nuevos objetos (caja, puerta lógica, switch, botón de todos, suelo con color, fondo del nivel, temporizador, punto de control, inicio rectangular, pinchos, delay, terremoto, plataforma móvil), bloques invisibles, caída sin suelo y reaparición instantánea, meta para todos los jugadores con fuegos artificiales, retirada de los portales, formato de enlace v2, multijugador (`red.ts`, `ui/lobby.ts` nuevos; solo reinicia el anfitrión), retirada de la mecánica de grabaciones y vaciado de los niveles incluidos en `builtin.ts`.

Pendientes conocidos de configuración: `app_link_host` y `admob_app_id` en `strings.xml`, huella en `assetlinks.json`.
