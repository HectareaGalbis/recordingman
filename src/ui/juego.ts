import { actualizarMusica, sonar } from '../audio';
import { ES_WEB, URL_COMPARTIR } from '../config';
import { PARAMETRO } from '../core/codec';
import { Nivel } from '../core/level';
import { Mono, Sim, TICKS_POR_SEGUNDO } from '../core/sim';
import { TACTIL, leerEntrada, limpiarEntrada, montarPalanca, pedirGrabar, pedirReiniciar, tecla } from '../input';
import { PUEDE_COMPARTIR, compartir, copiar } from '../platform';
import { Vista } from '../render';
import { ajustes, alternarFavorito, esFavorito, guardarAjustes } from '../store';
import { aviso, botonIcono, h } from './dom';

export interface OpcionesJuego {
  nivel: Nivel;
  codigo?: string;
  etiqueta?: string;
  alSalir?: () => void;
  alCompletar?: () => void;
  accionesFin?: () => HTMLElement[];
}

export function urlDeCodigo(codigo: string): string {
  return `${URL_COMPARTIR.replace(/\/+$/, '')}/?${PARAMETRO}=${codigo}`;
}

export async function compartirNivel(codigo: string, nombre: string) {
  const url = urlDeCodigo(codigo);
  if (PUEDE_COMPARTIR && (await compartir(url, nombre || 'Nivel de RecordingMan'))) return;
  aviso((await copiar(url)) ? 'Enlace copiado al portapapeles' : 'No se pudo copiar el enlace');
}

export function montarJuego(raiz: HTMLElement, op: OpcionesJuego): () => void {
  const sim = new Sim(op.nivel);
  const canvas = h('canvas', { class: 'lienzo' });
  const pista = h('div', { class: 'pista' });
  const contador = h('span', { class: 'grab-n' });
  const fin = h('div', { class: 'fin-nivel sin-palanca', hidden: true });
  let conexiones = false;

  const alternar = (b: HTMLButtonElement, clave: 'musica' | 'efectos') => {
    ajustes[clave] = !ajustes[clave];
    guardarAjustes();
    b.classList.toggle('apagado', !ajustes[clave]);
    actualizarMusica();
  };
  const bConex = botonIcono('conexiones', 'Mostrar conexiones (Tab)', () => {
    conexiones = !conexiones;
    bConex.classList.toggle('activo', conexiones);
  });
  const bSonido = botonIcono('sonido', 'Efectos de sonido', () => alternar(bSonido, 'efectos'), ajustes.efectos ? '' : 'apagado');
  const bMusica = botonIcono('musica', 'Música', () => alternar(bMusica, 'musica'), ajustes.musica ? '' : 'apagado');

  const acciones: HTMLElement[] = [bConex, botonIcono('reiniciar', 'Reiniciar nivel (Borrar)', () => pedirReiniciar()), bSonido, bMusica];
  if (op.codigo && !ES_WEB) {
    const codigo = op.codigo;
    const bFav = botonIcono('estrella', 'Guardar en favoritos', () => {
      const guardado = alternarFavorito({ codigo, nombre: op.nivel.nombre, autor: op.nivel.autor });
      bFav.classList.toggle('lleno', guardado);
      aviso(guardado ? 'Guardado en favoritos' : 'Quitado de favoritos');
    }, esFavorito(codigo) ? 'lleno' : '');
    acciones.push(bFav);
  }
  if (op.codigo) {
    const codigo = op.codigo;
    acciones.push(botonIcono('compartir', 'Compartir nivel', () => void compartirNivel(codigo, op.nivel.nombre)));
  }
  if (ES_WEB && document.documentElement.requestFullscreen) {
    acciones.push(
      botonIcono('pantalla', 'Pantalla completa', () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else
          void document.documentElement
            .requestFullscreen()
            .then(() => (screen.orientation as any)?.lock?.('landscape'))
            .catch(() => undefined);
      }),
    );
  }

  const escenario = h('div', { class: 'escenario' }, canvas, pista, fin);
  if (TACTIL) {
    escenario.append(
      h('div', { class: 'tactil sin-palanca' },
        h('button', { class: 'rec', 'aria-label': 'Grabar', onpointerdown: (e: Event) => { e.preventDefault(); pedirGrabar(); } }, 'REC'),
      ),
    );
  }

  const el = h('div', { class: 'juego' },
    h('header', { class: 'barra' },
      op.alSalir && botonIcono('atras', 'Volver (Esc)', () => op.alSalir!()),
      h('div', { class: 'titulo' },
        h('strong', {}, op.nivel.nombre || 'Nivel sin nombre'),
        h('span', {}, op.etiqueta ?? (op.nivel.autor ? `por ${op.nivel.autor}` : '')),
      ),
      h('div', { class: 'grab', title: 'Grabaciones restantes' }, h('i', {}), contador),
      h('div', { class: 'acciones' }, ...acciones),
    ),
    escenario,
  );
  raiz.appendChild(el);

  const vista = new Vista(canvas);
  const quitarPalanca = TACTIL ? montarPalanca(escenario) : null;
  limpiarEntrada();

  const previas = new Map<Mono, { x: number; y: number }>();
  const paso = 1000 / TICKS_POR_SEGUNDO;
  let acumulado = 0;
  let ultimo = performance.now();
  let vivo = true;
  let finMostrado = false;
  let pistaActual = '';

  const mostrarFin = () => {
    finMostrado = true;
    const seg = (sim.ticks / TICKS_POR_SEGUNDO).toFixed(1);
    fin.replaceChildren(
      h('div', { class: 'fin-caja' },
        h('h2', {}, 'Nivel superado'),
        h('p', {}, `${sim.grabacionesUsadas} ${sim.grabacionesUsadas === 1 ? 'grabación' : 'grabaciones'} · ${seg} s`),
        h('div', { class: 'fila centro' },
          h('button', { class: 'btn', onclick: repetir }, 'Repetir'),
          ...(op.accionesFin?.() ?? []),
        ),
      ),
    );
    fin.hidden = false;
    op.alCompletar?.();
  };

  const repetir = () => {
    fin.hidden = true;
    finMostrado = false;
    sim.reiniciar();
    limpiarEntrada();
  };

  const ponerPista = () => {
    let t = '';
    if (!sim.completado) {
      if (!sim.empezado) t = TACTIL ? 'Arrastra para moverte · REC para llamar a una grabación' : 'Muévete con WASD o las flechas · R para grabarte';
      else if (sim.jugador.muerto) t = TACTIL ? 'REC: nueva grabación · ↺: reiniciar' : 'R: nueva grabación · Borrar: reiniciar';
    }
    if (t !== pistaActual) {
      pistaActual = t;
      pista.textContent = t;
      pista.classList.toggle('visible', !!t);
    }
  };

  const cuadro = (ahora: number) => {
    if (!vivo) return;
    acumulado = Math.min(acumulado + (ahora - ultimo), paso * 5);
    ultimo = ahora;
    while (acumulado >= paso) {
      acumulado -= paso;
      previas.clear();
      for (const m of sim.monos()) previas.set(m, { x: m.x, y: m.y });
      const e = leerEntrada();
      if (sim.completado) sim.tick({ dx: 0, dy: 0, grabar: false, reiniciar: false });
      else sim.tick(e);
      for (const ev of sim.eventos) {
        sonar(ev);
        if (ev === 'sin_grabaciones') aviso('No te quedan grabaciones');
        if (ev === 'completado') setTimeout(() => vivo && sim.completado && !finMostrado && mostrarFin(), 700);
      }
    }
    contador.textContent = sim.restantes < 0 ? '∞' : String(sim.restantes);
    ponerPista();
    vista.dibujar(sim, {
      conexiones: conexiones || tecla('Tab') || !sim.empezado,
      alfa: acumulado / paso,
      previas,
      tiempo: ahora,
    });
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);

  const teclado = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && op.alSalir) op.alSalir();
    if (e.key === 'Enter' && finMostrado) ((fin.querySelector('.btn.primario') ?? fin.querySelector('.btn')) as HTMLElement | null)?.click();
  };
  window.addEventListener('keydown', teclado);

  return () => {
    vivo = false;
    window.removeEventListener('keydown', teclado);
    quitarPalanca?.();
    vista.destruir();
    el.remove();
  };
}
