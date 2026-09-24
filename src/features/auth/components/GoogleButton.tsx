import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { signInWithGoogle, type SignupIntent } from '../lib/googleAuth'

interface Props {
    label?: string
    intent?: SignupIntent
    disabled?: boolean
    /** Validación previa (p. ej. nombre de la escuela); devolver un mensaje la detiene. */
    beforeStart?: () => string | null
}

const GoogleLogo = () => (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
)

export const GoogleButton = ({ label = 'Continuar con Google', intent, disabled, beforeStart }: Props) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const start = async () => {
        const problem = beforeStart?.()
        if (problem) { setError(problem); return }
        setError(null)
        setLoading(true)
        try {
            await signInWithGoogle(intent)
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            setError(/provider is not enabled|Unsupported provider/i.test(msg)
                ? 'El acceso con Google aún no está activado en el servidor.'
                : 'No se pudo abrir Google. Intenta de nuevo.')
            setLoading(false)
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={start}
                disabled={disabled || loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all disabled:opacity-50"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleLogo />}
                {label}
            </button>
            {error && <p className="text-xs text-rose-600 font-medium mt-2 text-center">{error}</p>}
        </div>
    )
}
