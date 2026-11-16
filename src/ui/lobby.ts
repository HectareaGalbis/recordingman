import { ES_WEB } from '../config';
import { ALTO, ANCHO, Nivel } from '../core/level';
import { PUEDE_COMPARTIR, compartir, copiar } from '../platform';
import { Anfitrion, COLOR_PRIMARIO, COLOR_SECUNDARIO, Colores, Invitado, LARGO_NOMBRE, MAX_JUGADORES, Red, Sesion, urlDeSala } from '../red';
import { C, Vista, miniatura, simEstatica } from '../render';
import { ajustes } from '../store';
import { aHex, abrirColor as ventanaColor } from './color';
import { aviso, botonIcono, h, icono, modal, registrarIconos } from './dom';
import { extension, montarJuego } from './juego';

registrarIconos({ corona: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/>' });

export interface OpcionesLobby {
  nivel: Nivel;
  codigo?: string;
  sala?: string;
  invitado?: Invitado;
  alCaer?: (motivo: string) => void;
  alSalir?: () => void;
  accionesFin?: () => HTMLElement[];
}

let nombre = ajustes.autor;
const colores: Colores = { p: COLOR_PRIMARIO, s: COLOR_SECUNDARIO };

function coloresAleatorios() {
  const hue = Math.random() * 360;
  colores.p = aHex(hue, 0.55 + Math.random() * 0.4, 0.5 + Math.random() * 0.4);
  colores.s = aHex((hue + 150 + Math.random() * 60) % 360, 0.25 + Math.random() * 0.45, 0.85 + Math.random() * 0.15);
}

export function conectarSala(sala: string): Invitado {
  nombre = ajustes.autor;
  coloresAleatorios();
  return new Invitado(sala, nombre, colores);
}

function verNivel(nivel: Nivel, colores: Colores) {
  const canvas = h('canvas', { class: 'lobby-vista' });
  const m = modal(nivel.nombre || 'Nivel sin nombre', canvas, h('p', { class: 'nota' }, 'Arrastra para recorrer el nivel.'));
  m.caja.classList.add('modal-ancho');
  const vista = new Vista(canvas);
  vista.completa = true;
  vista.fondo = nivel.fondo || C.fondo;
  const sim = simEstatica(nivel);
  const ext = extension(nivel);
  const margen = 100;
  const limitar = () => {
    const v = vista.visible();
    const mx = (v.w - ANCHO) / 2;
    const my = (v.h - ALTO) / 2;
    const ajustarEje = (c: number, a: number, b: number, tam: number, m: number) =>
      b - a + 2 * margen <= tam + 2 * m ? (a + b) / 2 - tam / 2 : Math.min(Math.max(c, a - margen + m), b + margen - tam - m);
    vista.cx = ajustarEje(vista.cx, ext.x0, ext.x1, ANCHO, mx);
    vista.cy = ajustarEje(vista.cy, ext.y0, ext.y1, ALTO, my);
  };
  const dibujar = () => {
    limitar();
    vista.dibujar(sim, { colores: [colores] });
  };
  vista.cx = nivel.inicio.x + nivel.inicio.w / 2 - ANCHO / 2;
  vista.cy = nivel.inicio.y + nivel.inicio.h / 2 - ALTO / 2;

  let previo: { x: number; y: number; id: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    previo = { x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!previo || previo.id !== e.pointerId) return;
    vista.cx -= (e.clientX - previo.x) / vista.escala;
    vista.cy -= (e.clientY - previo.y) / vista.escala;
    previo = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dibujar();
  });
  const soltar = (e: PointerEvent) => {
    if (previo?.id === e.pointerId) previo = null;
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  const observador = new ResizeObserver(() => dibujar());
  observador.observe(canvas);
  const vigia = new MutationObserver(() => {
    if (m.caja.isConnected) return;
    vigia.disconnect();
    observador.disconnect();
    vista.destruir();
  });
  vigia.observe(document.body, { childList: true });
}

export function montarLobby(raiz: HTMLElement, op: OpcionesLobby): () => void {
  let red: Red | null = null;
  let limpiar: (() => void) | null = null;
  const titulo = op.nivel.nombre || 'Nivel sin nombre';
  if (!op.invitado) {
    nombre = ajustes.autor;
    coloresAleatorios();
  }

  const cerrar = () => {
    limpiar?.();
    limpiar = null;
    red?.cerrar();
    red = null;
  };

  const salir = op.alSalir && (() => {
    cerrar();
    op.alSalir!();
  });

  const jugar = (sesion: Sesion) => {
    limpiar?.();
    limpiar = montarJuego(raiz, { nivel: op.nivel, codigo: op.codigo, alSalir: salir, accionesFin: op.accionesFin, sesion });
  };

  const sala = (unirse?: string, error = '', previo?: Invitado) => {
    cerrar();
    const actual: Red = previo ?? (unirse || __OBJETIVO__ === 'web' ? new Invitado(unirse ?? '', nombre, colores) : new Anfitrion(nombre, op.codigo, colores));
    red = actual;

    const lista = h('ul', { class: 'lobby-jugadores' });
    const cuenta = h('span', {});
    const estado = h('p', { class: 'nota' });
    const campo = h('input', { type: 'text', maxLength: LARGO_NOMBRE, value: nombre, placeholder: 'Jugador', autocomplete: 'off', spellcheck: false });
    const enlace = h('input', { type: 'text', readOnly: true, onfocus: () => enlace.select() });
    const campoEnlace = h('label', { class: 'campo', hidden: true }, 'Enlace de la sala', enlace);
    const codigoSala = h('strong', {});
    const cajaQR = h('div', { class: 'lobby-qr', hidden: true });
    let urlQR = '';
    const bCompartir = PUEDE_COMPARTIR ? h('button', { class: 'btn', onclick: () => void compartir(enlace.value, titulo) }, icono('compartir'), 'Compartir') : null;
    const cajaCodigo = h('div', { class: 'lobby-codigo', hidden: true }, h('span', {}, 'Código de sala'), codigoSala, cajaQR, bCompartir);
    const bInvitar = h('button', { class: 'btn', onclick: () => void invitar() }, icono('enlace'), 'Invitar');
    const bEmpezar = h('button', { class: 'btn primario', onclick: () => empezar() }, icono('jugar'), 'Empezar');

    const miMono = h('span', { class: 'lobby-yo-mono' });
    const miCorona = h('span', { class: 'corona', title: 'Anfitrión', hidden: true }, icono('corona'));
    campo.className = 'lobby-nombre';
    campo.setAttribute('aria-label', 'Tu nombre');

    campo.addEventListener('input', () => {
      nombre = campo.value;
      actual.nombrar(nombre);
    });
    const abrirColor = (clave: keyof Colores, titulo: string) => {
      const muestra = h('span', { class: 'lobby-yo-mono lobby-modal-mono' });
      const pintarMuestra = () => {
        muestra.style.background = colores.p;
        muestra.style.borderColor = colores.s;
      };
      pintarMuestra();
      ventanaColor(muestra, titulo, colores[clave], (hex) => {
        colores[clave] = hex;
        actual.colorear(colores);
        pintarMuestra();
        pintar();
      });
    };
    const bColorP = h('button', { class: 'lobby-bcolor', title: 'Color principal', 'aria-label': 'Color principal', onclick: () => abrirColor('p', 'Color principal') });
    const bColorS = h('button', { class: 'lobby-bcolor', title: 'Color secundario', 'aria-label': 'Color secundario', onclick: () => abrirColor('s', 'Color secundario') });


    const pintar = () => {
      const jugadores = actual.lista;
      miMono.style.background = colores.p;
      miMono.style.borderColor = colores.s;
      bColorP.style.background = colores.p;
      bColorS.style.background = colores.s;
      miCorona.hidden = !actual.anfitrion;
      const otros = jugadores.map((j, i) => ({ j, i })).filter(({ j }) => j.id !== actual.yo);
      lista.replaceChildren(
        ...(otros.length
          ? otros.map(({ j, i }) =>
              h('li', {},
                h('span', { class: 'lobby-mono', style: `background:${j.p};border-color:${j.s}` }),
                h('span', { class: 'nom' }, j.nombre || `Jugador ${i + 1}`),
                i === 0 && h('span', { class: 'corona', title: 'Anfitrión', 'aria-label': 'Anfitrión' }, icono('corona')),
              ),
            )
          : [h('li', { class: 'vacia' }, 'Aún no hay nadie más en la sala.')]),
      );
      cuenta.textContent = jugadores.length ? `${jugadores.length}/${MAX_JUGADORES}` : '';
      const abierta = actual.anfitrion ? actual.codigoSala : null;
      const puedeInvitar = actual.anfitrion && !ES_WEB && !!op.codigo;
      bInvitar.hidden = !puedeInvitar;
      bEmpezar.hidden = !actual.anfitrion;
      campoEnlace.hidden = !abierta;
      cajaCodigo.hidden = !abierta;
      if (abierta) {
        enlace.value = urlDeSala(abierta);
        codigoSala.textContent = abierta.toUpperCase().replace(/(.{5})(?=.)/g, '$1 ');
        if (__OBJETIVO__ !== 'web' && urlQR !== enlace.value) {
          const url = (urlQR = enlace.value);
          void import('../qr').then(({ svgQR }) => {
            if (urlQR !== url) return;
            try {
              cajaQR.innerHTML = svgQR(url);
            } catch (e) {
              cajaQR.textContent = `No se puede generar el código QR: ${(e as Error).message}.`;
            }
            cajaQR.hidden = false;
          });
        }
      }
      if (!actual.anfitrion) {
        estado.textContent = actual.conectado
          ? 'Esperando a que el anfitrión empiece la partida.'
          : actual.esperando
            ? 'Esperando al anfitrión… Si ha salido de la app para compartir el enlace, entrarás en cuanto vuelva.'
            : 'Conectando con la sala…';
      } else if (abierta && !actual.sala) estado.textContent = 'Reconectando la sala…';
      else if (abierta) estado.textContent = 'Sala abierta. Escanea el código QR o pasa el enlace a quien quieras que se una.';
      else estado.textContent = puedeInvitar ? 'Invita a otros jugadores o empieza tú solo.' : '';
    };

    const invitar = async () => {
      if (__OBJETIVO__ === 'web' || !actual.anfitrion || !op.codigo) return;
      bInvitar.disabled = true;
      try {
        await actual.abrir();
        if (red !== actual) return;
        pintar();
      } catch (e) {
        aviso((e as Error).message);
      } finally {
        bInvitar.disabled = false;
      }
    };

    const empezar = () => {
      if (actual.anfitrion) jugar(actual.empezar());
    };

    actual.alCambiar = pintar;
    if (!actual.anfitrion) {
      actual.alEmpezar = jugar;
      actual.alCaer = (motivo) => {
        if (op.alCaer) {
          cerrar();
          return op.alCaer(motivo);
        }
        aviso(motivo);
        sala(undefined, motivo);
      };
    }

    const el = h('div', { class: 'pantalla lobby' },
      h('header', { class: 'barra' },
        salir && botonIcono('atras', 'Volver (Esc)', salir),
        h('div', { class: 'titulo' }, h('strong', {}, 'Sala de juego'), h('span', {}, titulo)),
      ),
      h('div', { class: 'cuerpo' },
        h('div', { class: 'lobby-cuerpo' },
          h('section', { class: 'lobby-yo' },
            miCorona,
            h('div', { class: 'lobby-yo-fila' },
              h('div', { class: 'lobby-yo-figura' }, miMono),
              h('div', { class: 'lobby-bcolores' }, bColorP, bColorS),
            ),
            campo,
          ),
          h('section', { class: 'lobby-sala' },
            h('button', { class: 'lobby-nivel', title: 'Ver el nivel', onclick: () => verNivel(op.nivel, colores) },
              miniatura(op.nivel, 160),
              h('div', { class: 'titulo' }, h('strong', {}, titulo), h('span', {}, op.nivel.autor ? `por ${op.nivel.autor}` : 'Anónimo'), h('span', { class: 'ver' }, 'Ver el nivel completo')),
            ),
            h('h2', {}, 'Jugadores ', cuenta),
            lista,
            cajaCodigo,
            campoEnlace,
          ),
          h('div', { class: 'lobby-pie' },
            h('p', { class: 'error' }, error),
            estado,
            h('div', { class: 'fila fin' }, bInvitar, bEmpezar),
          ),
        ),
      ),
    );
    raiz.appendChild(el);
    limpiar = () => el.remove();
    pintar();
  };

  sala(op.sala, '', op.invitado);
  return cerrar;
}
