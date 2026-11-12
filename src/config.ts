const env = import.meta.env;

export type Objetivo = 'web' | 'android' | 'desktop';
export const OBJETIVO: Objetivo = __OBJETIVO__;
export const ES_WEB = OBJETIVO === 'web';

export const URL_COMPARTIR: string = env.VITE_SHARE_URL || 'https://recordingman.example';
export const ADSENSE_CLIENTE: string = env.VITE_ADSENSE_CLIENT || '';
export const ADSENSE_BLOQUE: string = env.VITE_ADSENSE_SLOT || '';
export const ADSENSE_FIN_IZQ: string = env.VITE_ADSENSE_SLOT_FIN_IZQ || '';
export const ADSENSE_FIN_DER: string = env.VITE_ADSENSE_SLOT_FIN_DER || '';
export const ADMOB_BANNER: string = env.VITE_ADMOB_BANNER_ID || 'ca-app-pub-3940256099942544/6300978111';
export const ADMOB_PRUEBAS: boolean = !env.VITE_ADMOB_BANNER_ID;
export const URL_ANDROID: string = env.VITE_ANDROID_STORE_URL || '';
export const URL_PC: string = env.VITE_DESKTOP_URL || '';
export const PAQUETE_ANDROID = 'com.hectarea.recordingman';
