import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, ClipboardCheck, FileText, LayoutDashboard, Loader2, Settings, Store, Users } from 'lucide-react'
import { useToast } from '../../../components/ui/Toast'
import { supabase } from '../../../lib/supabase'
import { WizardAlert } from '../../../components/wizard/Wizard'
import { CooperativeFields, cooperativeIsValid, emptyCooperative, saveCooperativeSetup } from '../components/CooperativeFields'
import { useCooperativeData, useCoopRole, useInvalidateCoop } from '../lib/useCooperative'
import { SummaryTab } from '../components/SummaryTab'
import { PartnersTab } from '../components/PartnersTab'
import { CalendarTab } from '../components/CalendarTab'
import { DocumentsTab } from '../components/DocumentsTab'
import { ReviewTab } from '../components/ReviewTab'
import { SettingsTab } from '../components/SettingsTab'
import { DocumentEditor } from '../components/DocumentEditor'
import { Btn } from '../components/ui'
import type { CoopBundleCtx } from '../components/shared'

export const CooperativePage = () => {
    const { tenant, isReviewer, isTeacher, independent } = useCoopRole()
    const { coop, coopLoading, data, isLoading, error, refetch } = useCooperativeData()
    const invalidate = useInvalidateCoop()
    const [params, setParams] = useSearchParams()
    const requestedTab = params.get('tab') || 'resumen'
    const docId = params.get('doc')
    const go = (next: Record<string, string | null>) => {
        const p = new URLSearchParams(params)
        Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
        setParams(p, { replace: false })
        window.scrollTo(0, 0)
    }
    const changed = () => { void invalidate(); void refetch() }

    if (coopLoading || (coop && isLoading)) {
        return <div className="py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
    }
    if (!coop) return <CoopSetup tenantId={(tenant as any)?.id} onDone={changed} />
    if (error || !data?.ctx) {
        return <div className="max-w-3xl mx-auto py-10 px-4"><WizardAlert>No se pudo cargar la cooperativa. {(error as any)?.message ?? ''}</WizardAlert></div>
    }

    const bundle = data as CoopBundleCtx
    const { ctx } = bundle
    const pending = bundle.documents.filter(d => d.status === 'ENVIADO').length
    const observed = bundle.documents.filter(d => d.teacher_id === ctx.teacher.id && d.status === 'CON_OBSERVACIONES').length
    const tabs = [
        { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
        ...(isTeacher ? [{ id: 'formatos', label: 'Formatos', icon: FileText, badge: observed }] : []),
        { id: 'socios', label: 'Socios', icon: Users },
        { id: 'calendario', label: 'Calendario', icon: CalendarClock },
        ...(isReviewer ? [{ id: 'revision', label: 'Revisión', icon: ClipboardCheck, badge: pending }] : []),
        { id: 'configuracion', label: 'Configuración', icon: Settings },
    ]
    const doc = docId ? bundle.documents.find(d => d.id === docId) : null
    const tab = tabs.some(t => t.id === requestedTab) ? requestedTab : 'resumen'

    return (
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
            {/* Encabezado con nombre y clave de la cooperativa */}
            <header className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 mb-4">
                <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-indigo-600 text-white flex items-center justify-center"><Store className="w-6 h-6 sm:w-7 sm:h-7" /></div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Cooperativa Escolar y Proyectos Productivos</p>
                        <h1 className="text-base sm:text-2xl font-black text-slate-900 leading-tight break-words">{ctx.coop.name}</h1>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs sm:text-sm text-slate-500">
                            <span>Clave: <b className="text-slate-800">{ctx.coop.registration_key}</b></span>
                            {ctx.school.cct && <span>CCT {ctx.school.cct}</span>}
                            {ctx.cycle.name && <span>{ctx.cycle.name}</span>}
                            {ctx.unit && <span>Unidad: {ctx.unit.name}</span>}
                        </div>
                    </div>
                </div>
            </header>

            {doc ? (
                <DocumentEditor doc={doc} ctx={{ ...ctx, unit: bundle.units.find(u => u.id === doc.unit_id) ?? (doc.teacher_id === ctx.teacher.id ? ctx.unit : null) }}
                    related={bundle.documents.filter(d => d.teacher_id === doc.teacher_id && d.id !== doc.id)}
                    canReview={isReviewer} independent={independent} onClose={() => go({ doc: null })} onChanged={changed} />
            ) : (
                <>
                    <nav className="flex gap-1 overflow-x-auto scrollbar-hide mb-4 -mx-3 px-3 sm:mx-0 sm:px-0" aria-label="Secciones de la cooperativa">
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => go({ tab: t.id })} aria-current={tab === t.id ? 'page' : undefined}
                                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-black transition ${tab === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-100 text-slate-600 hover:text-indigo-700'}`}>
                                <t.icon className="w-4 h-4" /> {t.label}
                                {!!(t as any).badge && <span className={`min-w-5 h-5 px-1 rounded-full text-[11px] flex items-center justify-center ${tab === t.id ? 'bg-white text-indigo-700' : 'bg-amber-500 text-white'}`}>{(t as any).badge}</span>}
                            </button>
                        ))}
                    </nav>
                    {docId && !doc && <div className="mb-4"><WizardAlert tone="warning">No se encontró el formato solicitado.</WizardAlert></div>}
                    {tab === 'resumen' && <SummaryTab bundle={bundle} isReviewer={isReviewer} isTeacher={isTeacher} independent={independent} onGo={t => go({ tab: t })} />}
                    {tab === 'formatos' && isTeacher && <DocumentsTab bundle={bundle} independent={independent} onOpen={id => go({ doc: id })} onChanged={changed} />}
                    {tab === 'socios' && <PartnersTab bundle={bundle} onChanged={changed} />}
                    {tab === 'calendario' && <CalendarTab bundle={bundle} isReviewer={isReviewer && !isTeacher} onChanged={changed} />}
                    {tab === 'revision' && isReviewer && <ReviewTab bundle={bundle} onOpen={id => go({ doc: id })} />}
                    {tab === 'configuracion' && <SettingsTab bundle={bundle} onChanged={changed} />}
                </>
            )}
        </div>
    )
}

const CoopSetup = ({ tenantId, onDone }: { tenantId?: string; onDone: () => void }) => {
    const { showToast } = useToast()
    const [coop, setCoop] = useState({ ...emptyCooperative, hasCooperative: true as boolean | null })
    const [saving, setSaving] = useState(false)
    const save = async () => {
        if (!tenantId || !cooperativeIsValid(coop)) return showToast('El nombre y la clave son obligatorios.', 'warning')
        setSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            await saveCooperativeSetup(tenantId, user?.id ?? null, coop)
            showToast('Cooperativa registrada', 'success')
            onDone()
        } catch (e: any) {
            showToast('No se pudo registrar: ' + (e?.message ?? e), 'error')
        } finally { setSaving(false) }
    }
    return (
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8">
            <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Cooperativa Escolar y Proyectos Productivos</p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">Registra tu cooperativa</h1>
            <p className="text-slate-500 mb-6">Para Secundarias Técnicas: socios, calendario de la circular, formatos oficiales y revisión del Área de Producción en un solo lugar.</p>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-4">
                <CooperativeFields value={coop} onChange={setCoop} />
                {coop.hasCooperative === false && <WizardAlert tone="info">Sin cooperativa no hay nada que configurar. Puedes volver cuando la escuela la registre.</WizardAlert>}
                <div className="flex justify-end"><Btn tone="primary" onClick={save} disabled={saving || !coop.hasCooperative}>{saving ? 'Guardando…' : 'Activar módulo'}</Btn></div>
            </div>
        </div>
    )
}
