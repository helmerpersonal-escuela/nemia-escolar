/**
 * Caché de lectura: guarda la última versión de un conjunto de datos para
 * poder mostrarlo sin señal.
 */
import { idbDelete, idbGet, idbSet, idbEntries } from './idb'
import { isNetworkError, browserSaysOnline } from './network'

export type Cached<T> = { data: T, savedAt: number }

export async function readCache<T>(key: string): Promise<Cached<T> | undefined> {
    return idbGet<Cached<T>>('cache', key)
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
    await idbSet('cache', key, { data, savedAt: Date.now() } satisfies Cached<T>)
}

export async function cacheKeys(prefix: string): Promise<string[]> {
    const entries = await idbEntries<Cached<unknown>>('cache')
    return entries.map(([k]) => k).filter(k => k.startsWith(prefix))
}

/**
 * Intenta traer datos frescos; si no hay conexión devuelve la copia guardada.
 * `fromCache` indica que se muestran datos guardados (y de cuándo).
 */
export async function withOfflineCache<T>(
    key: string,
    fetcher: () => Promise<T>,
): Promise<{ data: T | undefined, fromCache: boolean, savedAt?: number }> {
    if (!browserSaysOnline()) {
        const c = await readCache<T>(key)
        return { data: c?.data, fromCache: true, savedAt: c?.savedAt }
    }
    try {
        const data = await fetcher()
        await writeCache(key, data)
        return { data, fromCache: false }
    } catch (error) {
        if (!isNetworkError(error)) throw error
        const c = await readCache<T>(key)
        return { data: c?.data, fromCache: true, savedAt: c?.savedAt }
    }
}

/** Convierte `{ data, error }` de Supabase en valor o excepción (para usar con withOfflineCache). */
export function must<T>(res: { data: T | null, error: unknown }): T {
    if (res.error) throw res.error
    return res.data as T
}

/** Borra copias guardadas (p. ej. al cerrar sesión, para no dejar datos de un docente a otro). */
export async function clearCache(prefix: string): Promise<void> {
    for (const k of await cacheKeys(prefix)) await idbDelete('cache', k)
}
