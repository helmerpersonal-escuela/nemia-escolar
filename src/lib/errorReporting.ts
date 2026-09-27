import { Capacitor } from '@capacitor/core'
import { supabase, onApiResult, type ApiResult } from './supabase'
import { isNetworkError } from './offline/network'

/**
 * Registro automático y silencioso de errores y fricciones en `client_errors`
 * (solo lectura para super admin; se revisa en God Mode → Errores).
 *
 * El usuario no ve nada: se registra en segundo plano. Nunca se guardan datos
 * capturados en formularios; solo el mensaje técnico, la pantalla y el contexto
 * (escuela, rol, plataforma). Cada problema se envía una sola vez por sesión.
 *
 * Tipos:
 *  - render / window / promise: la pantalla o el código fallaron.
 *  - api: Supabase respondió con error (permisos, datos inválidos, función caída…).
 *  - query: falló la carga de datos de una pantalla por un error de código.
 *  - alert: la app le mostró al usuario un aviso de error (ver Toast.tsx).
 *  - console: la app registró un error interno que no llegó a mostrarse.
 *  - ux: señales de mejora (clics repetidos en algo que no responde, consultas lentas).
 */

const MAX_PER_SESSION = 60
const SLOW_MS = 8000
const SENT_KEY = 'vunlek_reported'
const sent = new Set<string>((() => { try { return JSON.parse(sessionStorage.getItem(SENT_KEY) || '[]') as string[] } catch { return [] } })())
let count = sent.size
const remember = () => { try { sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-MAX_PER_SESSION))) } catch { /* sin almacenamiento */ } }

const IGNORE = [
    /ResizeObserver loop/i,
    /Failed to fetch dynamically imported module/i, // lo resuelve lazyNamed recargando
    /Importing a module script failed/i,
    /Load failed/i,
    /AbortError/i,
    /The user aborted a request/i,
    /Script error\.?$/i,
    /Failed to fetch/i,
    /NetworkError/i,
]

export type ErrorKind = 'render' | 'window' | 'promise' | 'manual' | 'api' | 'query' | 'alert' | 'console' | 'ux'

interface ErrorContext {
    tenantId?: string | null
    role?: string | null
}
let context: ErrorContext = {}

/** La app avisa en qué escuela y con qué rol se está trabajando. */
export function setErrorContext(next: ErrorContext) {
    context = { ...context, ...next }
}

const reportingEnabled = () =>
    !(import.meta.env.MODE === 'test') &&
    (!import.meta.env.DEV || import.meta.env.VITE_REPORT_ERRORS_IN_DEV === 'true')

const platform = () => {
    try { return Capacitor.getPlatform() } catch { return 'web' }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Quita ids y números para que el mismo problema se agrupe en un solo renglón. */
function normalize(text: string) {
    return text.replace(UUID, ':id').replace(/\b\d{3,}\b/g, ':n').replace(/\s+/g, ' ').trim()
}

const route = () => normalize(location.pathname).slice(0, 300)

function send(kind: ErrorKind, message: string, fingerprint: string, stack?: string, extra?: Record<string, unknown>) {
    const key = fingerprint.slice(0, 300)
    if (sent.has(key) || count >= MAX_PER_SESSION) return
    sent.add(key)
    count++
    remember()
    let safeExtra: unknown = null
    try {
        safeExtra = JSON.parse(JSON.stringify({
            ...extra,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            online: navigator.onLine,
        }).slice(0, 3800))
    } catch { safeExtra = null }
    void supabase.from('client_errors').insert({
        kind,
        message: message.slice(0, 1000),
        stack: (stack ?? '').slice(0, 6000) || null,
        url: route(),
        user_agent: navigator.userAgent.slice(0, 300),
        app_version: String(import.meta.env.VITE_APP_VERSION ?? 'web').slice(0, 40),
        tenant_id: context.tenantId ?? null,
        role: context.role ? String(context.role).slice(0, 40) : null,
        platform: platform().slice(0, 20),
        fingerprint: key,
        extra: safeExtra,
    }).then(() => undefined, () => undefined)
}

export function reportError(kind: ErrorKind, error: unknown, extra?: Record<string, unknown>) {
    try {
        if (!reportingEnabled()) {
            if (import.meta.env.DEV) originalConsoleError(`[${kind}]`, error, extra ?? '')
            return
        }
        if (!navigator.onLine || isNetworkError(error)) return
        const err = error instanceof Error
            ? error
            : new Error(typeof error === 'string' ? error : (error as any)?.message ?? JSON.stringify(error ?? 'Error desconocido'))
        const message = (err.message || 'Error desconocido').slice(0, 1000)
        if (IGNORE.some(re => re.test(message))) return
        send(kind, message, `${kind}:${route()}:${normalize(message).slice(0, 160)}`, err.stack, extra)
    } catch {
        // Nunca romper la app por el registro de errores.
    }
}

/** Señal de mejora (no es un error de código). */
export function reportFriction(message: string, extra?: Record<string, unknown>) {
    try {
        if (!reportingEnabled()) return
        send('ux', message, `ux:${route()}:${normalize(message).slice(0, 160)}`, undefined, extra)
    } catch { /* nada */ }
}

// --- Errores de Supabase ---------------------------------------------------

function describeApi(r: ApiResult) {
    const u = new URL(r.url)
    const parts = u.pathname.split('/').filter(Boolean) // rest v1 tabla | rest v1 rpc fn | functions v1 fn | storage v1 object bucket
    const service = parts[0]
    let target = parts.slice(2).join('/')
    if (service === 'storage') target = parts.slice(2, 4).join('/')
    return { service, target: normalize(target).slice(0, 80) }
}

function handleApi(r: ApiResult) {
    try {
        if (!reportingEnabled()) return
        const { service, target } = describeApi(r)
        if (service === 'auth') return // contraseñas equivocadas, sesiones vencidas: no son fallas de la app
        if (r.status === 0) return
        const body = (r.body ?? {}) as { code?: string; message?: string; error?: string; hint?: string }
        if (r.ok) {
            if (r.ms > SLOW_MS) {
                reportFriction(`Consulta lenta: ${r.method} ${target} (${(r.ms / 1000).toFixed(1)} s)`, { service, ms: Math.round(r.ms) })
            }
            return
        }
        if (r.status === 406 && body.code === 'PGRST116') return // .single() sin resultados
        const msg = body.message || body.error || `HTTP ${r.status}`
        send('api', `${r.method} ${service}/${target} → ${r.status}${body.code ? ` [${body.code}]` : ''}: ${msg}`,
            `api:${r.method}:${service}/${target}:${r.status}:${body.code ?? ''}`,
            undefined,
            { service, status: r.status, code: body.code ?? null, hint: body.hint ?? null, ms: Math.round(r.ms) })
    } catch { /* nada */ }
}

// --- Instalación -----------------------------------------------------------

const originalConsoleError = console.error.bind(console)

function isPostgrestError(error: unknown) {
    return !!error && typeof error === 'object' && 'code' in error && 'details' in error && 'hint' in error
}

/** Errores de React Query que no vienen de Supabase (esos ya los registra la capa de red). */
export function reportQueryError(error: unknown, key: unknown, mutation = false) {
    if (isPostgrestError(error)) return
    reportError('query', error, { key: String(Array.isArray(key) ? key[0] : key ?? '').slice(0, 80), mutation })
}

let lastClick: { el: Element | null; at: number; n: number } = { el: null, at: 0, n: 0 }

function labelOf(el: Element) {
    const aria = el.getAttribute('aria-label')
    if (aria) return aria
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        return el.getAttribute('placeholder') || el.name || el.tagName.toLowerCase()
    }
    return (el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 50)
}

export function installGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        reportError('window', event.error ?? event.message, { source: event.filename, line: event.lineno })
    })
    window.addEventListener('unhandledrejection', (event) => {
        reportError('promise', event.reason)
    })

    onApiResult(handleApi)

    // Los avisos de error (alert/toast) se registran en components/ui/Toast.tsx.

    // Errores internos que la app solo escribe en consola.
    if (reportingEnabled()) {
        console.error = (...args: unknown[]) => {
            originalConsoleError(...args)
            try {
                const first = args.find(a => a instanceof Error) ?? args.map(a => (typeof a === 'string' ? a : (a as any)?.message ?? '')).join(' ').trim()
                const text = first instanceof Error ? first.message : String(first)
                if (!text || /^Warning:/.test(text) || text.startsWith('[')) return
                if (isPostgrestError(args.find(a => typeof a === 'object'))) return // ya registrado como api
                reportError('console', first instanceof Error ? first : text.slice(0, 500))
            } catch { /* nada */ }
        }
    }

    // Clics repetidos sobre el mismo elemento: suele ser algo que no responde o confunde.
    document.addEventListener('click', (event) => {
        try {
            const target = (event.target as Element | null)?.closest?.('button, a, [role="button"], input, select, label, [onclick]') ?? null
            if (!target) return
            const now = performance.now()
            if (lastClick.el === target && now - lastClick.at < 1000) {
                lastClick.n++
            } else {
                lastClick = { el: target, at: now, n: 1 }
            }
            lastClick.at = now
            if (lastClick.n === 4) {
                const disabled = (target as HTMLButtonElement).disabled === true
                reportFriction(`Clics repetidos en «${labelOf(target)}»${disabled ? ' (botón deshabilitado)' : ''}`, { tag: target.tagName })
            }
        } catch { /* nada */ }
    }, true)
}
