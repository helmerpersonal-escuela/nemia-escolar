import { supabase } from '../../../lib/supabase'

/** Deja el código como lo imprime la escuela: 4 + guion + 4, en mayúsculas. */
export function normalizeFamilyCode(raw: string): string {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean
}

export function isCompleteFamilyCode(code: string): boolean {
    return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizeFamilyCode(code))
}

export interface RedeemResult {
    ok: boolean
    student?: string
    school?: string
    already?: boolean
    error?: string
}

/** Liga la cuenta actual con el alumno del código. */
export async function redeemFamilyCode(code: string, names?: { firstName?: string; lastNamePaternal?: string; lastNameMaternal?: string }): Promise<RedeemResult> {
    const { data, error } = await supabase.rpc('redeem_family_code', {
        p_code: normalizeFamilyCode(code),
        p_first_name: names?.firstName || null,
        p_last_name_paternal: names?.lastNamePaternal || null,
        p_last_name_maternal: names?.lastNameMaternal || null,
    })
    if (error) return { ok: false, error: error.message }
    const res = (data ?? {}) as { error?: string; student?: string; school?: string; already?: boolean }
    if (res.error) return { ok: false, error: res.error }
    return { ok: true, student: res.student, school: res.school, already: res.already }
}

/** Enlace que va impreso en la hoja: abre la página con el código ya escrito. */
export function familyAccessUrl(code?: string): string {
    // En la app de Android el origen es localhost: lo impreso siempre apunta al sitio público.
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const base = /(^|\.)vunlek\.com$/.test(host) ? window.location.origin : 'https://www.vunlek.com'
    return code ? `${base}/familia?codigo=${encodeURIComponent(code)}` : `${base}/familia`
}
