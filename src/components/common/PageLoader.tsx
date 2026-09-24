import { Loader2 } from 'lucide-react'

/** Indicador mientras se descarga el código de una pantalla (carga diferida). */
export function PageLoader() {
    return (
        <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="sr-only">Cargando…</span>
        </div>
    )
}
