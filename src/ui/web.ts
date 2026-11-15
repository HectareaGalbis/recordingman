import { PAQUETE_ANDROID, URL_ANDROID, URL_COMPARTIR, URL_PC } from '../config';
import { nivelIncluido } from '../core/builtin';
import { PARAMETRO, decodificar, extraerCodigo } from '../core/codec';
import { Nivel } from '../core/level';
import { PUEDE_REVOCAR, revocarConsentimiento } from '../platform';
import { extraerSala } from '../red';
import { aviso, h } from './dom';
import { compartirNivel } from './juego';
import { montarLobby } from './lobby';

function enlaceApp(codigo: string): string {
  const host = URL_COMPARTIR.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const alternativa = URL_ANDROID ? `S.browser_fallback_url=${encodeURIComponent(URL_ANDROID)};` : '';
  return `intent://${host}/?${PARAMETRO}=${codigo}#Intent;scheme=https;package=${PAQUETE_ANDROID};${alternativa}end`;
}

export function iniciarWeb() {
  const raiz = document.getElementById('app')!;
  const codigo = extraerCodigo(location.search + location.hash);
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
    sala: (compartido && extraerSala(location.search + location.hash)) || undefined,
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
