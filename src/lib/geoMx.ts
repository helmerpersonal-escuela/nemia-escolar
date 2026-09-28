/**
 * Catálogo geográfico de México (SEPOMEX, claves INEGI): estados, municipios y colonias.
 * Los datos viven en /public/geo como archivos estáticos (uno por estado) y se cargan
 * bajo demanda; así funcionan igual en la web y en la app Android sin consultas a la BD.
 */

export interface GeoState { cve: string; name: string }
export interface GeoMunicipality { cve: string; name: string }
export interface GeoSettlement { name: string; cp: string; type: string }

interface StatesFile { tipos: string[]; estados: [string, string][] }
interface StateFile { m: [string, string][]; c: Record<string, [string, string, number][]> }

let statesPromise: Promise<StatesFile> | null = null
const stateCache = new Map<string, Promise<StateFile>>()

/** Sube este número cada vez que se regenere public/geo, para no servir copias viejas del caché. */
const GEO_VERSION = 2

const base = () => (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')

async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${base()}geo/${path}?v=${GEO_VERSION}`)
    if (!res.ok) throw new Error(`No se pudo cargar el catálogo (${path})`)
    return res.json() as Promise<T>
}

function statesFile() {
    statesPromise ??= getJson<StatesFile>('estados.json').catch(e => { statesPromise = null; throw e })
    return statesPromise
}
function stateFile(cve: string) {
    if (!stateCache.has(cve)) stateCache.set(cve, getJson<StateFile>(`${cve}.json`).catch(e => { stateCache.delete(cve); throw e }))
    return stateCache.get(cve)!
}

export async function loadStates(): Promise<GeoState[]> {
    const f = await statesFile()
    return f.estados.map(([cve, name]) => ({ cve, name }))
}

export async function loadMunicipalities(stateCve: string): Promise<GeoMunicipality[]> {
    const f = await stateFile(stateCve)
    return f.m.filter(([, name]) => name && name !== 'NULL').map(([cve, name]) => ({ cve, name }))
}

export async function loadSettlements(stateCve: string, munCve: string): Promise<GeoSettlement[]> {
    const [types, f] = await Promise.all([statesFile(), stateFile(stateCve)])
    return (f.c[munCve] ?? []).map(([name, cp, t]) => ({ name, cp, type: types.tipos[t] ?? '' }))
}

export const normalizeGeo = (s: string) =>
    String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Filtra colonias por texto (sin acentos) o por código postal. */
export function filterSettlements(list: GeoSettlement[], query: string, limit = 8): GeoSettlement[] {
    const q = normalizeGeo(query)
    if (!q) return list.slice(0, limit)
    const isCp = /^\d{2,5}$/.test(q)
    const starts: GeoSettlement[] = [], contains: GeoSettlement[] = []
    for (const s of list) {
        if (isCp) { if (s.cp.startsWith(q)) starts.push(s); continue }
        const n = normalizeGeo(s.name)
        if (n.startsWith(q)) starts.push(s)
        else if (n.includes(q)) contains.push(s)
        if (starts.length >= limit) break
    }
    return [...starts, ...contains].slice(0, limit)
}

/** Ubica en el mapa lo capturado (colonia → municipio → estado) con OpenStreetMap Nominatim. */
export async function geocodeMx(parts: { settlement?: string; municipality?: string; state?: string; cp?: string }): Promise<{ lat: number; lng: number; zoom: number } | null> {
    const tries: { q: string; zoom: number }[] = []
    if (parts.settlement && parts.municipality) tries.push({ q: `${parts.settlement}, ${parts.municipality}, ${parts.state ?? ''}, México`, zoom: 16 })
    if (parts.cp) tries.push({ q: `${parts.cp}, ${parts.municipality ?? ''}, ${parts.state ?? ''}, México`, zoom: 15 })
    if (parts.municipality) tries.push({ q: `${parts.municipality}, ${parts.state ?? ''}, México`, zoom: 12 })
    if (parts.state) tries.push({ q: `${parts.state}, México`, zoom: 7 })
    for (const t of tries) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&accept-language=es&q=${encodeURIComponent(t.q)}`
            const res = await fetch(url, { headers: { Accept: 'application/json' } })
            if (!res.ok) continue
            const [hit] = await res.json()
            if (hit) return { lat: Number(hit.lat), lng: Number(hit.lon), zoom: t.zoom }
        } catch { /* sin conexión: se intenta el siguiente nivel */ }
    }
    return null
}
