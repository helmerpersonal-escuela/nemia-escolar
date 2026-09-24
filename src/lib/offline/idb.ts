/**
 * Almacenamiento local mínimo sobre IndexedDB (clave → valor).
 * Dos "tablas": `outbox` (cambios pendientes de subir) y `cache` (datos para leer sin señal).
 * Si IndexedDB no está disponible (modo privado muy restrictivo, pruebas), usa memoria.
 */

export type StoreName = 'outbox' | 'cache'

const DB_NAME = 'vunlek-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null
const memory: Record<StoreName, Map<string, unknown>> = { outbox: new Map(), cache: new Map() }

function hasIndexedDB(): boolean {
    try {
        return typeof indexedDB !== 'undefined' && indexedDB !== null
    } catch {
        return false
    }
}

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION)
            req.onupgradeneeded = () => {
                const db = req.result
                if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox')
                if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache')
            }
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
        dbPromise.catch(() => { dbPromise = null })
    }
    return dbPromise
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return openDb().then(db => new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = fn(tx.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    }))
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
    if (!hasIndexedDB()) return memory[store].get(key) as T | undefined
    try {
        return await run<T>(store, 'readonly', s => s.get(key) as IDBRequest<T>)
    } catch {
        return memory[store].get(key) as T | undefined
    }
}

export async function idbSet(store: StoreName, key: string, value: unknown): Promise<void> {
    memory[store].set(key, value)
    if (!hasIndexedDB()) return
    try {
        await run(store, 'readwrite', s => s.put(value, key))
    } catch (e) {
        console.warn('[offline] No se pudo guardar en IndexedDB, se conserva en memoria', e)
    }
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
    memory[store].delete(key)
    if (!hasIndexedDB()) return
    try {
        await run(store, 'readwrite', s => s.delete(key))
    } catch { /* se ignora */ }
}

export async function idbEntries<T>(store: StoreName): Promise<Array<[string, T]>> {
    if (!hasIndexedDB()) return [...memory[store].entries()] as Array<[string, T]>
    try {
        const db = await openDb()
        return await new Promise((resolve, reject) => {
            const out: Array<[string, T]> = []
            const tx = db.transaction(store, 'readonly')
            const req = tx.objectStore(store).openCursor()
            req.onsuccess = () => {
                const cursor = req.result
                if (cursor) {
                    out.push([String(cursor.key), cursor.value as T])
                    cursor.continue()
                } else {
                    resolve(out)
                }
            }
            req.onerror = () => reject(req.error)
        })
    } catch {
        return [...memory[store].entries()] as Array<[string, T]>
    }
}

/** Solo para pruebas */
export function __resetMemoryStores() {
    memory.outbox.clear()
    memory.cache.clear()
}
