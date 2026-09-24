/// <reference types="vite-plugin-pwa/client" />
import { Capacitor } from '@capacitor/core'

/**
 * Service worker (solo versión web): guarda la app en el dispositivo para que
 * abra aunque no haya señal. En la app Android/iOS no hace falta: la app ya
 * viene empaquetada con todos sus archivos.
 */
export function registerServiceWorker() {
    if (Capacitor.isNativePlatform() || import.meta.env.DEV || !('serviceWorker' in navigator)) return
    import('virtual:pwa-register')
        .then(({ registerSW }) => {
            registerSW({
                immediate: true,
                onOfflineReady() {
                    console.info('[offline] La app quedó lista para abrir sin conexión')
                },
            })
        })
        .catch(err => console.warn('[offline] No se pudo registrar el service worker', err))
}
