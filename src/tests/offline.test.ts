import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Supabase simulado ----
type Call = { table: string, op: string, payload?: unknown, opts?: unknown, filters: Array<[string, string, unknown]> }
const calls: Call[] = []
let nextResult: () => { error: unknown } = () => ({ error: null })
let sessionUser: string | null = 'user-1'

function builder(table: string, op: string, payload?: unknown, opts?: unknown) {
    const call: Call = { table, op, payload, opts, filters: [] }
    const b = {
        eq(c: string, v: unknown) { call.filters.push(['eq', c, v]); return b },
        is(c: string, v: unknown) { call.filters.push(['is', c, v]); return b },
        then(resolve: (r: { error: unknown }) => void, reject: (e: unknown) => void) {
            calls.push(call)
            try { resolve(nextResult()) } catch (e) { reject(e) }
        },
    }
    return b
}

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: (table: string) => ({
            upsert: (rows: unknown, opts: unknown) => builder(table, 'upsert', rows, opts),
            update: (v: unknown) => builder(table, 'update', v),
            delete: () => builder(table, 'delete'),
        }),
        auth: {
            getSession: async () => ({ data: { session: sessionUser ? { user: { id: sessionUser } } : null }, error: null }),
        },
    },
}))

import {
    __resetOutbox, enqueue, flush, getState, pendingRows, retryFailed, saveOrQueue, failedItems,
} from '../lib/offline/outbox'
import { __resetMemoryStores } from '../lib/offline/idb'
import { isNetworkError } from '../lib/offline/network'
import { mergeRows, attendanceKey, withPendingChanges, type GradebookBundle } from '../lib/offline/gradebookData'

const netError = () => ({ error: { name: 'TypeError', message: 'Failed to fetch' } })
const setOnline = (v: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => v })

const att = (student: string, status = 'PRESENT') => ({
    tenant_id: 't1', group_id: 'g1', student_id: student, date: '2026-09-23', status, subject_id: null,
})

beforeEach(() => {
    calls.length = 0
    nextResult = () => ({ error: null })
    sessionUser = 'user-1'
    setOnline(true)
    __resetMemoryStores()
    __resetOutbox()
})

describe('saveOrQueue (captura con o sin señal)', () => {
    it('con señal guarda al momento con upsert por llave única', async () => {
        const res = await saveOrQueue({ table: 'attendance', op: 'upsert', rows: [att('s1')], onConflict: 'student_id,date,group_id,subject_id' })
        expect(res.queued).toBe(false)
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ table: 'attendance', op: 'upsert', opts: { onConflict: 'student_id,date,group_id,subject_id' } })
        expect(getState().pending).toBe(0)
    })

    it('sin señal (navegador offline) lo guarda en el dispositivo sin llamar al servidor', async () => {
        setOnline(false)
        const res = await saveOrQueue({ table: 'attendance', op: 'upsert', rows: [att('s1')], onConflict: 'x' })
        expect(res.queued).toBe(true)
        expect(calls).toHaveLength(0)
        expect(getState().pending).toBe(1)
        expect(await pendingRows('attendance')).toEqual([att('s1')])
    })

    it('si la conexión falla a medio camino (Wi-Fi sin internet) también queda guardado', async () => {
        nextResult = netError
        const res = await saveOrQueue({ table: 'grades', op: 'upsert', rows: [{ assignment_id: 'a', student_id: 's', score: 9 }], onConflict: 'assignment_id,student_id' })
        expect(res.queued).toBe(true)
        expect(getState().pending).toBe(1)
        expect(getState().online).toBe(false)
    })

    it('un error de datos o permisos NO se oculta: se informa y no se encola', async () => {
        nextResult = () => ({ error: { code: '42501', message: 'new row violates row-level security policy' } })
        await expect(saveOrQueue({ table: 'grades', op: 'upsert', rows: [{}], onConflict: 'x' })).rejects.toBeTruthy()
        expect(getState().pending).toBe(0)
    })

    it('al volver la señal sube todo en orden y vacía la bandeja', async () => {
        setOnline(false)
        await saveOrQueue({ table: 'attendance', op: 'upsert', rows: [att('s1')], onConflict: 'k' })
        await saveOrQueue({ table: 'grades', op: 'upsert', rows: [{ assignment_id: 'a', student_id: 's1', score: 8 }], onConflict: 'k' })
        expect(getState().pending).toBe(2)

        setOnline(true)
        await flush()
        expect(calls.map(c => c.table)).toEqual(['attendance', 'grades'])
        expect(getState().pending).toBe(0)
        expect(getState().lastSyncAt).not.toBeNull()
    })

    it('corregir el mismo pase de lista sin señal solo sube la última versión', async () => {
        setOnline(false)
        await saveOrQueue({ table: 'attendance', op: 'upsert', rows: [att('s1', 'ABSENT')], onConflict: 'k', dedupeKey: 'att:g1:hoy' })
        await saveOrQueue({ table: 'attendance', op: 'upsert', rows: [att('s1', 'PRESENT')], onConflict: 'k', dedupeKey: 'att:g1:hoy' })
        expect(getState().pending).toBe(1)
        expect((await pendingRows('attendance'))[0]).toMatchObject({ status: 'PRESENT' })
    })

    it('las incidencias nuevas llevan id propio y se suben sin duplicar (upsert por id, ignorar repetidos)', async () => {
        setOnline(false)
        await saveOrQueue({ table: 'student_incidents', op: 'insert', rows: [{ title: 'x' }] })
        const [row] = await pendingRows('student_incidents')
        expect(row.id).toBeTruthy()

        setOnline(true)
        await flush()
        expect(calls[0]).toMatchObject({ op: 'upsert', opts: { onConflict: 'id', ignoreDuplicates: true } })
    })

    it('si el servidor sigue sin responder, los cambios esperan (no se pierden ni se marcan como fallidos)', async () => {
        setOnline(false)
        await enqueue({ table: 'attendance', op: 'upsert', rows: [att('s1')], onConflict: 'k' })
        setOnline(true)
        nextResult = netError
        await flush()
        await flush()
        await flush()
        expect(getState()).toMatchObject({ pending: 1, failed: 0 })
    })

    it('un cambio rechazado 3 veces pasa a "fallido", no bloquea a los demás y se puede reintentar', async () => {
        setOnline(false)
        await enqueue({ table: 'grades', op: 'upsert', rows: [{ bad: true }], onConflict: 'k', label: 'Calif. de Ana' })
        await enqueue({ table: 'attendance', op: 'upsert', rows: [att('s2')], onConflict: 'k' })
        setOnline(true)
        nextResult = () => {
            const last = calls[calls.length - 1]
            return last.table === 'grades' ? { error: { code: '23503', message: 'fk' } } : { error: null }
        }
        await flush(); await flush(); await flush()
        expect(getState()).toMatchObject({ pending: 0, failed: 1 })
        expect(calls.filter(c => c.table === 'attendance')).toHaveLength(1)
        const [f] = await failedItems()
        expect(f.label).toBe('Calif. de Ana')

        nextResult = () => ({ error: null })
        await retryFailed()
        expect(getState()).toMatchObject({ pending: 0, failed: 0 })
    })

    it('en un dispositivo compartido, los cambios de un docente no se suben con la sesión de otro', async () => {
        setOnline(false)
        await enqueue({ table: 'attendance', op: 'upsert', rows: [att('s1')], onConflict: 'k' })
        sessionUser = 'user-2'
        setOnline(true)
        await flush()
        expect(calls).toHaveLength(0)
        expect(getState().pending).toBe(1)

        sessionUser = 'user-1'
        await flush()
        expect(calls).toHaveLength(1)
    })

    it('sin sesión no se sube nada', async () => {
        setOnline(false)
        await enqueue({ table: 'attendance', op: 'upsert', rows: [att('s1')], onConflict: 'k' })
        sessionUser = null
        setOnline(true)
        await flush()
        expect(calls).toHaveLength(0)
    })

    it('update y delete aplican los filtros (incluye null con .is)', async () => {
        await saveOrQueue({ table: 'student_incidents', op: 'update', values: { title: 'y' }, match: { id: 'i1', subject_id: null } })
        expect(calls[0].filters).toEqual([['eq', 'id', 'i1'], ['is', 'subject_id', null]])
    })
})

describe('detección de falta de conexión', () => {
    it.each([
        [{ name: 'TypeError', message: 'Failed to fetch' }, true],
        [{ message: 'NetworkError when attempting to fetch resource.' }, true],
        [{ message: 'Load failed' }, true],
        [{ name: 'AuthRetryableFetchError', message: 'x' }, true],
        [{ code: '42501', message: 'permission denied' }, false],
        [{ code: '23505', message: 'duplicate key value' }, false],
        [null, false],
    ])('%j → %s', (err, expected) => {
        expect(isNetworkError(err)).toBe(expected)
    })
})

describe('datos de la libreta sin señal', () => {
    it('lo capturado sin señal se muestra encima de la copia guardada', async () => {
        const bundle: GradebookBundle = {
            periods: [], group: { id: 'g1' }, subjects: [], criteria: [], assignments: [], lessonPlans: [], rubrics: [],
            students: [{ id: 's1' }, { id: 's2' }],
            attendance: [{ ...att('s1', 'ABSENT'), id: 'a1' }],
            grades: [{ assignment_id: 'as1', student_id: 's1', score: 6 }],
            incidents: [{ id: 'old', student_id: 's1' }],
        }
        setOnline(false)
        await enqueue({ table: 'attendance', op: 'upsert', rows: [att('s1', 'PRESENT'), att('s2', 'LATE')], onConflict: 'k' })
        await enqueue({ table: 'grades', op: 'upsert', rows: [{ assignment_id: 'as1', student_id: 's1', score: 10 }], onConflict: 'k' })
        await enqueue({ table: 'student_incidents', op: 'insert', rows: [{ student_id: 's2', title: 'nuevo' }] })
        await enqueue({ table: 'attendance', op: 'upsert', rows: [{ ...att('s9'), group_id: 'otro' }], onConflict: 'k' })

        const merged = await withPendingChanges(bundle, 'g1')
        expect(merged.attendance).toHaveLength(2)
        expect(merged.attendance.find(a => a.student_id === 's1')).toMatchObject({ status: 'PRESENT', id: 'a1', __pending: true })
        expect(merged.grades[0]).toMatchObject({ score: 10, __pending: true })
        expect(merged.incidents.map(i => i.title ?? i.id)).toEqual(['nuevo', 'old'])
    })

    it('mergeRows combina por llave sin duplicar', () => {
        const out = mergeRows([att('s1', 'ABSENT')], [att('s1', 'PRESENT')], attendanceKey)
        expect(out).toHaveLength(1)
        expect(out[0].status).toBe('PRESENT')
    })
})
