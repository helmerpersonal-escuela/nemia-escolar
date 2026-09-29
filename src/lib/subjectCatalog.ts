import { niceSubjectCase } from './subjectName'

export type CatalogSubject = {
    id: string
    name: string
    field_of_study: string
    requires_specification: boolean
}

/** Una materia como la ve el docente: un solo botón aunque en el catálogo haya duplicados. */
export type SubjectOption = {
    key: string
    name: string
    field: string
    /** Todos los ids del catálogo con ese nombre (mayúsculas/acentos distintos). */
    ids: string[]
    /** Id que se guarda al elegirla. */
    id: string
    requiresSpecification: boolean
    isTechnology: boolean
    isOther: boolean
}

/** Sin acentos, minúsculas y espacios simples: "INGLES" = "Inglés". */
export const normalizeText = (s: string) =>
    String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const isOtherName = (name: string) => /^otra materia/.test(normalizeText(name))

/**
 * Junta duplicados del catálogo, ordena alfabéticamente y deja "Otra materia" aparte.
 * Prefiere el registro en MAYÚSCULAS como id (es el que ya usan los datos), pero muestra el
 * nombre con mayúsculas y minúsculas.
 */
export function buildSubjectOptions(catalog: CatalogSubject[]): { options: SubjectOption[]; other: SubjectOption | null } {
    const byKey = new Map<string, SubjectOption>()
    for (const s of catalog) {
        const key = normalizeText(s.name)
        if (!key) continue
        const existing = byKey.get(key)
        const nice = s.name === s.name.toUpperCase() ? niceSubjectCase(s.name) : s.name
        if (!existing) {
            byKey.set(key, {
                key,
                name: nice,
                field: s.field_of_study,
                ids: [s.id],
                id: s.id,
                requiresSpecification: !!s.requires_specification,
                isTechnology: /tecnolog/.test(key),
                isOther: isOtherName(s.name),
            })
            continue
        }
        existing.ids.push(s.id)
        existing.requiresSpecification = existing.requiresSpecification || !!s.requires_specification
        // Nombre bonito: el que no está todo en mayúsculas
        if (s.name !== s.name.toUpperCase()) existing.name = s.name
        // Id preferido: el registro en MAYÚSCULAS
        if (s.name === s.name.toUpperCase()) existing.id = s.id
    }
    const all = Array.from(byKey.values())
    const other = all.find(o => o.isOther) ?? null
    const options = all
        .filter(o => !o.isOther)
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    return { options, other }
}

export function matchesSearch(option: SubjectOption, query: string): boolean {
    const q = normalizeText(query)
    if (!q) return true
    return normalizeText(option.name).includes(q) || normalizeText(option.field).includes(q)
}

/** Nombre corto del campo formativo para la etiqueta del botón. */
export function shortField(field: string): string {
    const f = normalizeText(field)
    if (f.startsWith('lenguajes')) return 'Lenguajes'
    if (f.startsWith('saberes')) return 'Saberes y P. Científico'
    if (f.startsWith('etica')) return 'Ética, Nat. y Soc.'
    if (f.startsWith('de lo humano')) return 'Humano y Comunitario'
    if (f.startsWith('autonomia')) return 'Autonomía curricular'
    return field
}
