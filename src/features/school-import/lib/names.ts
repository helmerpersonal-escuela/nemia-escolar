/**
 * Nombres de personas como vienen en los archivos de la escuela.
 * - Listas de alumnos: "PATERNO MATERNO NOMBRES" (ALEGRE CORTEZ ARIANA DENNISE)
 * - Personal y tutores: "NOMBRES PATERNO MATERNO" (ENEDINA ALEGRE CORTEZ)
 */

const ABBREVIATIONS: Record<string, string> = { HDEZ: 'HERNANDEZ', HDZ: 'HERNANDEZ', HERNANDES: 'HERNANDEZ', GPE: 'GUADALUPE', GUADALUPE: 'GUADALUPE', MA: 'MARIA', FCO: 'FRANCISCO', JOSE: 'JOSE', GLEZ: 'GONZALEZ', GZZ: 'GONZALEZ', MTZ: 'MARTINEZ', RDZ: 'RODRIGUEZ', RGZ: 'RODRIGUEZ', SCHZ: 'SANCHEZ', JMZ: 'JIMENEZ' }
/** Como normName, pero expande abreviaturas comunes (HDEZ → HERNANDEZ, GPE → GUADALUPE) para comparar. */
export const compareName = (s: unknown) => normName(s).split(' ').map(t => ABBREVIATIONS[t] ?? t).join(' ')

/** Mayúsculas, sin acentos ni signos, espacios simples. "Ñ" → "N". */
export function normName(s: unknown): string {
    return String(s ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/** Limpia el texto visible conservando acentos y Ñ: quita *, /, números y espacios de más. */
export function cleanName(s: unknown): string {
    return String(s ?? '')
        .replace(/[*/\\|_0-9.,;:()"'`´-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
}

const PARTICLES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'MC', 'VAN', 'VON', 'SAN', 'SANTA'])
const isParticle = (t: string) => PARTICLES.has(normName(t))

export type SplitName = { first_name: string; last_name_paternal: string; last_name_maternal: string }

/** Toma un apellido desde el inicio (con sus partículas: "DE LA CRUZ"). */
function takeSurnameFromStart(tokens: string[]): string {
    const out: string[] = []
    while (tokens.length && isParticle(tokens[0])) out.push(tokens.shift()!)
    if (tokens.length) out.push(tokens.shift()!)
    return out.join(' ')
}

/** Toma un apellido desde el final (con sus partículas: "DE LA CRUZ"). */
function takeSurnameFromEnd(tokens: string[]): string {
    const out: string[] = []
    if (tokens.length) out.unshift(tokens.pop()!)
    while (tokens.length && isParticle(tokens[tokens.length - 1])) out.unshift(tokens.pop()!)
    return out.join(' ')
}

/** "PATERNO MATERNO NOMBRES" → partes. */
export function splitSurnamesFirst(full: string): SplitName {
    const tokens = cleanName(full).split(' ').filter(Boolean)
    if (tokens.length <= 1) return { first_name: tokens[0] ?? '', last_name_paternal: '', last_name_maternal: '' }
    if (tokens.length === 2) return { last_name_paternal: tokens[0], first_name: tokens[1], last_name_maternal: '' }
    const paternal = takeSurnameFromStart(tokens)
    const maternal = tokens.length > 1 ? takeSurnameFromStart(tokens) : ''
    return { last_name_paternal: paternal, last_name_maternal: maternal, first_name: tokens.join(' ') }
}

/** "NOMBRES PATERNO MATERNO" → partes. */
export function splitGivenFirst(full: string): SplitName {
    const tokens = cleanName(full).split(' ').filter(Boolean)
    if (tokens.length <= 1) return { first_name: tokens[0] ?? '', last_name_paternal: '', last_name_maternal: '' }
    if (tokens.length === 2) return { first_name: tokens[0], last_name_paternal: tokens[1], last_name_maternal: '' }
    const maternal = takeSurnameFromEnd(tokens)
    const paternal = tokens.length > 1 ? takeSurnameFromEnd(tokens) : ''
    return { first_name: tokens.join(' '), last_name_paternal: paternal, last_name_maternal: maternal }
}

/** Nombre completo en el orden de las listas: "PATERNO MATERNO NOMBRES". */
export const surnamesFirst = (n: SplitName) => [n.last_name_paternal, n.last_name_maternal, n.first_name].filter(Boolean).join(' ')

function levenshtein(a: string, b: string): number {
    if (a === b) return 0
    if (!a.length) return b.length
    if (!b.length) return a.length
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const cur = [i]
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
        }
        prev = cur
    }
    return prev[b.length]
}

/**
 * Qué tanto se parecen dos nombres (0 a 1). Tolera errores de dedo ("ZUNUN"/"ZUNUM"),
 * nombres recortados ("DENN" / "DENNISE") y el orden distinto de palabras.
 */
export function nameSimilarity(a: string, b: string): number {
    const x = compareName(a), y = compareName(b)
    if (!x || !y) return 0
    if (x === y) return 1
    const lev = 1 - levenshtein(x, y) / Math.max(x.length, y.length)
    // Palabras en común (una palabra cuenta si es igual o una empieza con la otra, mín. 3 letras)
    const ta = x.split(' '), tb = y.split(' ')
    const same = (p: string, q: string) => p === q || (p.length >= 3 && q.length >= 3 && (p.startsWith(q) || q.startsWith(p))) || (p.length >= 4 && q.length >= 4 && levenshtein(p, q) <= 1)
    const used = new Set<number>()
    let hits = 0
    for (const p of ta) {
        const j = tb.findIndex((q, k) => !used.has(k) && same(p, q))
        if (j >= 0) { used.add(j); hits++ }
    }
    const tokens = hits / Math.max(ta.length, tb.length)
    const tokensShort = hits / Math.min(ta.length, tb.length)
    return Math.min(0.99, Math.max(lev, tokens, tokensShort * 0.92))
}

export type Match<T> = { item: T; score: number } | null

/** El candidato más parecido, si pasa el umbral y no hay empate con otro. */
export function bestMatch<T>(name: string, candidates: T[], getName: (c: T) => string, threshold = 0.85): Match<T> {
    let best: Match<T> = null
    let second = 0
    for (const c of candidates) {
        const s = nameSimilarity(name, getName(c))
        if (!best || s > best.score) { second = best?.score ?? 0; best = { item: c, score: s } }
        else if (s > second) second = s
    }
    if (!best || best.score < threshold) return null
    if (best.score < 1 && second >= best.score - 0.05) return null // casi empate (p. ej., gemelos): mejor no adivinar
    return best
}
