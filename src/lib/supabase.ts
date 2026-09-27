import { createClient, type Session } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { isNetworkError } from './offline/network'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Tipos de la base de datos disponibles para código nuevo. El cliente global aún no
// está tipado (ver calidad-fase3.md): activarlo se hará por módulos.
export type { Database }

// Si faltan las variables, main.tsx muestra un aviso claro; aquí solo se evita que
// la importación truene antes de poder mostrarlo.
// ---------------------------------------------------------------------------
// Registro silencioso de respuestas con error o muy lentas (ver errorReporting.ts).
// ---------------------------------------------------------------------------
export interface ApiResult { method: string; url: string; status: number; ok: boolean; ms: number; body: unknown }
let apiListener: ((r: ApiResult) => void) | null = null
export function onApiResult(fn: (r: ApiResult) => void) { apiListener = fn }

const trackedFetch: typeof fetch = async (input, init) => {
    const started = performance.now()
    const res = await fetch(input, init)
    try {
        const listener = apiListener
        const ms = performance.now() - started
        if (listener && (!res.ok || ms > 8000)) {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
            if (!url.includes('/client_errors')) {
                const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
                const body = res.ok ? null : await res.clone().json().catch(() => null)
                listener({ method, url, status: res.status, ok: res.ok, ms, body })
            }
        }
    } catch { /* el registro nunca debe afectar la respuesta */ }
    return res
}

export const supabase = createClient(supabaseUrl || 'https://config-faltante.invalid', supabaseAnonKey || 'config-faltante', {
    global: { fetch: trackedFetch },
    auth: {
        storage: window.localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
})

// ---------------------------------------------------------------------------
// Modo sin conexión: la sesión guardada sigue valiendo para trabajar offline.
// Supabase intenta renovar el token al abrir la app; sin señal esa renovación
// falla y devolvería "sin sesión" (lo que mandaba al docente al login). En ese
// caso usamos la sesión guardada; al volver la señal, se renueva sola.
// ---------------------------------------------------------------------------
function storedSession(): Session | null {
    try {
        const key = Object.keys(window.localStorage).find(k => /^sb-.*-auth-token$/.test(k))
        if (!key) return null
        const parsed = JSON.parse(window.localStorage.getItem(key) || 'null')
        const session = parsed?.currentSession ?? parsed
        return session?.user && session?.access_token ? (session as Session) : null
    } catch {
        return null
    }
}

const auth = supabase.auth
const originalGetSession = auth.getSession.bind(auth)
const originalGetUser = auth.getUser.bind(auth)
const TIMEOUT = Symbol('timeout')

/**
 * Sin señal, Supabase reintenta renovar el token hasta ~30 s antes de responder
 * (la app se quedaba en "Cargando..."). Si tarda y hay una sesión guardada, se usa esa.
 */
async function raceWithStored<T>(call: () => Promise<T>): Promise<T | typeof TIMEOUT> {
    const hasStored = !!storedSession()
    if (!hasStored) return call()
    const wait = typeof navigator !== 'undefined' && navigator.onLine === false ? 1500 : 8000
    return Promise.race([call(), new Promise<typeof TIMEOUT>(r => setTimeout(() => r(TIMEOUT), wait))])
}

auth.getSession = (async () => {
    const res = await raceWithStored(originalGetSession)
    const s = storedSession()
    if (res === TIMEOUT) return { data: { session: s }, error: null }
    if (!res.data.session && res.error && isNetworkError(res.error) && s) {
        return { data: { session: s }, error: null }
    }
    return res
}) as typeof auth.getSession

auth.getUser = (async (jwt?: string) => {
    if (jwt) return originalGetUser(jwt)
    const res = await raceWithStored(() => originalGetUser())
    const s = storedSession()
    if (res === TIMEOUT) return { data: { user: s?.user ?? null }, error: null }
    if (!res.data.user && res.error && isNetworkError(res.error) && s) {
        return { data: { user: s.user }, error: null }
    }
    return res
}) as typeof auth.getUser
