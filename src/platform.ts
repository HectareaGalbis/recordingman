import { ADMOB_BANNER, ADMOB_PRUEBAS, ADSENSE_BLOQUE, ADSENSE_CLIENTE } from './config';

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

export async function iniciarAnuncios() {
  if (__OBJETIVO__ === 'web') {
    if (!ADSENSE_CLIENTE || !ADSENSE_BLOQUE) return;
    const hueco = document.getElementById('anuncio')!;
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.cssText = 'display:block;width:100%;height:100%';
    ins.dataset.adClient = ADSENSE_CLIENTE;
    ins.dataset.adSlot = ADSENSE_BLOQUE;
    hueco.appendChild(ins);
    hueco.classList.add('activo');
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENTE)}`;
    document.head.appendChild(s);
    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    return;
  }
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
