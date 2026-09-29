import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

/**
 * 404. Antes de darse por vencida revisa si hay una versión nueva de la app:
 * si el dispositivo tenía guardada una versión vieja, un enlace nuevo (p. ej. una invitación)
 * puede no existir en ella. En ese caso se actualiza sola y recarga.
 */
export const NotFoundPage = () => {
    const [checking, setChecking] = useState(true)
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        let done = false
        const finish = () => { if (!done) { done = true; setChecking(false) } }
        const timer = setTimeout(finish, 8000)
        ;(async () => {
            try {
                if (!('serviceWorker' in navigator) || !navigator.onLine) return finish()
                const reg = await navigator.serviceWorker.getRegistration()
                if (!reg) return finish()
                const markUpdating = () => { setUpdating(true); setTimeout(() => window.location.reload(), 6000) }
                if (reg.installing || reg.waiting) return markUpdating()
                reg.addEventListener('updatefound', markUpdating)
                await reg.update()
                if (reg.installing || reg.waiting) return markUpdating()
                // Sin versión nueva: es un 404 real
                setTimeout(finish, 1200)
            } catch { finish() }
        })()
        return () => clearTimeout(timer)
    }, [])

    if (checking || updating) {
        return (
            <main className="min-h-dvh flex items-center justify-center p-6 bg-slate-50">
                <p className="flex items-center gap-2 text-slate-600"><Loader2 className="w-5 h-5 animate-spin" /> {updating ? 'Actualizando la app a la versión más reciente…' : 'Cargando…'}</p>
            </main>
        )
    }

    return (
        <main className="min-h-dvh flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md text-center space-y-4">
                <p className="text-sm font-bold text-indigo-600">Error 404</p>
                <h1 className="text-3xl font-black text-slate-900">No encontramos esta página</h1>
                <p className="text-slate-600">Es posible que el enlace esté incompleto o que la página se haya movido.</p>
                <Link to="/" className="inline-flex items-center justify-center min-h-11 px-6 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                    Volver al inicio
                </Link>
            </div>
        </main>
    )
}
