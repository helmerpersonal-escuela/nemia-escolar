// Días con horario especial: cómo se ajustan las clases de un día.
import { supabase } from './supabase'

export type SpecialMode = 'SHORTENED' | 'BLOCKED' | 'NO_CLASSES'
export interface TimeRange { start: string; end: string; label?: string }
export interface BreakDef { name?: string; start_time: string; end_time: string }

export interface SpecialDay {
    id: string
    name: string
    target_date: string      // YYYY-MM-DD (inicio)
    end_date: string         // YYYY-MM-DD (fin, igual al inicio si es un solo día)
    mode: SpecialMode
    start_time?: string | null
    end_time?: string | null
    module_duration?: number | null
    breaks?: BreakDef[] | null
    blocked_ranges?: TimeRange[] | null
    note?: string | null
}

export interface StandardDay { start_time: string; end_time: string; module_duration: number; breaks?: BreakDef[] | null }

export const MODE_LABEL: Record<SpecialMode, string> = {
    SHORTENED: 'Clases más cortas',
    BLOCKED: 'Se suspenden algunas horas',
    NO_CLASSES: 'Sin clases',
}

export const toMin = (t?: string | null) => {
    if (!t) return 0
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}
export const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Módulos (clases) de un día: desde la entrada, de `duration` minutos, saltando recesos, sin pasar la salida. */
export function buildSlots(start: string, end: string, duration: number, breaks: BreakDef[] = []): TimeRange[] {
    const slots: TimeRange[] = []
    if (!duration || duration <= 0) return slots
    const bs = [...(breaks || [])].map(b => ({ s: toMin(b.start_time), e: toMin(b.end_time) })).filter(b => b.e > b.s).sort((a, b) => a.s - b.s)
    let t = toMin(start)
    const stop = toMin(end)
    let guard = 0
    while (t + duration <= stop && guard++ < 50) {
        const clash = bs.find(b => t < b.e && t + duration > b.s)
        if (clash) { t = Math.max(t, clash.e); continue }
        slots.push({ start: toHHMM(t), end: toHHMM(t + duration) })
        t += duration
    }
    return slots
}

/** Cuántos minutos por clase caben para dar el mismo número de clases en el horario especial. */
export function proposeDuration(standard: StandardDay, start: string, end: string, breaks: BreakDef[] = []): number | null {
    const n = buildSlots(standard.start_time, standard.end_time, standard.module_duration, standard.breaks || []).length
    if (!n) return null
    // La duración más larga con la que siguen cabiendo todas las clases (los recesos pueden dejar huecos)
    for (let d = Math.min(standard.module_duration, 120); d >= 10; d--) {
        if (buildSlots(start, end, d, breaks).length >= n) return d
    }
    return null
}

export type AdjustedStatus = 'normal' | 'shortened' | 'cancelled'
export type Adjusted<T> = T & { status: AdjustedStatus; original_start: string; original_end: string; reason?: string }

/**
 * Ajusta las clases de un día según el día especial.
 * - SHORTENED: la 1ª clase del día pasa al 1er módulo corto, la 2ª al 2º… Las que no caben se suspenden.
 * - BLOCKED: las clases dentro de las horas bloqueadas se suspenden; si solo se enciman en parte, se recortan
 *   (y si quedan menos de 15 min, también se suspenden).
 * - NO_CLASSES: todas se suspenden.
 */
export function adjustClasses<T extends { start_time: string; end_time: string }>(classes: T[], special: SpecialDay | null | undefined, standard?: StandardDay | null): Adjusted<T>[] {
    const base = classes.map(c => ({ ...c, start_time: c.start_time.slice(0, 5), end_time: c.end_time.slice(0, 5), status: 'normal' as AdjustedStatus, original_start: c.start_time.slice(0, 5), original_end: c.end_time.slice(0, 5) }))
    if (!special) return base
    if (special.mode === 'NO_CLASSES') return base.map(c => ({ ...c, status: 'cancelled', reason: special.name }))
    if (special.mode === 'BLOCKED') {
        const ranges = (special.blocked_ranges || []).map(r => ({ s: toMin(r.start), e: toMin(r.end), label: r.label }))
        return base.map(c => {
            let s = toMin(c.start_time), e = toMin(c.end_time)
            let hit: typeof ranges[number] | undefined
            for (const r of ranges) {
                if (s < r.e && e > r.s) {
                    hit = r
                    if (r.s <= s && r.e >= e) { s = e; break }          // la cubre toda
                    if (r.s <= s) s = r.e                               // se come el inicio
                    else if (r.e >= e) e = r.s                          // se come el final
                    else e = r.s                                        // en medio: queda la primera parte
                }
            }
            if (!hit) return c
            // Si quedan menos de 15 minutos, no vale la pena: se suspende
            if (e - s < 15) return { ...c, status: 'cancelled', reason: hit.label || special.name }
            return { ...c, start_time: toHHMM(s), end_time: toHHMM(e), status: 'shortened', reason: hit.label || special.name }
        })
    }
    // SHORTENED
    const newSlots = buildSlots(special.start_time || '07:00', special.end_time || '12:00', special.module_duration || 0, special.breaks || [])
    const stdSlots = standard ? buildSlots(standard.start_time, standard.end_time, standard.module_duration, standard.breaks || []) : []
    const distinctStarts = [...new Set(base.map(c => c.start_time))].sort()
    const indexOf = (start: string) => {
        if (stdSlots.length) {
            let best = 0, bestDiff = Infinity
            stdSlots.forEach((s, i) => { const d = Math.abs(toMin(s.start) - toMin(start)); if (d < bestDiff) { bestDiff = d; best = i } })
            if (bestDiff <= 15) return best
        }
        return distinctStarts.indexOf(start)
    }
    return base.map(c => {
        const i = indexOf(c.start_time)
        const slot = i >= 0 ? newSlots[i] : undefined
        if (!slot) return { ...c, status: 'cancelled', reason: `${special.name}: no alcanza el tiempo` }
        return { ...c, start_time: slot.start, end_time: slot.end, status: 'shortened' }
    })
}

/** Texto corto para avisos: "Festival · clases de 35 min, salida 12:00". */
export function describeSpecialDay(s: SpecialDay): string {
    if (s.mode === 'NO_CLASSES') return `${s.name} · sin clases`
    if (s.mode === 'BLOCKED') return `${s.name} · se suspenden ${(s.blocked_ranges || []).map(r => `${r.start}–${r.end}`).join(', ')}`
    return `${s.name} · clases de ${s.module_duration} min, de ${s.start_time?.slice(0, 5)} a ${s.end_time?.slice(0, 5)}`
}

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Días especiales que tocan un rango de fechas (inclusive). */
export async function fetchSpecialDays(tenantId: string, from: string, to: string = from): Promise<SpecialDay[]> {
    const { data, error } = await supabase
        .from('special_schedule_structure')
        .select('*')
        .eq('tenant_id', tenantId)
        .lte('target_date', to)
        .gte('end_date', from)
        .order('target_date')
    if (error) { console.warn('[specialDays]', error.message); return [] }
    return (data || []).map((r: any) => ({ ...r, start_time: r.start_time?.slice(0, 5) ?? null, end_time: r.end_time?.slice(0, 5) ?? null })) as SpecialDay[]
}

export const specialFor = (list: SpecialDay[], date: string) => list.filter(s => s.target_date <= date && s.end_date >= date).pop() ?? null

/** Día especial (si hay) y horario normal de la escuela para una fecha. */
export async function loadDayContext(tenantId: string, date: string): Promise<{ special: SpecialDay | null; standard: StandardDay | null }> {
    const [list, { data: std }] = await Promise.all([
        fetchSpecialDays(tenantId, date),
        supabase.from('schedule_settings').select('start_time, end_time, module_duration, breaks').eq('tenant_id', tenantId).maybeSingle(),
    ])
    const standard = std ? { start_time: std.start_time.slice(0, 5), end_time: std.end_time.slice(0, 5), module_duration: std.module_duration, breaks: (std.breaks as any) || [] } : null
    return { special: specialFor(list, date), standard }
}
