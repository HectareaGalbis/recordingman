import { PAQUETE_ANDROID, URL_ANDROID, URL_COMPARTIR, URL_PC } from '../config';
import { nivelIncluido } from '../core/builtin';
import { PARAMETRO, decodificar, extraerCodigo } from '../core/codec';
import { Nivel } from '../core/level';
import { PUEDE_REVOCAR, revocarConsentimiento } from '../platform';
import { Invitado, Receptor, extraerEnvio, extraerSala } from '../red';
import { aviso, h } from './dom';
import { compartirNivel } from './juego';
import { conectarSala, montarLobby } from './lobby';

function enlaceApp(codigo: string): string {
  const host = URL_COMPARTIR.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const alternativa = URL_ANDROID ? `S.browser_fallback_url=${encodeURIComponent(URL_ANDROID)};` : '';
  return `intent://${host}/?${PARAMETRO}=${codigo}#Intent;scheme=https;package=${PAQUETE_ANDROID};${alternativa}end`;
}

export function iniciarWeb() {
  const raiz = document.getElementById('app')!;
  const codigo = extraerCodigo(location.search + location.hash);
  const envio = codigo ? null : extraerEnvio(location.search + location.hash);
  const sala = codigo || envio ? null : extraerSala(location.search + location.hash);
  if (sala) {
    const invitado = conectarSala(sala);
    const espera = h('div', { class: 'pantalla' }, h('div', { class: 'cuerpo' }, h('p', { class: 'vacio' }, 'Conectando con la sala…')));
    raiz.appendChild(espera);
    invitado.alNivel = (c) => {
      invitado.alNivel = () => undefined;
      espera.remove();
      montarWeb(raiz, c, invitado);
    };
    invitado.alCaer = (motivo) => {
      espera.remove();
      aviso(`${motivo}. Te dejamos el tutorial.`);
      montarWeb(raiz, null);
    };
    return;
  }
  if (!envio) return montarWeb(raiz, codigo);
  const receptor = new Receptor(envio);
  const espera = h('div', { class: 'pantalla' }, h('div', { class: 'cuerpo' }, h('p', { class: 'vacio' }, 'Recibiendo nivel…')));
  raiz.appendChild(espera);
  receptor.nivel.then(
    (c) => {
      espera.remove();
      montarWeb(raiz, c);
    },
    (e: Error) => {
      espera.remove();
      aviso(`${e.message}. Te dejamos el tutorial.`);
      montarWeb(raiz, null);
    },
  );
}

function montarWeb(raiz: HTMLElement, codigo: string | null, invitado?: Invitado) {
  let nivel: Nivel | null = null;
  if (codigo) {
    try {
      nivel = decodificar(codigo);
    } catch (e) {
      aviso(`${(e as Error).message}. Te dejamos el tutorial.`);
    }
  }
  const compartido = nivel && codigo ? codigo : undefined;
  if (nivel?.nombre) document.title = `${nivel.nombre} · RecordingMan`;
  const android = /Android/i.test(navigator.userAgent);

  raiz.after(
    h('nav', { class: 'legal', 'aria-label': 'Privacidad' },
      h('a', { href: './privacidad.html', target: '_blank', rel: 'noopener' }, 'Privacidad'),
      PUEDE_REVOCAR && h('button', { type: 'button', onclick: revocarConsentimiento }, 'Cookies'),
    ),
  );

  montarLobby(raiz, {
    nivel: nivel ?? nivelIncluido(0),
    codigo: compartido,
    sala: (!invitado && compartido && extraerSala(location.search + location.hash)) || undefined,
    invitado,
    accionesFin: () => {
      const b: HTMLElement[] = [];
      if (compartido) b.push(h('button', { class: 'btn primario', onclick: () => void compartirNivel(compartido, nivel!.nombre) }, 'Compartir'));
      if (android && compartido) b.push(h('a', { class: 'btn', href: enlaceApp(compartido) }, 'Abrir en la app'));
      else if (android && URL_ANDROID) b.push(h('a', { class: 'btn', href: URL_ANDROID }, 'Crea tus niveles con la app'));
      else if (!android && URL_PC) b.push(h('a', { class: 'btn', href: URL_PC }, 'Crea tus niveles en PC'));
      return b;
    },
  });
}
