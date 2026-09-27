import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { todayISO } from './dates'

/**
 * Calendario escolar oficial de la SEP (tabla `official_school_calendars`).
 * Con conexión se consulta el ciclo vigente o el próximo; sin conexión se usa la
 * última copia guardada y, si no hay, las fechas estimadas de siempre.
 */
export interface OfficialCycle {
    schoolYear: string
    name: string
    startDate: string
    endDate: string
    schoolDays: number | null
    sourceUrl: string | null
}

/** `after`: fecha de fin del ciclo actual, para obtener el ciclo SIGUIENTE. */
export async function fetchOfficialCycle(level: 'BASICA' | 'NORMAL' = 'BASICA', today = todayISO(), after?: string): Promise<OfficialCycle | null> {
    let query = supabase
        .from('official_school_calendars')
        .select('school_year, name, start_date, end_date, school_days, source_url')
        .eq('level', level)
    query = after ? query.gt('start_date', after) : query.gte('end_date', today)
    const { data, error } = await query
        .order('start_date', { ascending: true })
        .limit(1)
    if (error) throw error
    const row = data?.[0]
    if (!row) return null
    return {
        schoolYear: row.school_year,
        name: row.name,
        startDate: row.start_date,
        endDate: row.end_date,
        schoolDays: row.school_days,
        sourceUrl: row.source_url,
    }
}

export function useOfficialCycle(level: 'BASICA' | 'NORMAL' = 'BASICA') {
    return useQuery({
        queryKey: ['official-cycle', level, todayISO().slice(0, 7)],
        queryFn: () => fetchOfficialCycle(level),
        staleTime: 1000 * 60 * 60 * 12,
        retry: 1,
    })
}

/** "CICLO 2026-2027" a partir de las fechas, para cuando no hay calendario oficial. */
export function cycleNameFromDates(start?: string, end?: string) {
    const a = start?.slice(0, 4)
    const b = end?.slice(0, 4)
    return a && b ? `CICLO ${a}-${b}` : ''
}
