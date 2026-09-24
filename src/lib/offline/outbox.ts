/**
 * Bandeja de salida (outbox): cambios capturados sin conexión que se suben
 * a Supabase en cuanto hay internet.
 *
 * Garantías:
 *  - Persistente (IndexedDB): sobrevive a cerrar la app o reiniciar el celular.
 *  - Idempotente: reintentar no duplica (upsert por llave única o por id).
 *  - Un solo sincronizador para toda la app (evita subidas dobles).
 *  - Si el mismo dato se cambia dos veces sin señal, solo se sube la última versión.
 *  - Errores de datos/permisos no bloquean la cola: tras 3 intentos el cambio
 *    queda como "fallido" y se muestra al docente.
 */
import { supabase } from '../supabase'
import { idbDelete, idbEntries, idbSet } from './idb'
import { browserSaysOnline, isNetworkError } from './network'

type Row = Record<string, unknown>

export type OutboxOp =
    | { op: 'upsert', rows: Row[], onConflict: string }
    | { op: 'insert', rows: Row[] }                 // cada fila DEBE traer `id` (se sube como upsert por id)
    | { op: 'update', values: Row, match: Row }
    | { op: 'delete', match: Row }

export type OutboxInput = OutboxOp & {
    table: string
    /** Si ya hay un cambio pendiente con la misma llave, se reemplaza. */
    dedupeKey?: string
    /** Descripción para mostrar al docente si falla. */
    label?: string
}

export type OutboxItem = OutboxInput & {
    id: string
    /** Usuario que capturó el cambio: solo se sube con SU sesión. */
    ownerId: string | null
    createdAt: number
    attempts: number
    status: 'pending' | 'failed'
    lastError?: string
}

export type OutboxState = {
    pending: number
    failed: number
    syncing: boolean
    lastSyncAt: number | null
    online: boolean
}

const MAX_ATTEMPTS = 3
const RETRY_MS = 30_000

let items: OutboxItem[] = []
let loaded: Promise<void> | null = null
let flushing: Promise<void> | null = null
let lastSyncAt: number | null = null
let online = browserSaysOnline()
let started = false
const listeners = new Set<(s: OutboxState) => void>()

const keyOf = (it: OutboxItem) => `${String(it.createdAt).padStart(15, '0')}-${it.id}`

function uuid(): string {
    try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }
}

export function getState(): OutboxState {
    return {
        pending: items.filter(i => i.status === 'pending').length,
        failed: items.filter(i => i.status === 'failed').length,
        syncing: flushing !== null,
        lastSyncAt,
        online,
    }
}

function emit() {
    const s = getState()
    listeners.forEach(l => { try { l(s) } catch { /* listener roto */ } })
}

export function subscribe(listener: (s: OutboxState) => void): () => void {
    listeners.add(listener)
    listener(getState())
    return () => { listeners.delete(listener) }
}

async function load() {
    if (!loaded) {
        loaded = (async () => {
            const entries = await idbEntries<OutboxItem>('outbox')
            items = entries.map(([, v]) => v).sort((a, b) => a.createdAt - b.createdAt)
            await migrateLegacyQueue()
            emit()
        })()
    }
    return loaded
}

/** Cola antigua (localStorage 'vunlek_offline_outbox') → nueva bandeja. */
async function migrateLegacyQueue() {
    let legacy: Array<{ table: string, action: string, data: Row, filters?: Row }> = []
    try {
        legacy = JSON.parse(localStorage.getItem('vunlek_offline_outbox') || '[]')
    } catch { return }
    if (!Array.isArray(legacy) || legacy.length === 0) return
    for (const m of legacy) {
        if (m.action === 'UPSERT' && m.table === 'attendance') {
            await enqueue({ table: 'attendance', op: 'upsert', rows: [m.data], onConflict: 'student_id,date,group_id,subject_id' })
        } else if (m.action === 'UPSERT' && m.table === 'grades') {
            await enqueue({ table: 'grades', op: 'upsert', rows: [m.data], onConflict: 'assignment_id,student_id' })
        } else if (m.action === 'UPDATE' && m.filters) {
            await enqueue({ table: m.table, op: 'update', values: m.data, match: m.filters })
        } else if (m.action === 'DELETE' && m.filters) {
            await enqueue({ table: m.table, op: 'delete', match: m.filters })
        } else if (m.action === 'INSERT') {
            await enqueue({ table: m.table, op: 'insert', rows: [{ id: uuid(), ...m.data }] })
        }
    }
    try { localStorage.removeItem('vunlek_offline_outbox') } catch { /* sin acceso */ }
}

async function currentUserId(): Promise<string | null> {
    try {
        const { data } = await supabase.auth.getSession()
        return data.session?.user?.id ?? null
    } catch {
        return null
    }
}

async function persist(item: OutboxItem) {
    await idbSet('outbox', keyOf(item), item)
}

export async function enqueue(input: OutboxInput): Promise<OutboxItem> {
    await load()
    if (input.op === 'insert') {
        input = { ...input, rows: input.rows.map(r => ('id' in r && r.id ? r : { ...r, id: uuid() })) }
    }
    if (input.dedupeKey) {
        const dup = items.filter(i => i.dedupeKey === input.dedupeKey && i.table === input.table)
        for (const d of dup) {
            items = items.filter(i => i !== d)
            await idbDelete('outbox', keyOf(d))
        }
    }
    const item: OutboxItem = { ...input, id: uuid(), ownerId: await currentUserId(), createdAt: Date.now(), attempts: 0, status: 'pending' }
    items.push(item)
    await persist(item)
    emit()
    scheduleFlush(500)
    return item
}

function applyMatch<Q extends { eq: (c: string, v: unknown) => Q, is: (c: string, v: null) => Q }>(q: Q, match: Row): Q {
    for (const [col, val] of Object.entries(match)) {
        q = val === null ? q.is(col, null) : q.eq(col, val)
    }
    return q
}

/** Ejecuta un cambio directamente contra Supabase. */
export async function execute(m: OutboxOp & { table: string }): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = supabase.from(m.table) as any
    let res: { error: unknown }
    switch (m.op) {
        case 'upsert':
            res = await table.upsert(m.rows, { onConflict: m.onConflict })
            break
        case 'insert':
            res = await table.upsert(m.rows, { onConflict: 'id', ignoreDuplicates: true })
            break
        case 'update':
            res = await applyMatch(table.update(m.values), m.match)
            break
        case 'delete':
            res = await applyMatch(table.delete(), m.match)
            break
    }
    if (res.error) throw res.error
}

function describe(error: unknown): string {
    const e = error as { message?: string, code?: string }
    if (e?.code === '42501') return 'Sin permiso para guardar este dato'
    return e?.message || String(error)
}

export async function flush(): Promise<void> {
    await load()
    if (flushing) return flushing
    if (!items.some(i => i.status === 'pending')) return
    flushing = (async () => {
        emit()
        try {
            const me = await currentUserId()
            if (!me) return // sin sesión no se sube nada (se intentará al iniciar sesión)
            for (const item of [...items]) {
                if (item.status !== 'pending') continue
                if (item.ownerId && item.ownerId !== me) continue // cambios de otro usuario en este dispositivo
                try {
                    await execute(item)
                    items = items.filter(i => i !== item)
                    await idbDelete('outbox', keyOf(item))
                    setOnline(true)
                    emit()
                } catch (error) {
                    if (isNetworkError(error)) {
                        setOnline(false)
                        break // sin señal: se reintenta después, en el mismo orden
                    }
                    item.attempts += 1
                    item.lastError = describe(error)
                    if (item.attempts >= MAX_ATTEMPTS) item.status = 'failed'
                    await persist(item)
                    emit()
                }
            }
            if (!items.some(i => i.status === 'pending')) lastSyncAt = Date.now()
        } finally {
            flushing = null
            emit()
            if (items.some(i => i.status === 'pending')) scheduleFlush(RETRY_MS)
        }
    })()
    return flushing
}

let timer: ReturnType<typeof setTimeout> | null = null
function scheduleFlush(ms: number) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; void flush() }, ms)
}

function setOnline(value: boolean) {
    if (online !== value) {
        online = value
        emit()
    }
}

/**
 * Guarda en línea si se puede; si no hay conexión (o la conexión falla a
 * medio camino), lo deja en la bandeja de salida.
 * Lanza error solo si el problema NO es de conexión (datos o permisos).
 */
export async function saveOrQueue(input: OutboxInput): Promise<{ queued: boolean }> {
    if (!browserSaysOnline()) {
        await enqueue(input)
        return { queued: true }
    }
    try {
        await load()
        // Si hay cambios anteriores pendientes, el nuevo va detrás de ellos para respetar el orden.
        if (items.some(i => i.status === 'pending')) {
            const item = await enqueue(input)
            await flush()
            const stillThere = items.find(i => i.id === item.id)
            if (stillThere?.status === 'failed') throw new Error(stillThere.lastError || 'No se pudo guardar')
            return { queued: !!stillThere }
        }
        const prepared = input.op === 'insert'
            ? { ...input, rows: input.rows.map(r => ('id' in r && r.id ? r : { ...r, id: uuid() })) }
            : input
        await execute(prepared)
        setOnline(true)
        lastSyncAt = Date.now()
        emit()
        return { queued: false }
    } catch (error) {
        if (isNetworkError(error)) {
            setOnline(false)
            await enqueue(input)
            return { queued: true }
        }
        throw error
    }
}

/** Filas pendientes de subir de una tabla (para mostrarlas aunque no haya señal). */
export async function pendingRows(table: string): Promise<Row[]> {
    await load()
    const out: Row[] = []
    for (const i of items) {
        if (i.table !== table) continue
        if (i.op === 'upsert' || i.op === 'insert') out.push(...i.rows)
    }
    return out
}

export async function failedItems(): Promise<OutboxItem[]> {
    await load()
    return items.filter(i => i.status === 'failed')
}

export async function retryFailed(): Promise<void> {
    await load()
    for (const i of items) {
        if (i.status === 'failed') {
            i.status = 'pending'
            i.attempts = 0
            await persist(i)
        }
    }
    emit()
    await flush()
}

export async function discardFailed(id: string): Promise<void> {
    await load()
    const it = items.find(i => i.id === id)
    if (!it) return
    items = items.filter(i => i !== it)
    await idbDelete('outbox', keyOf(it))
    emit()
}

/** Arranca el sincronizador (una sola vez por app). */
export function startOutbox() {
    if (started || typeof window === 'undefined') return
    started = true
    void load().then(() => flush())
    window.addEventListener('online', () => { setOnline(true); void flush() })
    window.addEventListener('offline', () => setOnline(false))
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void flush()
    })
}

/** Solo para pruebas */
export function __resetOutbox() {
    items = []
    loaded = null
    flushing = null
    lastSyncAt = null
    online = browserSaysOnline()
    if (timer) { clearTimeout(timer); timer = null }
}
