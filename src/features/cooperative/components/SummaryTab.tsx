import { useState } from 'react'
import { AlertTriangle, CalendarClock, FileDown, FileSpreadsheet, FolderArchive, TrendingUp } from 'lucide-react'
import { useToast } from '../../../components/ui/Toast'
import { buildDocumentModel, buildPartnersModel, type FormatModel } from '../lib/format'
import { exportModels } from '../export'
import { annualTotals, budgetTotals, deliveredAt, DOC_TYPES, docShort, money, num, type CoopDocument, type DocType } from '../lib/types'
import { deadlineStates, LEVEL_STYLE, levelText } from '../lib/deadlines'
import type { CoopBundleCtx } from './shared'
import { Btn, Card, DocBadge, Kpi } from './ui'

const ORDER: DocType[] = DOC_TYPES.map(d => d.type)

export const SummaryTab = ({ bundle, isReviewer, isTeacher, independent, onGo }: { bundle: CoopBundleCtx; isReviewer: boolean; isTeacher: boolean; independent: boolean; onGo: (tab: string) => void }) => {
    const { ctx, documents, deadlines, partners } = bundle
    const { showToast } = useToast()
    const [scope, setScope] = useState<'mine' | 'all'>(isTeacher ? 'mine' : 'all')
    const [onlyApproved, setOnlyApproved] = useState(false)
    const [withPartners, setWithPartners] = useState(true)
    const [busy, setBusy] = useState(false)

    const mine = documents.filter(d => d.teacher_id === ctx.teacher.id)
    const base = isTeacher ? mine : documents
    const states = deadlineStates(deadlines, documents, isTeacher ? ctx.teacher.id : undefined)
    const upcoming = states.filter(s => s.level !== 'done').sort((a, b) => a.days - b.days).slice(0, 4)
    const approved = independent ? base.filter(d => !!deliveredAt(d)).length : base.filter(d => d.status === 'APROBADO').length
    const pending = documents.filter(d => d.status === 'ENVIADO').length
    const observed = base.filter(d => d.status === 'CON_OBSERVACIONES').length
    const active = partners.filter(p => p.status === 'ACTIVO')

    const budgets = base.filter(d => d.doc_type === 'PRESUPUESTO')
    const est = budgets.reduce((s, d) => { const t = budgetTotals(d.data ?? {}); return { i: s.i + t.ingresos, e: s.e + t.egresos } }, { i: 0, e: 0 })
    const annual = base.filter(d => d.doc_type === 'INFORME_ANUAL')
    const annualNet = annual.reduce((s, d) => s + annualTotals(d.data ?? {}).neta, 0)

    const expediente = async (kind: 'pdf' | 'xlsx') => {
        const src = (scope === 'mine' ? mine : documents).filter(d => !onlyApproved || (independent ? !!deliveredAt(d) : d.status === 'APROBADO'))
        const sorted = [...src].sort((a, b) => ORDER.indexOf(a.doc_type) - ORDER.indexOf(b.doc_type) || (a.teacher?.full_name ?? '').localeCompare(b.teacher?.full_name ?? '') || a.created_at.localeCompare(b.created_at))
        const models: FormatModel[] = sorted.map((d: CoopDocument) => ({ ...buildDocumentModel(d, ctx), ...(independent ? { status: undefined } : {}) }))
        const newPartners = partners.filter(p => p.academic_year_id === ctx.cycle.id)
        if (withPartners && newPartners.length) models.unshift(buildPartnersModel(newPartners, ctx))
        if (!models.length) return showToast('No hay formatos para exportar con esos filtros.', 'info')
        setBusy(true)
        try { await exportModels(models, kind, `Expediente_cooperativa_${ctx.cycle.name || 'ciclo'}`.replace(/\s+/g, '_')) }
        catch (e: any) { showToast('No se pudo generar el expediente: ' + (e?.message ?? e), 'error') }
        finally { setBusy(false) }
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Socios activos" value={active.length} tone="indigo" hint={`Capital ${money(active.reduce((s, p) => s + num(p.amount), 0))}`} />
                <Kpi label={independent ? 'Formatos entregados' : isTeacher ? 'Mis formatos aprobados' : 'Formatos aprobados'} value={`${approved}/${isTeacher ? DOC_TYPES.length : base.length || 0}`} tone="emerald" />
                {isReviewer
                    ? <Kpi label="Por revisar" value={pending} tone={pending ? 'amber' : 'slate'} />
                    : independent
                        ? <Kpi label="En preparación" value={base.filter(d => !deliveredAt(d)).length} />
                        : <Kpi label="Con observaciones" value={observed} tone={observed ? 'amber' : 'slate'} />}
                <Kpi label="Utilidad estimada" value={money(est.i - est.e)} tone={est.i - est.e >= 0 ? 'emerald' : 'rose'} hint={annual.length ? `Neta real: ${money(annualNet)}` : `${budgets.length} presupuesto(s)`} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <Card title="Próximas entregas" icon={CalendarClock} action={<Btn tone="ghost" className="text-xs px-3" onClick={() => onGo('calendario')}>Calendario</Btn>}>
                    {upcoming.length === 0 ? (
                        <p className="text-sm text-slate-500">{deadlines.length ? 'Todo entregado. ¡Bien!' : 'Captura las fechas de la circular en el calendario para recibir alertas.'}</p>
                    ) : (
                        <ul className="space-y-2">
                            {upcoming.map(s => (
                                <li key={s.deadline.id} className={`rounded-2xl border px-3 py-2 flex items-center justify-between gap-2 text-sm ${LEVEL_STYLE[s.level]}`}>
                                    <span className="font-bold truncate">{docShort(s.deadline.doc_type)}</span>
                                    <span className="text-xs font-black shrink-0 flex items-center gap-1">{s.level === 'overdue' && <AlertTriangle className="w-3.5 h-3.5" />}{levelText(s)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title={isTeacher ? 'Mis formatos del ciclo' : 'Formatos de la escuela'} icon={TrendingUp} action={<Btn tone="ghost" className="text-xs px-3" onClick={() => onGo(isTeacher ? 'formatos' : 'revision')}>Ver</Btn>}>
                    <ul className="space-y-1.5">
                        {DOC_TYPES.map(dt => {
                            const docs = base.filter(d => d.doc_type === dt.type)
                            const last = docs[docs.length - 1]
                            return (
                                <li key={dt.type} className="flex items-center justify-between gap-2 text-sm">
                                    <span className="text-slate-700 truncate">{dt.short}{docs.length > 1 ? ` (${docs.length})` : ''}</span>
                                    {last ? <DocBadge doc={last} independent={independent} /> : <span className="text-xs text-slate-400">Sin iniciar</span>}
                                </li>
                            )
                        })}
                    </ul>
                </Card>
            </div>

            <Card title="Expediente del ciclo" icon={FolderArchive}>
                <p className="text-sm text-slate-500 mb-3">Descarga en un solo archivo todos los formatos del ciclo, listos para imprimir y entregar.</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4 text-sm text-slate-700">
                    {isReviewer && isTeacher && (
                        <select className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold" value={scope} onChange={e => setScope(e.target.value as 'mine' | 'all')}>
                            <option value="mine">Solo mis formatos</option><option value="all">Toda la escuela</option>
                        </select>
                    )}
                    <label className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={onlyApproved} onChange={e => setOnlyApproved(e.target.checked)} /> {independent ? 'Solo entregados' : 'Solo aprobados'}</label>
                    <label className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={withPartners} onChange={e => setWithPartners(e.target.checked)} /> Incluir relación de nuevos socios</label>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Btn tone="primary" icon={FileDown} disabled={busy} onClick={() => expediente('pdf')}>{busy ? 'Generando…' : 'Expediente en PDF'}</Btn>
                    <Btn icon={FileSpreadsheet} disabled={busy} onClick={() => expediente('xlsx')}>Expediente en Excel</Btn>
                </div>
            </Card>
        </div>
    )
}
