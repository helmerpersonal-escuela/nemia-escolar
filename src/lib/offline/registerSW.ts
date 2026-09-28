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
            const updateSW = registerSW({
                immediate: true,
                onOfflineReady() {
                    console.info('[offline] La app quedó lista para abrir sin conexión')
                },
                // Si hay una versión nueva esperando, se activa y la página se recarga sola
                onNeedRefresh() {
                    updateSW(true)
                },
                // Revisa si hay versión nueva cada 30 min y cada vez que la app vuelve a primer plano
                // (en celular la app puede quedarse abierta días sin recargarse)
                onRegisteredSW(_url, registration) {
                    if (!registration) return
                    const check = () => { if (navigator.onLine) registration.update().catch(() => {}) }
                    setInterval(check, 30 * 60 * 1000)
                    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
                },
            })

            // Cuando la versión nueva toma el control, recargar una sola vez para usarla
            let reloaded = false
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (reloaded) return
                reloaded = true
                window.location.reload()
            })
        })
        .catch(err => console.warn('[offline] No se pudo registrar el service worker', err))
}
