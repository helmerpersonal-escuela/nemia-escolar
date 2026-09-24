import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CloudDownload, CloudOff, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import { discardFailed, failedItems, retryFailed, type OutboxItem } from '../../lib/offline/outbox'
import { prepareOffline } from '../../lib/offline/gradebookData'
import { useTenant } from '../../hooks/useTenant'

const fmt = (t: number | null) => (t ? new Date(t).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null)
const PREPARED_KEY = 'vunlek_offline_prepared_at'

/**
 * Indicador de conexión en el encabezado + panel con:
 *  - cambios pendientes de enviar y los que fallaron,
 *  - botón "Preparar para usar sin conexión" (descarga todos los grupos).
 */
export function OfflineCenter() {
    const { isOnline, pendingCount, failedCount, isSyncing, lastSyncAt, syncQueue } = useOfflineSync()
    const { data: tenant } = useTenant()
    const [open, setOpen] = useState(false)
    const [failed, setFailed] = useState<OutboxItem[]>([])
    const [preparing, setPreparing] = useState<{ done: number, total: number } | null>(null)
    const [prepError, setPrepError] = useState<string | null>(null)
    const [preparedAt, setPreparedAt] = useState<number | null>(() => {
        try { return Number(localStorage.getItem(PREPARED_KEY)) || null } catch { return null }
    })
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (open) void failedItems().then(setFailed)
    }, [open, failedCount])

    useEffect(() => {
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [])

    const prepare = async () => {
        if (!tenant?.id) return
        setPrepError(null)
        setPreparing({ done: 0, total: 0 })
        try {
            await prepareOffline(tenant.id, (done, total) => setPreparing({ done, total }))
            const now = Date.now()
            setPreparedAt(now)
            try { localStorage.setItem(PREPARED_KEY, String(now)) } catch { /* sin acceso */ }
        } catch (e) {
            setPrepError(e instanceof Error ? e.message : 'No se pudo completar la descarga')
        } finally {
            setPreparing(null)
        }
    }

    let chip
    if (!isOnline) {
        chip = { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <CloudOff className="h-3.5 w-3.5" />, text: pendingCount ? `Sin conexión · ${pendingCount} por enviar` : 'Sin conexión' }
    } else if (isSyncing) {
        chip = { cls: 'bg-blue-50 text-blue-600 border-blue-100', icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />, text: 'Sincronizando' }
    } else if (failedCount) {
        chip = { cls: 'bg-red-50 text-red-600 border-red-200', icon: <AlertTriangle className="h-3.5 w-3.5" />, text: `${failedCount} sin enviar` }
    } else if (pendingCount) {
        chip = { cls: 'bg-blue-50 text-blue-600 border-blue-100', icon: <RefreshCw className="h-3.5 w-3.5" />, text: `${pendingCount} por enviar` }
    } else {
        chip = { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <span className="h-2 w-2 rounded-full bg-emerald-500" />, text: 'En línea' }
    }

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 sm:px-3 min-h-9 shadow-sm ${chip.cls}`}
                aria-expanded={open}
                aria-label="Estado de conexión y datos sin conexión"
            >
                {chip.icon}
                {/* En celular, "En línea" se muestra solo como punto verde para dejar espacio al título. */}
                <span className={`text-[11px] font-black uppercase tracking-widest ${isOnline && !pendingCount && !failedCount ? 'hidden sm:inline' : 'max-w-[9rem] truncate'}`}>{chip.text}</span>
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-100 bg-white p-4 text-sm shadow-2xl">
                    <p className="font-black text-slate-800">{isOnline ? 'Conectado' : 'Sin conexión'}</p>
                    <p className="mt-1 text-slate-500">
                        {pendingCount > 0
                            ? `${pendingCount} cambio(s) guardados en este dispositivo esperando señal.`
                            : 'No hay cambios pendientes de enviar.'}
                        {lastSyncAt ? ` Último envío: ${fmt(lastSyncAt)}.` : ''}
                    </p>
                    {isOnline && pendingCount > 0 && (
                        <button type="button" onClick={() => void syncQueue()} className="mt-2 text-xs font-bold text-indigo-600 hover:underline">
                            Enviar ahora
                        </button>
                    )}

                    {failed.length > 0 && (
                        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3">
                            <p className="font-bold text-red-700">No se pudieron enviar:</p>
                            <ul className="mt-1 space-y-1">
                                {failed.map(f => (
                                    <li key={f.id} className="flex items-start justify-between gap-2 text-xs text-red-700">
                                        <span>{f.label || f.table}: {f.lastError}</span>
                                        <button type="button" title="Descartar" onClick={() => void discardFailed(f.id).then(() => failedItems().then(setFailed))}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <button type="button" onClick={() => void retryFailed()} className="mt-2 text-xs font-bold text-red-700 hover:underline">
                                Reintentar
                            </button>
                        </div>
                    )}

                    <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="font-bold text-slate-700">Trabajar sin señal</p>
                        <p className="mt-1 text-xs text-slate-500">
                            Descarga tus grupos, alumnos y actividades para pasar lista, calificar y registrar incidencias sin internet.
                            {preparedAt ? ` Última descarga: ${fmt(preparedAt)}.` : ''}
                        </p>
                        <button
                            type="button"
                            disabled={!isOnline || !!preparing || !tenant?.id}
                            onClick={() => void prepare()}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
                        >
                            {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                            {preparing
                                ? (preparing.total ? `Descargando ${preparing.done}/${preparing.total}` : 'Preparando…')
                                : 'Preparar para usar sin conexión'}
                        </button>
                        {prepError && <p className="mt-2 text-xs text-red-600">{prepError}</p>}
                        {!preparing && preparedAt && !prepError && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Grupos listos para usar sin conexión</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
