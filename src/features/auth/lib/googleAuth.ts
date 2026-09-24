import { Capacitor } from '@capacitor/core'
import { supabase } from '../../../lib/supabase'

/**
 * Inicio de sesión / registro con Google.
 *
 * Web: Supabase redirige a Google y regresa a /complete-signup.
 * Android/iOS: se abre el navegador del sistema y Google regresa a la app con
 * el enlace profundo vunlek://auth/callback (ver handleAuthDeepLink).
 *
 * Si la persona eligió antes "Docente" o "Escuela" (o trae invitación), esa
 * intención se guarda aquí para completar el registro al volver.
 */

const PENDING_KEY = 'vunlek_pending_signup'
export const NATIVE_REDIRECT = 'vunlek://auth/callback'

export interface SignupIntent {
    mode?: 'INDEPENDENT' | 'SCHOOL' | 'JOIN'
    organizationName?: string
    invitationToken?: string | null
}

export function savePendingSignup(intent: SignupIntent) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...intent, at: Date.now() })) } catch { /* sin almacenamiento */ }
}

export function readPendingSignup(): SignupIntent | null {
    try {
        const raw = localStorage.getItem(PENDING_KEY)
        if (!raw) return null
        const data = JSON.parse(raw)
        // La intención vale 1 hora.
        if (!data?.at || Date.now() - data.at > 60 * 60 * 1000) return null
        return data
    } catch {
        return null
    }
}

export function clearPendingSignup() {
    try { localStorage.removeItem(PENDING_KEY) } catch { /* nada */ }
}

export async function signInWithGoogle(intent?: SignupIntent) {
    if (intent) savePendingSignup(intent)
    const native = Capacitor.isNativePlatform()
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: native ? NATIVE_REDIRECT : `${window.location.origin}/complete-signup`,
            skipBrowserRedirect: native,
            queryParams: { prompt: 'select_account' },
        },
    })
    if (error) throw error
    if (native && data?.url) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url: data.url })
    }
}

/**
 * Procesa vunlek://auth/callback?code=… (PKCE) o #access_token=… (implícito).
 * Devuelve true si el enlace era de autenticación.
 */
export async function handleAuthDeepLink(url: string): Promise<boolean> {
    let parsed: URL
    try { parsed = new URL(url) } catch { return false }
    if (parsed.host !== 'auth') return false

    const code = parsed.searchParams.get('code')
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
    const errorDescription = parsed.searchParams.get('error_description') || hash.get('error_description')

    try {
        if (errorDescription) throw new Error(errorDescription)
        if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) throw error
        } else if (hash.get('access_token') && hash.get('refresh_token')) {
            const { error } = await supabase.auth.setSession({
                access_token: hash.get('access_token')!,
                refresh_token: hash.get('refresh_token')!,
            })
            if (error) throw error
        }
    } finally {
        try {
            const { Browser } = await import('@capacitor/browser')
            await Browser.close()
        } catch { /* el navegador ya estaba cerrado */ }
    }
    return true
}
