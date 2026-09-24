import { CloudOff } from 'lucide-react'

/** Aviso cuando la pantalla muestra la copia guardada en el dispositivo (sin señal). */
export function OfflineDataBanner({ fromCache, savedAt, hasData = true }: { fromCache: boolean, savedAt?: number, hasData?: boolean }) {
    if (!fromCache) return null
    const when = savedAt
        ? new Date(savedAt).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : null
    return (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
                {hasData ? (
                    <>
                        <p className="font-bold">Sin conexión: estás viendo los datos guardados en este dispositivo{when ? ` (${when})` : ''}.</p>
                        <p className="text-amber-700">Puedes pasar lista, calificar y registrar incidencias; se enviarán solos cuando vuelva la señal.</p>
                    </>
                ) : (
                    <>
                        <p className="font-bold">Sin conexión y este grupo no está guardado en el dispositivo.</p>
                        <p className="text-amber-700">Cuando tengas señal, usa “Preparar para usar sin conexión” en el indicador de conexión (arriba) para descargar tus grupos.</p>
                    </>
                )}
            </div>
        </div>
    )
}
