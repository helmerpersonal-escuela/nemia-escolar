/** Teléfonos de México: 10 dígitos. Acepta espacios, guiones, paréntesis y +52. */
export function normalizePhone(raw: string | null | undefined): string {
    let d = String(raw ?? '').replace(/\D/g, '')
    if (d.length === 12 && d.startsWith('52')) d = d.slice(2)
    if (d.length === 13 && d.startsWith('521')) d = d.slice(3)
    return d
}

export const isValidPhone = (raw: string | null | undefined) => normalizePhone(raw).length === 10

/** 9611234567 → 961 123 4567 */
export function formatPhone(raw: string | null | undefined): string {
    const d = normalizePhone(raw)
    return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : String(raw ?? '')
}

/** Mensaje de error o null. El principal es obligatorio; los de respaldo, si se escriben, deben estar completos. */
export function phonesProblem(main: string, alt1?: string, alt2?: string): string | null {
    if (!isValidPhone(main)) return 'El teléfono principal debe tener 10 dígitos.'
    for (const alt of [alt1, alt2]) {
        if (alt && alt.trim() && !isValidPhone(alt)) return 'Los teléfonos de respaldo deben tener 10 dígitos (o déjalos vacíos).'
    }
    return null
}
