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
export const supabase = createClient(supabaseUrl || 'https://config-faltante.invalid', supabaseAnonKey || 'config-faltante', {
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
