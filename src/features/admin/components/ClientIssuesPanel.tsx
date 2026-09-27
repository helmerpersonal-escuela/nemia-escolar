import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Bug, CheckCircle2, ChevronDown, Eye, MousePointerClick, RefreshCw, Timer } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

/**
 * Problemas registrados automáticamente en la app (errores y fricciones),
 * agrupados para revisarlos y marcarlos como corregidos.
 */

interface Issue {
    fingerprint: string
    kind: string
    message: string
    total: number
    users: number
    schools: number
    first_seen: string
    last_seen: string
    sample_url: string | null
    roles: string | null
    platforms: string | null
    status: 'nuevo' | 'revisando' | 'corregido' | 'ignorar'
    notes: string | null
}

interface Occurrence {
    id: number
    created_at: string
    url: string | null
    role: string | null
    platform: string | null
    stack: string | null
    extra: Record<string, unknown> | null
}

const KIND_LABEL: Record<string, string> = {
    render: 'Pantalla falló',
    window: 'Error de código',
    promise: 'Error de código',
    api: 'Base de datos',
    query: 'Carga de datos',
    alert: 'Aviso al usuario',
    console: 'Error interno',
    ux: 'Mejora',
    manual: 'Manual',
}

const STATUS_STYLE: Record<Issue['status'], string> = {
    nuevo: 'bg-rose-50 text-rose-700 border-rose-100',
    revisando: 'bg-amber-50 text-amber-700 border-amber-100',
    corregido: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    ignorar: 'bg-slate-100 text-slate-500 border-slate-200',
}

const fmt = (d: string) => new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const ClientIssuesPanel = ({ search = '' }: { search?: string }) => {
    const qc = useQueryClient()
    const [days, setDays] = useState(30)
    const [filter, setFilter] = useState<'abiertos' | 'errores' | 'mejoras' | 'todos'>('abiertos')
    const [open, setOpen] = useState<string | null>(null)

    const { data: issues = [], isLoading, refetch, isFetching } = useQuery({
        queryKey: ['client-issues', days],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('client_issues', { p_days: days })
            if (error) throw error
            return (data ?? []) as Issue[]
        },
        staleTime: 60 * 1000,
    })

    const { data: occurrences = [] } = useQuery({
        queryKey: ['client-issue-occurrences', open],
        enabled: !!open,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('client_errors')
                .select('id, created_at, url, role, platform, stack, extra')
                .eq('fingerprint', open!)
                .order('created_at', { ascending: false })
                .limit(10)
            if (error) throw error
            return (data ?? []) as Occurrence[]
        },
    })

    const setStatus = async (fingerprint: string, status: Issue['status']) => {
        await supabase.from('client_issue_status').upsert({ fingerprint, status, updated_at: new Date().toISOString() })
        qc.invalidateQueries({ queryKey: ['client-issues'] })
    }

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase()
        return issues.filter(i => {
            if (filter === 'abiertos' && (i.status === 'corregido' || i.status === 'ignorar')) return false
            if (filter === 'errores' && i.kind === 'ux') return false
            if (filter === 'mejoras' && i.kind !== 'ux') return false
            if (term && !`${i.message} ${i.sample_url ?? ''}`.toLowerCase().includes(term)) return false
            return true
        })
    }, [issues, filter, search])

    const openCount = issues.filter(i => i.status === 'nuevo' || i.status === 'revisando').length
    const errorCount = issues.filter(i => i.kind !== 'ux' && i.status !== 'corregido' && i.status !== 'ignorar').length
    const uxCount = issues.filter(i => i.kind === 'ux' && i.status !== 'corregido' && i.status !== 'ignorar').length

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                    { label: 'Abiertos', value: openCount, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
                    { label: 'Errores', value: errorCount, icon: Bug, color: 'text-indigo-600 bg-indigo-50' },
                    { label: 'Mejoras', value: uxCount, icon: MousePointerClick, color: 'text-amber-700 bg-amber-50' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
                        <div className={`p-2 sm:p-3 rounded-xl w-fit ${s.color}`}><s.icon className="w-5 h-5" /></div>
                        <div>
                            <div className="text-xl sm:text-2xl font-black text-slate-900">{s.value}</div>
                            <div className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-wider">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-white p-1 rounded-xl border border-slate-100 max-w-full overflow-x-auto">
                    {(['abiertos', 'errores', 'mejoras', 'todos'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`shrink-0 px-3 sm:px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider ${filter === f ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {f}
                        </button>
                    ))}
                </div>
                <select aria-label="Periodo" value={days} onChange={e => setDays(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl border border-slate-100 bg-white text-xs font-bold text-slate-600">
                    <option value={1}>Hoy</option>
                    <option value={7}>7 días</option>
                    <option value={30}>30 días</option>
                    <option value={90}>90 días</option>
                </select>
                <button onClick={() => refetch()} aria-label="Actualizar" className="p-2 rounded-xl border border-slate-100 bg-white text-slate-500 hover:text-indigo-600">
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {isLoading ? (
                <div className="py-16 flex justify-center"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>
            ) : visible.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-10 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <p className="font-black text-slate-800">Sin problemas en este filtro</p>
                    <p className="text-sm text-slate-500 mt-1">Los errores y fricciones se registran solos mientras la escuela usa la app.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {visible.map(i => (
                        <div key={i.fingerprint} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <button onClick={() => setOpen(open === i.fingerprint ? null : i.fingerprint)} className="w-full text-left p-4 sm:p-5 flex gap-3 items-start">
                                <div className={`p-2 rounded-xl shrink-0 ${i.kind === 'ux' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'}`}>
                                    {i.kind === 'ux' ? (i.message.startsWith('Consulta lenta') ? <Timer className="w-4 h-4" /> : <MousePointerClick className="w-4 h-4" />) : <Bug className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{KIND_LABEL[i.kind] ?? i.kind}</span>
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLE[i.status]}`}>{i.status}</span>
                                    </div>
                                    <p className="font-bold text-slate-900 text-sm break-words">{i.message}</p>
                                    <p className="text-xs text-slate-500 mt-1 break-words">
                                        {i.sample_url} · {i.total} {i.total === 1 ? 'vez' : 'veces'} · {i.users} usuario{i.users === 1 ? '' : 's'} · {i.schools} escuela{i.schools === 1 ? '' : 's'} · último {fmt(i.last_seen)}
                                    </p>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open === i.fingerprint ? 'rotate-180' : ''}`} />
                            </button>

                            {open === i.fingerprint && (
                                <div className="border-t border-slate-100 p-4 sm:p-5 space-y-4 bg-slate-50/50">
                                    <div className="flex flex-wrap gap-2">
                                        {(['nuevo', 'revisando', 'corregido', 'ignorar'] as const).map(s => (
                                            <button key={s} onClick={() => setStatus(i.fingerprint, s)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${i.status === s ? STATUS_STYLE[s] : 'bg-white text-slate-500 border-slate-200'}`}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-xs text-slate-600 space-y-1">
                                        <p><b>Primera vez:</b> {fmt(i.first_seen)} · <b>Roles:</b> {i.roles || '—'} · <b>Plataforma:</b> {i.platforms || '—'}</p>
                                        <p className="break-all"><b>Huella:</b> {i.fingerprint}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Últimas ocurrencias</p>
                                        {occurrences.map(o => (
                                            <details key={o.id} className="bg-white rounded-xl border border-slate-100 p-3 text-xs">
                                                <summary className="cursor-pointer font-bold text-slate-700 break-all">{fmt(o.created_at)} · {o.url} · {o.role ?? '—'} · {o.platform ?? '—'}</summary>
                                                {o.extra && <pre className="mt-2 whitespace-pre-wrap break-all text-slate-600">{JSON.stringify(o.extra, null, 2)}</pre>}
                                                {o.stack && <pre className="mt-2 whitespace-pre-wrap break-all text-slate-400 max-h-48 overflow-y-auto">{o.stack}</pre>}
                                            </details>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
