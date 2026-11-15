import { permitirMusica } from '../audio';
import { PAQUETE_ANDROID, URL_ANDROID, URL_COMPARTIR, URL_PC } from '../config';
import { PARAMETRO, decodificar, extraerCodigo } from '../core/codec';
import { Nivel } from '../core/level';
import { PUEDE_REVOCAR, huecoAnuncioMovil, huecosAnuncioPortada, revocarConsentimiento } from '../platform';
import { Invitado, PARAMETRO_ENVIO, PARAMETRO_SALA, Receptor, extraerEnvio, extraerSala } from '../red';
import { h } from './dom';
import { fondoCayendo } from './fondo';
import { montarJuego } from './juego';
import { conectarSala, montarLobby } from './lobby';

function enlaceApp(codigo: string): string {
  const host = URL_COMPARTIR.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const alternativa = URL_ANDROID ? `S.browser_fallback_url=${encodeURIComponent(URL_ANDROID)};` : '';
  return `intent://${host}/?${PARAMETRO}=${codigo}#Intent;scheme=https;package=${PAQUETE_ANDROID};${alternativa}end`;
}

function pieLegal(): HTMLElement | '' {
  if (document.querySelector('.legal')) return '';
  return h('nav', { class: 'legal', 'aria-label': 'Privacidad' },
    h('a', { href: './privacidad.html', target: '_blank', rel: 'noopener' }, 'Privacidad'),
    PUEDE_REVOCAR && h('button', { type: 'button', onclick: revocarConsentimiento }, 'Cookies'),
  );
}

function destinoDe(entrada: string): string | null {
  const t = entrada.trim();
  if (/[?&#]/.test(t)) {
    const sala = extraerSala(t);
    if (sala) return `?${PARAMETRO_SALA}=${sala}`;
    const envio = extraerEnvio(t);
    if (envio) return `?${PARAMETRO_ENVIO}=${envio}`;
    const codigo = /[?&#]l=/.test(t) ? extraerCodigo(t) : null;
    return codigo ? `?${PARAMETRO}=${codigo}` : null;
  }
  const sala = t.toLowerCase().replace(/\s+/g, '');
  if (/^[a-z0-9]{6,20}$/.test(sala)) return `?${PARAMETRO_SALA}=${sala}`;
  try {
    decodificar(t);
    return `?${PARAMETRO}=${t}`;
  } catch {
    return null;
  }
}

function portada(raiz: HTMLElement, error = '') {
  permitirMusica(false);
  if (location.search || location.hash) history.replaceState(null, '', location.pathname);
  const campo = h('input', {
    type: 'text',
    class: 'portada-codigo',
    placeholder: 'Código de sala o de nivel',
    'aria-label': 'Código de sala o de nivel',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: false,
    enterkeyhint: 'go',
  });
  const mensaje = h('p', { class: 'error' }, error);
  const unirse = () => {
    const destino = destinoDe(campo.value);
    if (!destino) {
      mensaje.textContent = campo.value.trim() ? 'Ese código no es válido' : 'Escribe o pega el código de la sala o del nivel';
      campo.focus();
      return;
    }
    location.assign(location.pathname + destino);
  };
  campo.addEventListener('keydown', (e) => e.key === 'Enter' && unirse());
  const laterales = matchMedia('(min-width: 1000px)').matches ? huecosAnuncioPortada() : null;
  const movil = laterales ? null : huecoAnuncioMovil();
  const fondo = fondoCayendo();
  campo.addEventListener('input', () => (mensaje.textContent = ''));
  const pegar = navigator.clipboard?.readText
    ? h('button', {
      class: 'btn',
      onclick: () =>
        void navigator.clipboard.readText().then(
          (t) => {
            campo.value = t.trim();
            mensaje.textContent = '';
            campo.focus();
          },
          () => (mensaje.textContent = 'No se pudo leer el portapapeles'),
        ),
    }, 'Pegar')
    : null;
  raiz.replaceChildren(
    h('div', { class: laterales ? 'pantalla portada con-laterales' : 'pantalla portada' },
      fondo.el,
      laterales?.izq,
      h('div', { class: 'portada-centro' },
        h('h1', { class: 'logo-partidica', 'aria-label': '¿Una partidica?' },
          h('span', { class: 'chico' }, 'una'), 'partidica', h('span', { class: 'chico' }, '?'),
        ),
        h('p', { class: 'portada-texto' }, 'Puzles para jugar en equipo desde el navegador. Pulsad botones, empujad cajas, abrid puertas y llegad todos a la meta.'),
        h('div', { class: 'portada-caja' },
          h('div', { class: 'portada-fila' }, campo, pegar),
          h('button', { class: 'btn-menu', onclick: unirse }, 'Unirse'),
          mensaje,
        ),
        movil?.el,
      ),
      laterales?.der,
    ),
  );
  raiz.after(pieLegal());
  laterales?.rellenar();
  movil?.rellenar();
}

export function iniciarWeb() {
  const raiz = document.getElementById('app')!;
  const codigo = extraerCodigo(location.search + location.hash);
  const envio = codigo ? null : extraerEnvio(location.search + location.hash);
  const sala = codigo || envio ? null : extraerSala(location.search + location.hash);
  if (sala) {
    const invitado = conectarSala(sala);
    const texto = h('p', { class: 'vacio' }, 'Conectando con la sala…');
    const espera = h('div', { class: 'pantalla' }, h('div', { class: 'cuerpo' }, texto));
    raiz.appendChild(espera);
    invitado.alCambiar = () => {
      if (invitado.esperando) texto.textContent = 'Esperando al anfitrión… Si ha salido de la app para compartir el enlace, entrarás en cuanto vuelva.';
    };
    invitado.alNivel = (c) => {
      invitado.alNivel = () => undefined;
      espera.remove();
      montarWeb(raiz, c, invitado);
    };
    invitado.alCaer = (motivo) => {
      espera.remove();
      portada(raiz, motivo);
    };
    return;
  }
  if (!envio) return codigo ? montarWeb(raiz, codigo) : portada(raiz);
  const receptor = new Receptor(envio);
  const aviso = h('p', { class: 'vacio' }, 'Recibiendo nivel…');
  const espera = h('div', { class: 'pantalla' }, h('div', { class: 'cuerpo' }, aviso));
  raiz.appendChild(espera);
  receptor.alCambiar = () => {
    if (receptor.esperando) aviso.textContent = 'Esperando a quien compartió el nivel… Si ha salido de la app para enviarte el enlace, el nivel llegará en cuanto vuelva.';
  };
  receptor.nivel.then(
    (c) => {
      espera.remove();
      montarWeb(raiz, c);
    },
    (e: Error) => {
      espera.remove();
      portada(raiz, e.message);
    },
  );
}

function montarWeb(raiz: HTMLElement, codigo: string, invitado?: Invitado) {
  let nivel: Nivel;
  try {
    nivel = decodificar(codigo);
  } catch (e) {
    return portada(raiz, (e as Error).message);
  }
  const compartido = codigo;
  permitirMusica(true);
  if (nivel?.nombre) document.title = `${nivel.nombre} · RecordingMan`;
  const android = /Android/i.test(navigator.userAgent);

  raiz.after(pieLegal());

  const accionesFin = () => {
    const b: HTMLElement[] = [];
    if (android && compartido) b.push(h('a', { class: 'btn', href: enlaceApp(compartido) }, 'Abrir en la app'));
    else if (android && URL_ANDROID) b.push(h('a', { class: 'btn', href: URL_ANDROID }, 'Crea tus niveles con la app'));
    else if (!android && URL_PC) b.push(h('a', { class: 'btn', href: URL_PC }, 'Crea tus niveles en PC'));
    return b;
  };
  const sala = invitado ? undefined : extraerSala(location.search + location.hash) ?? undefined;
  if (!invitado && !sala) {
    montarJuego(raiz, { nivel, codigo: compartido, accionesFin });
    return;
  }
  montarLobby(raiz, { nivel, codigo: compartido, sala, invitado, accionesFin, alCaer: (motivo) => portada(raiz, motivo) });
}
