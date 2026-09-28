import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, FileDown, FileSpreadsheet, History, MessageSquareWarning, Save, Send, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import { WizardAlert, WizardField, wizardInput } from '../../../components/wizard/Wizard'
import { DateInput } from '../../../components/ui/DateInput'
import { buildDocumentModel } from '../lib/format'
import { exportModels } from '../export'
import {
    annualTotals, budgetTotals, docLabel, emptyFinalRow, emptyMoneyRow, emptyPlanRow, emptyProgressRow, fundTotals, initialData, money, MONTHS, num,
    returnTotals, rowAmount, semesterTotals, STATUS_META,
    type AnnualData, type BudgetData, type CoopContext, type CoopDocument, type FundData, type FundRow, type MoneyRow, type PlanData, type PlanRow,
    type ProgressRow, type ReturnData, type ReturnRow, type SemesterData, type FinalRow,
} from '../lib/types'
import { Btn, Card, DocBadge, RowsEditor, StatusBadge, inputSm } from './ui'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

const db = supabase as any
const FIN = ['COOP ESC', 'ING. PROP.', 'OTRO']

interface Props {
    doc: CoopDocument
    ctx: CoopContext
    related: CoopDocument[]
    canReview: boolean
    independent: boolean
    onClose: () => void
    onChanged: () => void
}

export const DocumentEditor = ({ doc, ctx, related, canReview, independent, onClose, onChanged }: Props) => {
    const { showToast } = useToast()
    const isOwner = doc.teacher_id === ctx.teacher.id
    // Docente independiente: el formato es personal, siempre editable y sin revisión dentro de la app.
    const editable = isOwner && (doc.status === 'BORRADOR' || doc.status === 'CON_OBSERVACIONES')
    const delivered = independent ? (doc.data?._deliveredAt as string | undefined) ?? null : null
    const [data, setData] = useState<any>(doc.data ?? {})
    const [dirty, setDirty] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [notes, setNotes] = useState('')
    const docRef = useRef(doc)
    docRef.current = doc

    useEffect(() => { setData(doc.data ?? {}); setDirty(false) }, [doc.id, doc.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps
    const change = (patch: any) => { setData((d: any) => ({ ...d, ...patch })); setDirty(true) }

    const { data: events = [] } = useQuery({
        queryKey: ['coop', 'events', doc.id, doc.status],
        queryFn: async () => {
            const { data } = await db.from('coop_document_events').select('status, notes, created_at, actor:profiles(full_name)').eq('document_id', doc.id).order('created_at', { ascending: false })
            return (data ?? []) as { status: string; notes: string | null; created_at: string; actor: { full_name: string } | null }[]
        },
    })

    const save = async (silent = false) => {
        setBusy('save')
        const { error } = await db.from('coop_documents').update({ data, updated_at: new Date().toISOString() }).eq('id', doc.id)
        setBusy(null)
        if (error) { showToast('No se pudo guardar: ' + error.message, 'error'); return false }
        setDirty(false)
        if (!silent) showToast('Borrador guardado', 'success')
        onChanged()
        return true
    }

    // Guardado automático cada 20 s si hay cambios
    useEffect(() => {
        if (!dirty || !editable) return
        const t = setTimeout(() => { void save(true) }, 20000)
        return () => clearTimeout(t)
    }, [dirty, data]) // eslint-disable-line react-hooks/exhaustive-deps

    const validation = useMemo(() => validate(doc.doc_type, data), [doc.doc_type, data])

    const submit = async () => {
        if (validation) { showToast(validation, 'warning'); return }
        if (dirty && !(await save(true))) return
        setBusy('send')
        const { error } = await db.from('coop_documents').update({ status: 'ENVIADO', submitted_at: new Date().toISOString() }).eq('id', doc.id)
        setBusy(null)
        if (error) { showToast('No se pudo enviar: ' + error.message, 'error'); return }
        showToast('Enviado a revisión del Área de Producción', 'success')
        onChanged()
    }

    /** Independiente: marca personal de entrega (para el calendario), sin bloquear la edición. */
    const toggleDelivered = async () => {
        if (!delivered && validation) { showToast(validation, 'warning'); return }
        const next = { ...data, _deliveredAt: delivered ? null : new Date().toISOString() }
        setBusy('send')
        const { error } = await db.from('coop_documents').update({ data: next, updated_at: new Date().toISOString() }).eq('id', doc.id)
        setBusy(null)
        if (error) { showToast('No se pudo guardar: ' + error.message, 'error'); return }
        setData(next); setDirty(false)
        showToast(delivered ? 'Marcado como en preparación' : 'Marcado como entregado', 'success')
        onChanged()
    }

    const review = async (status: 'APROBADO' | 'CON_OBSERVACIONES') => {
        if (status === 'CON_OBSERVACIONES' && !notes.trim()) { showToast('Escribe las observaciones para el docente.', 'warning'); return }
        setBusy(status)
        const { error } = await db.from('coop_documents').update({ status, review_notes: notes.trim() || null, reviewed_at: new Date().toISOString(), reviewed_by: ctx.teacher.id }).eq('id', doc.id)
        setBusy(null)
        if (error) { showToast('No se pudo registrar la revisión: ' + error.message, 'error'); return }
        showToast(status === 'APROBADO' ? 'Formato aprobado' : 'Observaciones enviadas al docente', 'success')
        setNotes('')
        onChanged()
    }

    const remove = async () => {
        if (!(await askConfirm('¿Eliminar este borrador?'))) return
        const { error } = await db.from('coop_documents').delete().eq('id', doc.id)
        if (error) { showToast('No se pudo eliminar: ' + error.message, 'error'); return }
        onChanged(); onClose()
    }

    const doExport = async (kind: 'pdf' | 'xlsx') => {
        setBusy(kind)
        try { await exportModels([{ ...buildDocumentModel({ ...doc, data }, ctx), ...(independent ? { status: undefined } : {}) }], kind) }
        catch (e: any) { showToast('No se pudo generar el archivo: ' + (e?.message ?? e), 'error') }
        finally { setBusy(null) }
    }

    const refill = async () => {
        if (!(await askConfirm('Se reemplazarán los renglones con los datos actuales (plan anual, socios, informe anual). ¿Continuar?'))) return
        const fresh = initialData(doc.doc_type, ctx, related)
        change({ rows: fresh.rows, ...(doc.doc_type === 'NOMINA_FONDO_REPARTIBLE' ? { fund: fresh.fund } : {}) })
    }

    const reviewPending = canReview && doc.status === 'ENVIADO'
    const reviewerName = events.find(e => e.status === 'APROBADO' || e.status === 'CON_OBSERVACIONES')?.actor?.full_name

    return (
        <div className="space-y-4 pb-28 sm:pb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <button onClick={onClose} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-800 mb-2"><ArrowLeft className="w-4 h-4" /> Formatos</button>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{docLabel(doc.doc_type)}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                        {independent ? <DocBadge doc={{ ...doc, data }} independent /> : <StatusBadge status={doc.status} />}
                        {doc.teacher?.full_name && <span>· {doc.teacher.full_name}</span>}
                        {dirty && <span className="text-amber-600 font-bold">· Cambios sin guardar</span>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Btn icon={FileDown} onClick={() => doExport('pdf')} disabled={!!busy}>PDF</Btn>
                    <Btn icon={FileSpreadsheet} onClick={() => doExport('xlsx')} disabled={!!busy}>Excel</Btn>
                </div>
            </div>

            {doc.status === 'CON_OBSERVACIONES' && doc.review_notes && (
                <WizardAlert tone="warning">
                    <p className="font-black flex items-center gap-2"><MessageSquareWarning className="w-4 h-4" /> Observaciones{reviewerName ? ` de ${reviewerName}` : ''}</p>
                    <p className="mt-1 whitespace-pre-wrap">{doc.review_notes}</p>
                    {isOwner && <p className="mt-2 text-xs">Corrige lo indicado y vuelve a enviarlo.</p>}
                </WizardAlert>
            )}
            {doc.status === 'ENVIADO' && isOwner && <WizardAlert tone="info">En revisión por la Coordinación de Actividades Tecnológicas / Área de Producción. No se puede editar mientras tanto.</WizardAlert>}
            {independent && isOwner && (
                <WizardAlert tone={delivered ? 'success' : 'info'}>
                    {delivered
                        ? `Marcado como entregado el ${new Date(delivered).toLocaleDateString('es-MX')}. Puedes seguir editándolo si te piden cambios.`
                        : 'Espacio de docente independiente: este formato es tuyo. Descárgalo en PDF o Excel para entregarlo; la revisión no pasa por la app.'}
                </WizardAlert>
            )}
            {doc.status === 'APROBADO' && <WizardAlert tone="success">Formato aprobado{doc.reviewed_at ? ` el ${new Date(doc.reviewed_at).toLocaleDateString('es-MX')}` : ''}{reviewerName ? ` por ${reviewerName}` : ''}.</WizardAlert>}

            {/* Encabezado autocompletado */}
            <Card>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {[['Escuela', ctx.school.name], ['CCT', ctx.school.cct], ['Ciclo', ctx.cycle.name], ['Docente', doc.teacher?.full_name || ctx.teacher.name],
                        ['Cooperativa', ctx.coop.name], ['Clave', ctx.coop.registration_key], ['Unidad', ctx.unit?.name ?? '—'], ['Matrícula', String(ctx.enrollment)]].map(([k, v]) => (
                        <div key={k} className="min-w-0">
                            <div className="font-black text-slate-400">{k}</div>
                            <div className="font-bold text-slate-800 truncate" title={v}>{v || '—'}</div>
                        </div>
                    ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-3">Estos datos se llenan solos en el PDF y en Excel. Cámbialos en Configuración o en los datos de la escuela.</p>
            </Card>

            <FormBody type={doc.doc_type} data={data} change={change} readOnly={!editable} ctx={ctx} onRefill={editable ? refill : undefined} />

            {editable && validation && <WizardAlert tone="warning">{validation}</WizardAlert>}

            {/* Revisión */}
            {reviewPending && (
                <Card title="Revisión y validación" icon={CheckCircle2}>
                    <WizardField label="Observaciones" hint="Obligatorias si lo devuelves con observaciones.">
                        <textarea className={`${wizardInput} min-h-[90px]`} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej. Ajustar el precio unitario del fertilizante; falta el cronograma de marzo." />
                    </WizardField>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <Btn tone="success" icon={CheckCircle2} onClick={() => review('APROBADO')} disabled={!!busy}>Aprobar</Btn>
                        <Btn tone="warning" icon={MessageSquareWarning} onClick={() => review('CON_OBSERVACIONES')} disabled={!!busy}>Con observaciones</Btn>
                    </div>
                </Card>
            )}

            {!independent && events.length > 0 && (
                <Card title="Historial" icon={History}>
                    <ol className="space-y-2">
                        {events.map((e, i) => (
                            <li key={i} className="text-sm flex flex-wrap gap-x-2">
                                <span className="font-black text-slate-800">{STATUS_META[e.status as keyof typeof STATUS_META]?.label ?? e.status}</span>
                                <span className="text-slate-500">{new Date(e.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                {e.actor?.full_name && <span className="text-slate-500">· {e.actor.full_name}</span>}
                                {e.notes && <p className="w-full text-slate-600 whitespace-pre-wrap">{e.notes}</p>}
                            </li>
                        ))}
                    </ol>
                </Card>
            )}

            {/* Barra de acciones */}
            {editable && (
                <div className="fixed sm:static left-0 right-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-0 z-30 bg-white/95 backdrop-blur border-t border-slate-100 sm:border-0 sm:bg-transparent px-4 py-3 sm:p-0">
                    <div className="flex items-center justify-between gap-2 max-w-5xl mx-auto">
                        <Btn tone="danger" icon={Trash2} onClick={remove} className="px-3">{''}<span className="hidden sm:inline">Eliminar</span></Btn>
                        <div className="flex gap-2">
                            <Btn icon={Save} onClick={() => save()} disabled={!!busy || !dirty}>Guardar</Btn>
                            {independent
                                ? <Btn tone={delivered ? 'secondary' : 'success'} icon={CheckCircle2} onClick={toggleDelivered} disabled={!!busy}>{delivered ? 'Quitar entregado' : 'Marcar entregado'}</Btn>
                                : <Btn tone="primary" icon={Send} onClick={submit} disabled={!!busy}>Enviar a revisión</Btn>}
                        </div>
                    </div>
                </div>
            )}
            {!editable && isOwner && doc.status === 'APROBADO' && (
                <p className="text-xs text-slate-400 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Un formato aprobado ya no se edita. Si necesitas cambios, crea uno nuevo.</p>
            )}
        </div>
    )
}

function validate(type: string, d: any): string | null {
    const rows = (d?.rows ?? []) as any[]
    switch (type) {
        case 'PLAN_ANUAL':
            if (!rows.some(r => r.project?.trim())) return 'Agrega al menos un proyecto al plan anual.'
            if (rows.some(r => r.project?.trim() && !r.goal?.trim())) return 'Cada proyecto necesita su meta.'
            return null
        case 'PRESUPUESTO':
            if (!d?.project?.trim()) return 'Escribe el nombre del proyecto.'
            if (!(d?.expenses ?? []).some((r: MoneyRow) => r.concept && rowAmount(r) > 0)) return 'Agrega al menos un egreso con cantidad y precio.'
            return null
        case 'INFORME_SEMESTRAL':
        case 'INFORME_ANUAL':
            if (!rows.some(r => r.project?.trim())) return 'Agrega al menos un proyecto.'
            if (type === 'INFORME_ANUAL' && Math.round(annualTotals(d).pctTotal) !== 100) return 'Los porcentajes de distribución deben sumar 100%.'
            return null
        case 'NOMINA_FONDO_REPARTIBLE':
            if (!rows.length) return 'Agrega a los socios que participan en el reparto.'
            if (num(d?.fund) <= 0) return 'Indica el monto del fondo repartible.'
            if (fundTotals(d).points <= 0) return 'Asigna puntos a los socios.'
            return null
        case 'NOMINA_CERTIFICADOS_DEVUELTOS':
            if (!rows.length) return 'Agrega a los socios de 3er grado que reciben su certificado.'
            return null
    }
    return null
}

// ---------------------------------------------------------------------------
// Cuerpo de cada formato

const Sum = ({ items }: { items: [string, string, ('emerald' | 'rose' | 'indigo')?][] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {items.map(([k, v, tone]) => (
            <div key={k} className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                <div className="text-[11px] font-black text-slate-500">{k}</div>
                <div className={`text-base font-black ${tone === 'emerald' ? 'text-emerald-700' : tone === 'rose' ? 'text-rose-700' : tone === 'indigo' ? 'text-indigo-700' : 'text-slate-900'}`}>{v}</div>
            </div>
        ))}
    </div>
)

const Top = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3 mb-4">{children}</div>

const tone = (n: number) => (n >= 0 ? 'emerald' : 'rose') as 'emerald' | 'rose'

function FormBody({ type, data, change, readOnly, ctx, onRefill }: { type: string; data: any; change: (p: any) => void; readOnly: boolean; ctx: CoopContext; onRefill?: () => void }) {
    const text = (key: string, label: string, ph?: string) => (
        <WizardField label={label}><input className={inputSm} readOnly={readOnly} value={data[key] ?? ''} placeholder={ph} onChange={e => change({ [key]: e.target.value })} /></WizardField>
    )
    const date = (key: string, label: string) => (
        <WizardField label={label}><DateInput className={inputSm} disabled={readOnly} value={data[key] ?? ''} onChange={e => change({ [key]: e.target.value })} /></WizardField>
    )
    const number = (key: string, label: string) => (
        <WizardField label={label}><input className={inputSm} readOnly={readOnly} type="number" step="any" min="0" inputMode="decimal" value={data[key] ?? ''} onChange={e => change({ [key]: e.target.value === '' ? '' : Number(e.target.value) })} /></WizardField>
    )
    const select = (key: string, label: string, options: string[]) => (
        <WizardField label={label}>
            <select className={inputSm} disabled={readOnly} value={data[key] ?? ''} onChange={e => change({ [key]: e.target.value })}>{options.map(o => <option key={o}>{o}</option>)}</select>
        </WizardField>
    )
    const refillBtn = onRefill && <Btn tone="ghost" icon={RefreshCw} onClick={onRefill} className="text-xs px-3 py-2">Volver a cargar datos</Btn>

    switch (type) {
        case 'PLAN_ANUAL': {
            const d = data as PlanData
            return (
                <Card title="Proyectos del ciclo">
                    <Top>{text('place', 'Lugar')}{date('date', 'Fecha')}</Top>
                    <RowsEditor<PlanRow> rows={d.rows ?? []} onChange={rows => change({ rows })} newRow={emptyPlanRow} readOnly={readOnly} addLabel="Agregar proyecto"
                        options={{ months: MONTHS }}
                        title={(r, i) => `Proyecto ${i + 1}${r.project ? ` · ${r.project}` : ''}`}
                        fields={[
                            { key: 'project', label: 'Proyecto', span: 4, placeholder: 'Ej. Cultivo de hortalizas (rábano)' },
                            { key: 'goal', label: 'Meta (propuesta inicial)', span: 2, placeholder: 'Ej. 500 manojos' },
                            { key: 'grade', label: 'Grado', type: 'select', options: ['1°', '2°', '3°', '1°, 2° y 3°'], span: 1 },
                            { key: 'hours', label: 'Horas frente a grupo', type: 'number', span: 1 },
                            { key: 'start', label: 'Inicio', type: 'date', span: 1 },
                            { key: 'end', label: 'Término', type: 'date', span: 1 },
                            { key: 'financing', label: 'Financiamiento', type: 'select', options: FIN, span: 2 },
                            { key: 'inputs', label: 'Insumos', type: 'textarea', span: 3, placeholder: 'Semilla, fertilizante, herramientas…' },
                            { key: 'labor', label: 'Mano de obra', type: 'textarea', span: 3, placeholder: 'Alumnos de 1° A (30), jornales, asesoría…' },
                            { key: 'months', label: 'Cronograma (meses de trabajo)', type: 'months', span: 6 },
                        ]} />
                    <WizardField label="Notas" className="mt-4">
                        <textarea className={`${inputSm} min-h-[60px]`} readOnly={readOnly} value={d.notes ?? ''} onChange={e => change({ notes: e.target.value })} />
                    </WizardField>
                </Card>
            )
        }
        case 'PRESUPUESTO': {
            const d = data as BudgetData
            const t = budgetTotals(d)
            const moneyFields = (concept: string, price: string) => [
                { key: 'concept' as const, label: concept, span: 6 as const },
                { key: 'unit' as const, label: 'Unidad', span: 2 as const, placeholder: 'kg, pieza, jornal' },
                { key: 'qty' as const, label: 'Cantidad', type: 'number' as const, span: 2 as const },
                { key: 'price' as const, label: price, type: 'number' as const, span: 2 as const },
            ]
            return (
                <>
                    <Card title="Datos del presupuesto">
                        <Top>{text('number', 'Presupuesto núm.')}{text('project', 'Nombre del proyecto')}{text('unitName', 'Unidad de producción', ctx.unit?.name)}</Top>
                        <Top>{date('startDate', 'Fecha de inicio')}{date('endDate', 'Fecha de terminación')}</Top>
                    </Card>
                    <Card title="Egresos (insumos, mano de obra, transporte…)">
                        <RowsEditor<MoneyRow> rows={d.expenses ?? []} onChange={expenses => change({ expenses })} newRow={emptyMoneyRow} readOnly={readOnly} addLabel="Agregar egreso"
                            fields={moneyFields('Concepto de egreso', 'Precio unitario')} footer={r => <>Importe: {money(rowAmount(r))}</>} />
                    </Card>
                    <Card title="Recuperaciones (productos a vender)">
                        <RowsEditor<MoneyRow> rows={d.recoveries ?? []} onChange={recoveries => change({ recoveries })} newRow={emptyMoneyRow} readOnly={readOnly} addLabel="Agregar producto"
                            fields={moneyFields('Producto', 'Precio de venta')} footer={r => <>Importe: {money(rowAmount(r))}</>} />
                    </Card>
                    <Card title="Resumen">
                        <Sum items={[['Ingresos estimados', money(t.ingresos), 'indigo'], ['Egresos estimados', money(t.egresos)], ['Utilidad estimada', money(t.utilidad), tone(t.utilidad)],
                            ...(t.realUtilidad != null ? [['Variación real', money(t.realUtilidad - t.utilidad), tone(t.realUtilidad - t.utilidad)] as [string, string, 'emerald' | 'rose']] : [])]} />
                        <p className="text-xs text-slate-500 mt-4 mb-2">Al cierre del proyecto registra los montos reales para ver la variación.</p>
                        <Top>{number('realIncome', 'Ingresos reales')}{number('realExpense', 'Egresos reales')}</Top>
                    </Card>
                </>
            )
        }
        case 'INFORME_SEMESTRAL': {
            const d = data as SemesterData
            const t = semesterTotals(d)
            return (
                <Card title="Avance físico y financiero" action={refillBtn}>
                    <Top>{select('semester', 'Semestre', ['PRIMERO', 'SEGUNDO'])}{number('hours', 'Total horas frente a grupo')}{select('financing', 'Financiamiento', FIN)}{date('date', 'Fecha')}</Top>
                    <RowsEditor<ProgressRow> rows={d.rows ?? []} onChange={rows => change({ rows })} newRow={emptyProgressRow} readOnly={readOnly} addLabel="Agregar proyecto"
                        title={(r, i) => r.project || `Proyecto ${i + 1}`}
                        fields={[
                            { key: 'project', label: 'Proyecto', span: 3 }, { key: 'goal', label: 'Meta (propuesta inicial)', span: 3 },
                            { key: 'achieved', label: 'Avance en el semestre', span: 3, placeholder: 'Ej. 320 manojos' }, { key: 'physicalPct', label: '% avance físico', type: 'number', span: 1 },
                            { key: 'income', label: 'Ingresos', type: 'number', span: 1 }, { key: 'expense', label: 'Egresos', type: 'number', span: 1 },
                            { key: 'observations', label: 'Observaciones', span: 6 },
                        ]} footer={r => <>Saldo: {money(num(r.income) - num(r.expense))}</>} />
                    <Sum items={[['Avance físico promedio', `${t.physical}%`, 'indigo'], ['Ingresos', money(t.income)], ['Egresos', money(t.expense)], ['Saldo', money(t.balance), tone(t.balance)]]} />
                </Card>
            )
        }
        case 'INFORME_ANUAL': {
            const d = data as AnnualData
            const t = annualTotals(d)
            const dist = d.distribution ?? { social: 40, repartible: 40, reserva: 20 }
            const setDist = (k: keyof typeof dist, v: string) => change({ distribution: { ...dist, [k]: v === '' ? '' : Number(v) } })
            return (
                <>
                    <Card title="Resultados por proyecto" action={refillBtn}>
                        <Top>{number('hours', 'Total horas frente a grupo')}{select('financing', 'Financiamiento', FIN)}{text('place', 'Lugar')}{date('date', 'Fecha')}</Top>
                        <RowsEditor<FinalRow> rows={d.rows ?? []} onChange={rows => change({ rows })} newRow={emptyFinalRow} readOnly={readOnly} addLabel="Agregar proyecto"
                            title={(r, i) => r.project || `Proyecto ${i + 1}`}
                            fields={[
                                { key: 'project', label: 'Proyecto', span: 4 }, { key: 'budgetNo', label: 'Presupuesto núm.', span: 2 },
                                { key: 'goal', label: 'Meta propuesta', span: 2 }, { key: 'result', label: 'Resultado final', span: 2 },
                                { key: 'income', label: 'Ingresos', type: 'number', span: 1 }, { key: 'expense', label: 'Egresos', type: 'number', span: 1 },
                            ]} footer={r => <>Utilidad: {money(num(r.income) - num(r.expense))}</>} />
                    </Card>
                    <Card title="Balance final y distribución del rendimiento">
                        <Top>{number('amortization', 'Amortización')}
                            {(['social', 'repartible', 'reserva'] as const).map(k => (
                                <WizardField key={k} label={`% fondo ${k === 'social' ? 'social' : k === 'repartible' ? 'repartible' : 'de reserva'}`}>
                                    <input className={inputSm} readOnly={readOnly} type="number" min="0" max="100" value={dist[k] as any} onChange={e => setDist(k, e.target.value)} />
                                </WizardField>
                            ))}
                        </Top>
                        {Math.round(t.pctTotal) !== 100 && <WizardAlert tone="warning">Los porcentajes suman {t.pctTotal}%; deben sumar 100%.</WizardAlert>}
                        <Sum items={[['Utilidad bruta', money(t.bruta), tone(t.bruta)], ['Amortización', money(num(d.amortization))], ['Utilidad neta', money(t.neta), tone(t.neta)], ['Ingresos / egresos', `${money(t.income)} / ${money(t.expense)}`]]} />
                        <Sum items={[[`Fondo social (${num(dist.social)}%)`, money(t.social), 'indigo'], [`Fondo repartible (${num(dist.repartible)}%)`, money(t.repartible), 'indigo'], [`Fondo de reserva (${num(dist.reserva)}%)`, money(t.reserva), 'indigo']]} />
                        <p className="text-xs text-slate-500 mt-3">El fondo repartible pasa automáticamente a la nómina de fondo repartible.</p>
                    </Card>
                </>
            )
        }
        case 'NOMINA_FONDO_REPARTIBLE': {
            const d = data as FundData
            const t = fundTotals(d)
            return (
                <Card title="Reparto entre socios" action={refillBtn}>
                    <Top>{number('fund', 'Fondo repartible ($)')}{date('date', 'Fecha')}</Top>
                    <p className="text-xs text-slate-500 mb-3">Por defecto cada socio tiene 1 punto (reparto igual). Ajusta los puntos según participación; el importe se recalcula solo.</p>
                    <RowsEditor<FundRow> rows={d.rows ?? []} onChange={rows => change({ rows })} newRow={() => ({ name: '', group: '', points: 1, consumption: '' })} readOnly={readOnly} addLabel="Agregar socio"
                        title={(r, i) => `${i + 1}. ${r.name || 'Socio'}`}
                        fields={[{ key: 'name', label: 'Nombre', span: 3 }, { key: 'group', label: 'Grupo', span: 1 }, { key: 'points', label: 'Puntos', type: 'number', span: 1 }, { key: 'consumption', label: 'Sección consumo', type: 'number', span: 1 }]}
                        footer={(_, i) => <>Importe {money(t.lines[i]?.importe ?? 0)} · Total {money(t.lines[i]?.total ?? 0)}</>} />
                    <Sum items={[['Total de puntos', String(t.points)], ['Valor por punto', money(t.perPoint), 'indigo'], ['Importe repartido', money(t.importe)], ['Total a pagar', money(t.total), 'emerald']]} />
                </Card>
            )
        }
        case 'NOMINA_CERTIFICADOS_DEVUELTOS': {
            const d = data as ReturnData
            const t = returnTotals(d)
            return (
                <Card title="Socios de 3er grado que egresan" action={refillBtn}>
                    <Top>{date('date', 'Fecha')}</Top>
                    <RowsEditor<ReturnRow> rows={d.rows ?? []} onChange={rows => change({ rows })} newRow={() => ({ name: '', group: '3°', certificates: 1, value: ctx.coop.membership_fee == null ? 5 : num(ctx.coop.membership_fee) })} readOnly={readOnly} addLabel="Agregar socio"
                        title={(r, i) => `${i + 1}. ${r.name || 'Socio'}`}
                        fields={[{ key: 'name', label: 'Nombre', span: 3 }, { key: 'group', label: 'Grupo', span: 1 }, { key: 'certificates', label: 'Certificados', type: 'number', span: 1 }, { key: 'value', label: 'Valor ($)', type: 'number', span: 1 }]}
                        footer={(_, i) => <>Importe {money(t.lines[i] ?? 0)}</>} />
                    <Sum items={[['Socios', String((d.rows ?? []).length)], ['Certificados', String(t.certificates)], ['Importe total', money(t.total), 'emerald']]} />
                </Card>
            )
        }
    }
    return null
}
