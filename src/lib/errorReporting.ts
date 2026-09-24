import { supabase } from './supabase'
import { isNetworkError } from './offline/network'

/**
 * Registro de errores del navegador en la tabla `client_errors` (solo lectura para
 * super admin). Sirve para detectar fallas en producción sin depender de que el
 * docente las reporte. Limitado a pocos envíos por sesión y sin datos del formulario.
 */

const MAX_PER_SESSION = 15
const sent = new Set<string>()
let count = 0

const IGNORE = [
    /ResizeObserver loop/i,
    /Failed to fetch dynamically imported module/i, // lo resuelve lazyNamed recargando
    /Importing a module script failed/i,
    /Load failed/i,
    /AbortError/i,
    /The user aborted a request/i,
    /Script error\.?$/i,
]

export type ErrorKind = 'render' | 'window' | 'promise' | 'manual'

export function reportError(kind: ErrorKind, error: unknown, extra?: Record<string, unknown>) {
    try {
        if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
            console.error(`[${kind}]`, error, extra ?? '')
            return
        }
        if (!navigator.onLine || isNetworkError(error)) return
        const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error ?? 'Error desconocido'))
        const message = (err.message || 'Error desconocido').slice(0, 1000)
        if (IGNORE.some(re => re.test(message))) return
        const key = `${kind}:${message}`
        if (sent.has(key) || count >= MAX_PER_SESSION) return
        sent.add(key)
        count++
        void supabase.from('client_errors').insert({
            kind,
            message,
            stack: (err.stack ?? '').slice(0, 6000),
            url: location.pathname.slice(0, 300),
            user_agent: navigator.userAgent.slice(0, 300),
            app_version: String(import.meta.env.VITE_APP_VERSION ?? 'web'),
            extra: extra ? JSON.parse(JSON.stringify(extra).slice(0, 2000)) : null,
        }).then(() => undefined, () => undefined)
    } catch {
        // Nunca romper la app por el registro de errores.
    }
}

export function installGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        reportError('window', event.error ?? event.message, { source: event.filename, line: event.lineno })
    })
    window.addEventListener('unhandledrejection', (event) => {
        reportError('promise', event.reason)
    })
}
