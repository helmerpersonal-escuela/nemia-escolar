/** Agrupa elementos por materia para mostrar listas cortas (una fila por materia) en el inicio del tutor. */
export type SubjectGroup<T> = { subject: string; items: T[] }

export function subjectOf(title: string | null | undefined, subjectName: string | null | undefined): string {
    if (subjectName?.trim()) return subjectName.trim()
    // Títulos como "Tarea 2: Mapa conceptual · Geografía": la materia va al final
    const parts = String(title ?? '').split(' · ')
    return parts.length > 1 ? parts[parts.length - 1].trim() : 'Otras'
}

/** Quita " · Materia" del final del título, porque la materia ya se muestra en el grupo. */
export function shortTitle(title: string | null | undefined, subject: string): string {
    const t = String(title ?? '').trim()
    const suffix = ` · ${subject}`
    return t.toLowerCase().endsWith(suffix.toLowerCase()) ? t.slice(0, -suffix.length) : t
}

export function groupBySubject<T>(items: T[], subjectFor: (item: T) => string): SubjectGroup<T>[] {
    const map = new Map<string, T[]>()
    for (const it of items) {
        const s = subjectFor(it)
        map.set(s, [...(map.get(s) ?? []), it])
    }
    return [...map.entries()].map(([subject, items]) => ({ subject, items }))
}

export const shortDate = (d: string | null | undefined) =>
    d ? new Date(d.length <= 10 ? `${d}T12:00:00` : d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : ''
