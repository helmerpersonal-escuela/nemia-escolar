import { useState } from 'react'
import { ChevronRight, FilePlus2, FileText } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import { DOC_TYPES, docHeadline, initialData, type CoopDocument, type DocType } from '../lib/types'
import { deadlineStates, LEVEL_STYLE, levelText } from '../lib/deadlines'
import type { CoopBundleCtx } from './shared'
import { Btn, Card, StatusBadge } from './ui'

const db = supabase as any

export const DocumentsTab = ({ bundle, onOpen, onChanged }: { bundle: CoopBundleCtx; onOpen: (id: string) => void; onChanged: () => void }) => {
    const { ctx, documents, deadlines, myUnit } = bundle
    const { showToast } = useToast()
    const [creating, setCreating] = useState<DocType | null>(null)
    const mine = documents.filter(d => d.teacher_id === ctx.teacher.id)
    const states = deadlineStates(deadlines, documents, ctx.teacher.id)

    const create = async (type: DocType) => {
        setCreating(type)
        const { data, error } = await db.from('coop_documents').insert({
            tenant_id: ctx.coop.tenant_id, cooperative_id: ctx.coop.id, academic_year_id: ctx.cycle.id, unit_id: myUnit?.id ?? null,
            doc_type: type, data: initialData(type, ctx, mine),
        }).select('id').single()
        setCreating(null)
        if (error) return showToast('No se pudo crear el formato: ' + error.message, 'error')
        onChanged()
        onOpen(data.id)
    }

    return (
        <div className="space-y-3">
            {!myUnit && (
                <p className="text-xs text-slate-500 px-1">Consejo: registra tu taller o énfasis en Configuración para que aparezca en todos los formatos.</p>
            )}
            {DOC_TYPES.map(dt => {
                const docs = mine.filter(d => d.doc_type === dt.type)
                const dl = states.find(s => s.deadline.doc_type === dt.type)
                const multiple = dt.type === 'PRESUPUESTO' || dt.type === 'INFORME_SEMESTRAL'
                const canCreate = multiple ? !(dt.type === 'INFORME_SEMESTRAL' && docs.length >= 2) : docs.length === 0
                return (
                    <Card key={dt.type}>
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><FileText className="w-5 h-5" /></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-black text-slate-900">{dt.label}</h3>
                                    {dl && <span className={`px-2 py-0.5 rounded-full border text-[11px] font-black ${LEVEL_STYLE[dl.level]}`}>{levelText(dl)}</span>}
                                </div>
                                <p className="text-sm text-slate-500">{dt.description}</p>
                            </div>
                        </div>
                        {docs.length > 0 && (
                            <ul className="mt-3 space-y-2">
                                {docs.map((d: CoopDocument) => (
                                    <li key={d.id}>
                                        <button onClick={() => onOpen(d.id)} className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 px-3 py-2.5 text-left">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{docHeadline(d)}</p>
                                                <p className="text-[11px] text-slate-400">Actualizado {new Date(d.updated_at).toLocaleDateString('es-MX')}</p>
                                            </div>
                                            <StatusBadge status={d.status} />
                                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {canCreate && (
                            <div className="mt-3 flex justify-end">
                                <Btn tone={docs.length ? 'secondary' : 'primary'} icon={FilePlus2} disabled={!!creating} onClick={() => create(dt.type)}>
                                    {creating === dt.type ? 'Creando…' : docs.length ? (dt.type === 'PRESUPUESTO' ? 'Otro presupuesto' : 'Segundo semestre') : 'Llenar formato'}
                                </Btn>
                            </div>
                        )}
                    </Card>
                )
            })}
        </div>
    )
}
