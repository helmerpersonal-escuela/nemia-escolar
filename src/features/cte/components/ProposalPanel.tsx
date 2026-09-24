import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, FileText, History } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { aiGenerate } from '../../../lib/aiClient'
import { useToast } from '../../../components/ui/Toast'
import {
    buildProposalPrompt, parseProposal, proposalToAgenda, publishAgenda, sessionLabel,
    type CteDocument, type CteProposal, type CteSession, type ProposalContent, type ProposalContext,
} from '../lib/cteApi'

interface Props {
    tenant: { id: string; name?: string; level?: string }
    sessions: CteSession[]
    defaultSessionId: string | null
    onAgendaApplied: (s: CteSession) => void
}

export const ProposalPanel = ({ tenant, sessions, defaultSessionId, onAgendaApplied }: Props) => {
    const { showToast } = useToast()
    const [sessionId, setSessionId] = useState(defaultSessionId ?? '')
    const [generating, setGenerating] = useState(false)
    const [step, setStep] = useState('')
    const [proposals, setProposals] = useState<CteProposal[]>([])
    const [current, setCurrent] = useState<CteProposal | null>(null)

    const session = sessions.find(s => s.id === sessionId) ?? null

    const loadProposals = useCallback(async () => {
        if (!sessionId) { setProposals([]); setCurrent(null); return }
        const { data } = await supabase
            .from('cte_proposals')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(10)
        const list = (data ?? []) as CteProposal[]
        setProposals(list)
        setCurrent(list[0] ?? null)
    }, [sessionId])

    useEffect(() => { loadProposals() }, [loadProposals])

    const gatherContext = async (target: CteSession): Promise<{ ctx: ProposalContext; sources: { tipo: string; titulo: string }[] }> => {
        setStep('Leyendo insumos y acuerdos…')
        const [docsRes, agreementsRes, indicatorsRes, cycleRes] = await Promise.all([
            supabase.from('cte_documents').select('title, kind, extracted_text, session_id, created_at')
                .eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(30),
            supabase.from('cte_agreements').select('description, status, due_date, follow_up, responsible_label')
                .eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(40),
            supabase.rpc('cte_school_indicators', { p_tenant: tenant.id, p_from: null }),
            supabase.from('pemc_cycles').select('id').eq('tenant_id', tenant.id).eq('is_active', true).limit(1).maybeSingle(),
        ])
        const docs = (docsRes.data ?? []) as (CteDocument & { session_id: string | null })[]
        const officialDocs = docs.filter(d => d.kind === 'GUIA_OFICIAL' && (d.session_id === target.id || !d.session_id)).slice(0, 4)
        const schoolDocs = docs.filter(d => !officialDocs.includes(d) && (d.session_id === target.id || !d.session_id || d.kind === 'DIAGNOSTICO')).slice(0, 6)

        let objectives: string[] = []
        let actions: string[] = []
        if (cycleRes.data?.id) {
            const { data: objs } = await supabase.from('pemc_objectives').select('id, description, goal').eq('cycle_id', cycleRes.data.id)
            const objList = (objs ?? []) as { id: string; description: string; goal: string | null }[]
            objectives = objList.map(o => [o.description, o.goal].filter(Boolean).join(' — Meta: '))
            const ids = objList.map(o => o.id)
            if (ids.length) {
                const { data: acts } = await supabase.from('pemc_actions').select('description, status, deadline').in('objective_id', ids).limit(20)
                actions = ((acts ?? []) as { description: string; status: string | null; deadline: string | null }[]).map(a => `${a.description}${a.status ? ` [${a.status}]` : ''}${a.deadline ? ` (${a.deadline})` : ''}`)
            }
        }

        const previous = sessions
            .filter(s => s.date < target.date && s.minutes?.trim())
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 2)
            .map(s => ({ label: `${sessionLabel(s)} (${s.date})`, minutes: s.minutes! }))

        const ctx: ProposalContext = {
            school: { name: tenant.name, level: tenant.level },
            session: target,
            officialDocs,
            schoolDocs,
            agreements: (agreementsRes.data ?? []) as ProposalContext['agreements'],
            previousMinutes: previous,
            indicators: indicatorsRes.data ?? null,
            pemc: { objectives, actions },
        }
        const sources = [
            ...officialDocs.map(d => ({ tipo: 'Guía oficial', titulo: d.title })),
            ...schoolDocs.map(d => ({ tipo: 'Documento', titulo: d.title })),
            ...previous.map(p => ({ tipo: 'Acta', titulo: p.label })),
            ...(ctx.agreements.length ? [{ tipo: 'Acuerdos', titulo: `${ctx.agreements.length} registrados` }] : []),
            ...(indicatorsRes.data ? [{ tipo: 'Indicadores', titulo: 'Asistencia, promedios e incidencias (60 días)' }] : []),
            ...(objectives.length ? [{ tipo: 'PEMC', titulo: `${objectives.length} objetivos` }] : []),
        ]
        return { ctx, sources }
    }

    const generate = async () => {
        if (!session) return
        setGenerating(true)
        try {
            const { ctx, sources } = await gatherContext(session)
            if (!ctx.officialDocs.length) {
                showToast('No hay guía oficial cargada para esta sesión: la propuesta se basará en tus datos y acuerdos.', 'info', 6000)
            }
            setStep('La IA está preparando la propuesta…')
            const raw = await aiGenerate(buildProposalPrompt(ctx), true)
            const content = parseProposal(raw)
            const { data, error } = await supabase.from('cte_proposals').insert({
                tenant_id: tenant.id, session_id: session.id, content, sources,
            }).select().single()
            if (error) throw error
            setProposals(prev => [data as CteProposal, ...prev])
            setCurrent(data as CteProposal)
        } catch (e) {
            console.error(e)
            showToast(e instanceof Error ? e.message : 'No se pudo generar la propuesta.', 'error', 6000)
        } finally {
            setGenerating(false)
            setStep('')
        }
    }

    const apply = async (p: CteProposal) => {
        if (!session) return
        try {
            const agenda = proposalToAgenda(p.content)
            await supabase.from('cte_sessions').update({ purpose: p.content.proposito ?? session.purpose, agenda }).eq('id', session.id)
            await supabase.from('cte_proposals').update({ status: 'APPLIED' }).eq('id', p.id)
            const visible = await publishAgenda(session, agenda)
            onAgendaApplied({ ...session, agenda, purpose: p.content.proposito ?? session.purpose, status: 'AGENDA_READY' })
            showToast(visible ? 'Agenda aplicada y publicada a docentes.' : 'Agenda aplicada. Captura los datos de la escuela en Ajustes para mostrarla a docentes.', 'success', 6000)
        } catch (e) {
            console.error(e)
            showToast('No se pudo aplicar la propuesta.', 'error')
        }
    }

    const c: ProposalContent | undefined = current?.content

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-3">
                    <h2 className="font-black text-slate-900">Proponer próxima sesión</h2>
                    <p className="text-xs text-slate-500">
                        La IA revisa la guía oficial que subiste, los documentos de la escuela, los acuerdos pendientes,
                        las actas anteriores, el PEMC y los indicadores del plantel (sin nombres de alumnos).
                    </p>
                    <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" aria-label="Sesión">
                        <option value="">Elige la sesión…</option>
                        {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)} · {s.date}</option>)}
                    </select>
                    <button onClick={generate} disabled={!session || generating} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {generating ? step || 'Generando…' : 'Generar propuesta'}
                    </button>
                </div>
                {proposals.length > 1 && (
                    <div className="bg-white rounded-3xl border border-slate-100 p-4 space-y-1">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><History className="w-3 h-3" /> Versiones</p>
                        {proposals.map(p => (
                            <button key={p.id} onClick={() => setCurrent(p)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg ${current?.id === p.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                {new Date(p.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}{p.status === 'APPLIED' ? ' · aplicada' : ''}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6">
                {!current ? (
                    <div className="text-center text-sm text-slate-500 py-16">
                        <Sparkles className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                        Aún no hay propuesta para esta sesión.
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">Propuesta para dirección y coordinación</p>
                                {c?.proposito && <p className="text-base font-bold text-slate-900 mt-1">{c.proposito}</p>}
                            </div>
                            <button onClick={() => apply(current)} disabled={!c?.agenda?.length} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold whitespace-nowrap disabled:opacity-40">
                                <CheckCircle2 className="w-4 h-4" /> Aplicar a la agenda
                            </button>
                        </div>

                        {!!c?.temas_prioritarios?.length && (
                            <section>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Temas prioritarios</h3>
                                <ul className="space-y-1.5">
                                    {c.temas_prioritarios.map((t, i) => (
                                        <li key={i} className="text-sm"><b>{t.tema}</b>{t.evidencia && <span className="text-slate-500"> — {t.evidencia}</span>}</li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {!!c?.agenda?.length && (
                            <section>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Orden del día sugerido</h3>
                                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                                    {c.agenda.map((a, i) => (
                                        <div key={i} className="p-3 grid grid-cols-12 gap-2 text-sm">
                                            <span className="col-span-2 font-bold text-slate-500">{a.hora}{a.duracion_min ? <span className="block text-[11px] font-medium">{a.duracion_min} min</span> : null}</span>
                                            <div className="col-span-7">
                                                <p className="font-bold text-slate-800">{a.tema}</p>
                                                {a.descripcion && <p className="text-xs text-slate-500 mt-0.5">{a.descripcion}</p>}
                                            </div>
                                            <span className="col-span-3 text-xs text-slate-600">{a.responsable}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {!!c?.seguimiento_acuerdos?.length && (
                            <section>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Seguimiento de acuerdos</h3>
                                <ul className="space-y-1.5">
                                    {c.seguimiento_acuerdos.map((s, i) => <li key={i} className="text-sm"><b>{s.acuerdo}:</b> {s.sugerencia}</li>)}
                                </ul>
                            </section>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {!!c?.productos_esperados?.length && (
                                <section>
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Productos esperados</h3>
                                    <ul className="list-disc pl-5 text-sm space-y-1">{c.productos_esperados.map((p, i) => <li key={i}>{p}</li>)}</ul>
                                </section>
                            )}
                            {!!c?.preparacion_previa?.length && (
                                <section>
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Preparación previa</h3>
                                    <ul className="list-disc pl-5 text-sm space-y-1">{c.preparacion_previa.map((p, i) => <li key={i}>{p}</li>)}</ul>
                                </section>
                            )}
                        </div>

                        {c?.notas && <p className="text-xs bg-amber-50 text-amber-800 rounded-xl p-3">{c.notas}</p>}

                        {!!current.sources?.length && (
                            <div className="pt-3 border-t border-slate-100">
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Insumos considerados</p>
                                <div className="flex flex-wrap gap-2">
                                    {current.sources.map((s, i) => (
                                        <span key={i} className="flex items-center gap-1 text-[11px] bg-slate-50 text-slate-600 rounded-full px-2 py-1">
                                            <FileText className="w-3 h-3" /> {s.tipo}: {s.titulo}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-[11px] text-slate-500">Propuesta generada con IA: revísala y ajústala antes de presentarla al colectivo.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
