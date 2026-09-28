// Nombre de materia para mostrar: "Tecnología - Informática" (materia del catálogo + especialidad/énfasis).

const SMALL = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'lo', 'y', 'e', 'en', 'a', 'o', 'u'])

/** "TECNOLOGÍA" → "Tecnología"; "LENGUA MATERNA. ESPAÑOL" → "Lengua Materna. Español". Respeta siglas cortas. */
export function niceSubjectCase(name: string): string {
    const s = String(name ?? '').trim()
    if (!s) return ''
    const isUpper = s === s.toUpperCase()
    if (!isUpper) return s
    return s.toLowerCase().split(/(\s+)/).map((w, i) => {
        if (/^\s+$/.test(w)) return w
        if (i > 0 && SMALL.has(w)) return w
        return w.charAt(0).toUpperCase() + w.slice(1)
    }).join('')
}

/** Une materia y especialidad sin repetir: ("TECNOLOGÍA", "informática") → "Tecnología - Informática". */
export function formatSubjectName(catalogName?: string | null, detail?: string | null): string {
    const base = niceSubjectCase(catalogName || '')
    const d = niceSubjectCase(String(detail ?? '').trim())
    if (!d) return base || 'Materia personalizada'
    if (!base) return d
    const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (norm(d).includes(norm(base))) return d
    return `${base} - ${d.charAt(0).toUpperCase()}${d.slice(1)}`
}

/** Especialidades (énfasis) de Tecnología más comunes en secundarias técnicas y generales. */
export const TECH_SPECIALTIES = [
    'Informática', 'Ofimática', 'Diseño gráfico', 'Diseño arquitectónico', 'Dibujo técnico', 'Diseño industrial',
    'Electricidad', 'Electrónica', 'Mecánica automotriz', 'Estructuras metálicas', 'Carpintería', 'Construcción',
    'Confección del vestido e industria textil', 'Preparación, conservación e industrialización de alimentos',
    'Agricultura', 'Pecuaria', 'Apicultura', 'Acuacultura', 'Pesca', 'Silvicultura',
    'Contabilidad', 'Administración', 'Secretariado', 'Turismo', 'Artesanías',
]
