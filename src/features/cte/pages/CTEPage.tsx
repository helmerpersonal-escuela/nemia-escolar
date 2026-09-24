import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileText, Handshake, Sparkles, ExternalLink, RefreshCw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useToast } from '../../../components/ui/Toast'
import {
    CTE_PORTAL_URL, currentSchoolYear, fetchStaff, pickNextSession, sessionLabel, todayISO,
    type CteSession, type StaffMember,
} from '../lib/cteApi'
import { SessionsPanel } from '../components/SessionsPanel'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { AgreementsPanel } from '../components/AgreementsPanel'
import { ProposalPanel } from '../components/ProposalPanel'

type Tab = 'sessions' | 'documents' | 'agreements' | 'proposal'

const TABS: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
    { id: 'sessions', label: 'Sesiones', icon: CalendarDays },
    { id: 'documents', label: 'Insumos', icon: FileText },
    { id: 'agreements', label: 'Acuerdos', icon: Handshake },
    { id: 'proposal', label: 'Propuesta con IA', icon: Sparkles },
]

export const CTEPage = () => {
    const { data: tenant } = useTenant()
    const { showToast } = useToast()
    const [tab, setTab] = useState<Tab>('sessions')
    const [schoolYear, setSchoolYear] = useState(currentSchoolYear())
    const [sessions, setSessions] = useState<CteSession[]>([])
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const tenantId = tenant?.id

    const loadSessions = useCallback(async () => {
        if (!tenantId) return
        setLoading(true)
        try {
            const first = await supabase
                .from('cte_sessions')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('school_year', schoolYear)
                .order('date')
            if (first.error) throw first.error
            let data: unknown[] | null = first.data
            if (!data?.length) {
                // Primera vez en el ciclo: crear las sesiones del calendario oficial.
                const { error: ensureError } = await supabase.rpc('cte_ensure_sessions', { p_tenant: tenantId, p_school_year: schoolYear })
                if (!ensureError) {
                    const res = await supabase.from('cte_sessions').select('*').eq('tenant_id', tenantId).eq('school_year', schoolYear).order('date')
                    data = res.data
                }
            }
            const list = (data ?? []) as CteSession[]
            setSessions(list)
            setSelectedId(prev => prev && list.some(s => s.id === prev) ? prev : pickNextSession(list, todayISO())?.id ?? null)
        } catch (e) {
            console.error(e)
            showToast('No se pudieron cargar las sesiones del CTE.', 'error')
        } finally {
            setLoading(false)
        }
    }, [tenantId, schoolYear, showToast])

    useEffect(() => { loadSessions() }, [loadSessions])
    useEffect(() => {
        if (tenantId) fetchStaff(tenantId).then(setStaff).catch(() => setStaff([]))
    }, [tenantId])

    const next = useMemo(() => pickNextSession(sessions, todayISO()), [sessions])

    const updateSession = (s: CteSession) => setSessions(prev => prev.map(x => x.id === s.id ? s : x))

    if (!tenantId) return null

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">Consejo Técnico Escolar</p>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Planeación y seguimiento del CTE</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {next ? <>Próxima sesión: <b>{sessionLabel(next)}</b> · {new Date(next.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</> : 'Sin sesiones registradas'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={schoolYear}
                        onChange={e => setSchoolYear(e.target.value)}
                        className="min-h-11 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
                        aria-label="Ciclo escolar"
                    >
                        {[0, -1].map(offset => {
                            const [a] = currentSchoolYear().split('-').map(Number)
                            const y = `${a + offset}-${a + offset + 1}`
                            return <option key={y} value={y}>Ciclo {y}</option>
                        })}
                    </select>
                    <a
                        href={CTE_PORTAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-11 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap"
                    >
                        <ExternalLink className="w-4 h-4" aria-hidden="true" /> <span className="sm:hidden">Guías SEP</span><span className="hidden sm:inline">Insumos oficiales SEP</span>
                    </a>
                    <button onClick={loadSessions} className="min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Actualizar">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div role="tablist" aria-label="Secciones del CTE" className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`shrink-0 min-h-11 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${tab === t.id ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>

            {tab === 'sessions' && (
                <SessionsPanel
                    sessions={sessions}
                    loading={loading}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onChange={updateSession}
                    onCreated={loadSessions}
                    tenantId={tenantId}
                    schoolYear={schoolYear}
                    staff={staff}
                />
            )}
            {tab === 'documents' && <DocumentsPanel tenantId={tenantId} sessions={sessions} defaultSessionId={next?.id ?? null} />}
            {tab === 'agreements' && <AgreementsPanel tenantId={tenantId} sessions={sessions} staff={staff} defaultSessionId={next?.id ?? null} />}
            {tab === 'proposal' && (
                <ProposalPanel
                    tenant={{ id: tenantId, name: tenant?.name ?? undefined, level: tenant?.educationalLevel ?? undefined }}
                    sessions={sessions}
                    defaultSessionId={next?.id ?? null}
                    onAgendaApplied={(s) => { updateSession(s); setSelectedId(s.id); setTab('sessions') }}
                />
            )}
        </div>
    )
}
