import { ADMOB_BANNER, ADMOB_PRUEBAS, ADSENSE_CLIENTE, ADSENSE_FIN_DER, ADSENSE_FIN_IZQ, ADSENSE_PORTADA_DER, ADSENSE_PORTADA_IZQ, ADSENSE_PORTADA_MOVIL } from './config';

interface Escritorio {
  salir(): void;
  alAbrirUrl(cb: (url: string) => void): void;
}

const escritorio = (window as any).rmEscritorio as Escritorio | undefined;

export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = texto;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    t.remove();
    return ok;
  }
}

export const PUEDE_COMPARTIR = __OBJETIVO__ === 'android' || typeof navigator.share === 'function';

export async function compartir(url: string, titulo: string): Promise<boolean> {
  const datos = { title: titulo, text: `Juega a «${titulo}» en RecordingMan`, url };
  try {
    if (__OBJETIVO__ === 'android') {
      const { Share } = await import('@capacitor/share');
      await Share.share({ ...datos, dialogTitle: 'Compartir nivel' });
      return true;
    }
    if (navigator.share) {
      await navigator.share(datos);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function alAbrirUrl(cb: (url: string) => void) {
  if (__OBJETIVO__ === 'android') {
    void import('@capacitor/app').then(async ({ App }) => {
      await App.addListener('appUrlOpen', (e) => cb(e.url));
      const inicial = await App.getLaunchUrl();
      if (inicial?.url) cb(inicial.url);
    });
  } else escritorio?.alAbrirUrl(cb);
}

export function alAtras(cb: () => void) {
  if (__OBJETIVO__ !== 'android') return;
  void import('@capacitor/app').then(({ App }) => App.addListener('backButton', cb));
}

export const PUEDE_SALIR = __OBJETIVO__ === 'android' || !!escritorio;

export function salir() {
  if (__OBJETIVO__ === 'android') void import('@capacitor/app').then(({ App }) => App.exitApp());
  else if (escritorio) escritorio.salir();
}

let bannerNativo: 'no' | 'visible' | 'oculto' = 'no';
let deseado = false;

function alto(px: number) {
  document.documentElement.style.setProperty('--anuncio', `${px}px`);
}

let scriptAdsense = false;

function cargarScriptAdsense() {
  if (scriptAdsense) return;
  scriptAdsense = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENTE)}`;
  document.head.appendChild(s);
}

export const PUEDE_REVOCAR = __OBJETIVO__ === 'web' && !!ADSENSE_CLIENTE;

export function revocarConsentimiento() {
  if (!PUEDE_REVOCAR) return;
  cargarScriptAdsense();
  const w = window as any;
  w.googlefc = w.googlefc || {};
  w.googlefc.callbackQueue = w.googlefc.callbackQueue || [];
  w.googlefc.callbackQueue.push(() => w.googlefc.showRevocationMessage());
}

function bloqueAdsense(hueco: HTMLElement, bloque: string) {
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.cssText = 'display:block;width:100%;height:100%';
  ins.dataset.adClient = ADSENSE_CLIENTE;
  ins.dataset.adSlot = bloque;
  hueco.appendChild(ins);
  cargarScriptAdsense();
  ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
}

function huecosLaterales(bloqueIzq: string, bloqueDer: string, clase: string): { izq: HTMLElement | null; der: HTMLElement | null; rellenar: () => void } {
  const crear = (bloque: string) =>
    __OBJETIVO__ === 'web' && ADSENSE_CLIENTE && bloque ? Object.assign(document.createElement('div'), { className: clase }) : null;
  const izq = crear(bloqueIzq);
  const der = crear(bloqueDer);
  return {
    izq,
    der,
    rellenar: () => {
      if (izq) bloqueAdsense(izq, bloqueIzq);
      if (der) bloqueAdsense(der, bloqueDer);
    },
  };
}

export function huecosAnuncioFin(): { izq: HTMLElement | null; der: HTMLElement | null; rellenar: () => void } {
  const movil = !matchMedia('(min-width: 760px)').matches;
  return huecosLaterales(ADSENSE_FIN_IZQ, movil ? '' : ADSENSE_FIN_DER, 'anuncio-fin');
}

export function huecosAnuncioPortada(): { izq: HTMLElement | null; der: HTMLElement | null; rellenar: () => void } {
  return huecosLaterales(ADSENSE_PORTADA_IZQ, ADSENSE_PORTADA_DER, 'anuncio-lado');
}

export function huecoAnuncioMovil(): { el: HTMLElement | null; rellenar: () => void } {
  const h = huecosLaterales(ADSENSE_PORTADA_MOVIL, '', 'anuncio-movil');
  return { el: h.izq, rellenar: h.rellenar };
}

export async function iniciarAnuncios() {
  if (__OBJETIVO__ !== 'android') return;
  try {
    const { AdMob, AdmobConsentStatus, BannerAdPluginEvents, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob');
    await AdMob.initialize({ initializeForTesting: ADMOB_PRUEBAS });
    try {
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
    } catch {
      alto(0);
    }
    await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (t) => {
      if (bannerNativo === 'visible') alto(t.height);
    });
    await AdMob.showBanner({
      adId: ADMOB_BANNER,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: ADMOB_PRUEBAS,
    });
    bannerNativo = 'visible';
    if (!deseado) void anuncio(false);
  } catch {
    bannerNativo = 'no';
  }
}

export async function anuncio(visible: boolean) {
  deseado = visible;
  document.body.classList.toggle('sin-anuncio', !visible);
  if (__OBJETIVO__ !== 'android' || bannerNativo === 'no') return;
  const { AdMob } = await import('@capacitor-community/admob');
  try {
    if (visible && bannerNativo === 'oculto') {
      await AdMob.resumeBanner();
      bannerNativo = 'visible';
    } else if (!visible && bannerNativo === 'visible') {
      await AdMob.hideBanner();
      bannerNativo = 'oculto';
      alto(0);
    }
  } catch {
    return;
  }
}
