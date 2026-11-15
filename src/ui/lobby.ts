import { ES_WEB } from '../config';
import { Nivel } from '../core/level';
import { PUEDE_COMPARTIR, compartir, copiar } from '../platform';
import { Anfitrion, COLOR_PRIMARIO, COLOR_SECUNDARIO, Colores, Invitado, LARGO_NOMBRE, MAX_JUGADORES, Red, Sesion, urlDeSala } from '../red';
import { miniatura } from '../render';
import { ajustes } from '../store';
import { aviso, botonIcono, h, icono } from './dom';
import { montarJuego } from './juego';

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

export function conectarSala(sala: string): Invitado {
  return new Invitado(sala, nombre, colores);
}

export function montarLobby(raiz: HTMLElement, op: OpcionesLobby): () => void {
  let red: Red | null = null;
  let limpiar: (() => void) | null = null;
  const titulo = op.nivel.nombre || 'Nivel sin nombre';

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
    const cajaCodigo = h('div', { class: 'lobby-codigo', hidden: true }, h('span', {}, 'Código de sala'), codigoSala, cajaQR);
    const bInvitar = h('button', { class: 'btn', onclick: () => void invitar() }, icono('enlace'), 'Invitar');
    const bEmpezar = h('button', { class: 'btn primario', onclick: () => empezar() }, icono('jugar'), 'Empezar');

    campo.addEventListener('input', () => {
      nombre = campo.value;
      actual.nombrar(nombre);
    });
    const selector = (clave: keyof Colores, titulo: string) => {
      const entrada = h('input', { type: 'color', value: colores[clave], title: titulo, 'aria-label': titulo });
      entrada.addEventListener('input', () => {
        colores[clave] = entrada.value;
        actual.colorear(colores);
        pintar();
      });
      return h('label', { class: 'lobby-color' }, entrada, titulo);
    };

    const pintar = () => {
      const jugadores = actual.lista;
      lista.replaceChildren(
        ...jugadores.map((j, i) =>
          h('li', {},
            h('span', { class: 'lobby-mono', style: `background:${j.p};border-color:${j.s}` }),
            h('span', { class: 'nom' }, j.nombre || `Jugador ${i + 1}`),
            i === 0 && h('span', { class: 'etq' }, 'Anfitrión'),
            j.id === actual.yo && h('span', { class: 'etq' }, 'Tú'),
          ),
        ),
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
            cajaQR.innerHTML = svgQR(url);
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
        const url = urlDeSala(await actual.abrir());
        if (red !== actual) return;
        pintar();
        if (PUEDE_COMPARTIR && (await compartir(url, titulo))) return;
        aviso((await copiar(url)) ? 'Enlace de la sala copiado al portapapeles' : 'No se pudo copiar el enlace');
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
          h('section', { class: 'lobby-nivel' },
            miniatura(op.nivel, 360),
            h('div', { class: 'titulo' }, h('strong', {}, titulo), h('span', {}, op.nivel.autor ? `por ${op.nivel.autor}` : 'Anónimo')),
          ),
          h('section', { class: 'lobby-sala' },
            h('h2', {}, 'Jugadores ', cuenta),
            lista,
            h('label', { class: 'campo' }, 'Tu nombre', campo),
            h('div', { class: 'campo' }, 'Tu monigote',
              h('div', { class: 'fila' }, selector('p', 'Color principal'), selector('s', 'Color secundario')),
            ),
            cajaCodigo,
            campoEnlace,
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
