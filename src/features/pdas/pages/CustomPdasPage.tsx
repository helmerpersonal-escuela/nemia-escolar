import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lightbulb, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useToast } from '../../../components/ui/Toast'

/**
 * Mis PDAs: procesos de desarrollo de aprendizaje propios del docente o la escuela.
 * Se usan junto con los del programa sintético en el programa analítico y la planeación,
 * y se pueden crear o mejorar en cualquier momento del ciclo (por ejemplo, en cada CTE).
 */

export const CAMPOS = ['Lenguajes', 'Saberes y Pensamiento Científico', 'Ética, Naturaleza y Sociedades', 'De lo Humano y lo Comunitario']

export interface CustomPda {
    id: string
    field_of_study: string
    subject_name: string | null
    grade: number | null
    content: string
    pda: string
    notes: string | null
    phase: number | null
    base_content_id: string | null
    updated_at: string
}

const empty = { id: '', field_of_study: CAMPOS[0], subject_name: '', grade: '' as number | '', content: '', pda: '', notes: '', base_content_id: '' }

export const CustomPdasPage = () => {
    const { data: tenant } = useTenant()
    const qc = useQueryClient()
    const { showToast } = useToast()
    const [form, setForm] = useState<typeof empty | null>(null)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [campo, setCampo] = useState('')
    const phase = tenant?.educationalLevel === 'PRIMARY' ? null : 6

    const { data: pdas = [], isLoading } = useQuery({
        queryKey: ['custom-pdas', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const { data, error } = await supabase.from('custom_pdas').select('*').eq('tenant_id', tenant!.id).order('field_of_study').order('updated_at', { ascending: false })
            if (error) throw error
            return (data ?? []) as CustomPda[]
        },
    })

    // Contenidos del programa sintético para partir de uno (opcional)
    const { data: catalog = [] } = useQuery({
        queryKey: ['synthetic-contents', phase],
        queryFn: async () => {
            let q = supabase.from('synthetic_program_contents').select('id, field_of_study, subject_name, content')
            if (phase) q = q.eq('phase', phase)
            const { data } = await q
            const seen = new Set<string>()
            return (data ?? []).filter((r: any) => { const k = `${r.field_of_study}|${r.content}`; if (seen.has(k)) return false; seen.add(k); return true }) as { id: string; field_of_study: string; subject_name: string | null; content: string }[]
        },
        staleTime: 1000 * 60 * 60,
    })

    const visible = useMemo(() => {
        const t = search.trim().toLowerCase()
        return pdas.filter(p => (!campo || p.field_of_study === campo) && (!t || `${p.content} ${p.pda} ${p.subject_name ?? ''}`.toLowerCase().includes(t)))
    }, [pdas, search, campo])

    const save = async () => {
        if (!form || !tenant?.id) return
        if (!form.content.trim() || !form.pda.trim()) { showToast('Escribe el contenido y el PDA', 'error'); return }
        setSaving(true)
        const row = {
            tenant_id: tenant.id,
            field_of_study: form.field_of_study,
            subject_name: form.subject_name.trim() || null,
            grade: form.grade === '' ? null : Number(form.grade),
            content: form.content.trim(),
            pda: form.pda.trim(),
            notes: form.notes.trim() || null,
            base_content_id: form.base_content_id || null,
            phase,
            educational_level: tenant.educationalLevel ?? null,
            updated_at: new Date().toISOString(),
        }
        const { error } = form.id
            ? await supabase.from('custom_pdas').update(row).eq('id', form.id)
            : await supabase.from('custom_pdas').insert(row)
        setSaving(false)
        if (error) { showToast('No se pudo guardar el PDA', 'error'); return }
        showToast(form.id ? 'PDA actualizado' : 'PDA creado', 'success')
        setForm(null)
        qc.invalidateQueries({ queryKey: ['custom-pdas'] })
    }

    const remove = async (p: CustomPda) => {
        if (!window.confirm('¿Eliminar este PDA? Si ya lo usaste en tu programa analítico, dejará de aparecer ahí.')) return
        const { error } = await supabase.from('custom_pdas').delete().eq('id', p.id)
        if (error) { showToast('No se pudo eliminar', 'error'); return }
        qc.invalidateQueries({ queryKey: ['custom-pdas'] })
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Codiseño · Mejora continua</p>
                    <h2 className="text-xl font-black text-slate-900">PDAs propios</h2>
                    <p className="text-sm text-slate-500 mt-1 max-w-xl">Crea procesos de desarrollo de aprendizaje propios, de acuerdo con el contexto y las problemáticas de tus grupos. Aparecen junto a los del programa sintético en tu programa analítico y en tus planeaciones.</p>
                </div>
                <button onClick={() => setForm({ ...empty })} className="self-start inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm whitespace-nowrap"><Plus className="w-4 h-4" /> Nuevo PDA</button>
            </div>

            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[12rem]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contenido o PDA…" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-100 text-sm" />
                </div>
                <select aria-label="Campo formativo" value={campo} onChange={e => setCampo(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-slate-100 text-sm font-bold text-slate-600 max-w-full">
                    <option value="">Todos los campos</option>
                    {CAMPOS.map(c => <option key={c}>{c}</option>)}
                </select>
            </div>

            {isLoading ? (
                <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>
            ) : visible.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-10 text-center">
                    <Lightbulb className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                    <p className="font-black text-slate-800">{pdas.length ? 'Sin resultados' : 'Aún no tienes PDAs propios'}</p>
                    <p className="text-sm text-slate-500 mt-1">Puedes crearlos en cualquier momento del ciclo o durante tus sesiones de CTE.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visible.map(p => (
                        <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{p.field_of_study}{p.subject_name ? ` · ${p.subject_name}` : ''}{p.grade ? ` · ${p.grade}°` : ''}</p>
                                <div className="flex gap-1 shrink-0">
                                    <button aria-label="Editar" onClick={() => setForm({ id: p.id, field_of_study: p.field_of_study, subject_name: p.subject_name ?? '', grade: p.grade ?? '', content: p.content, pda: p.pda, notes: p.notes ?? '', base_content_id: p.base_content_id ?? '' })} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil className="w-4 h-4" /></button>
                                    <button aria-label="Eliminar" onClick={() => remove(p)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <p className="text-sm font-black text-slate-900">{p.content}</p>
                            <p className="text-sm text-slate-600">{p.pda}</p>
                            {p.notes && <p className="text-xs text-slate-400 italic">{p.notes}</p>}
                        </div>
                    ))}
                </div>
            )}

            {form && (
                <div className="fixed inset-0 z-[120] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setForm(null)}>
                    <div role="dialog" aria-modal="true" aria-label="PDA propio" onClick={e => e.stopPropagation()} className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 max-h-[92dvh] overflow-y-auto space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">{form.id ? 'Editar PDA' : 'Nuevo PDA propio'}</h2>
                            <button aria-label="Cerrar" onClick={() => setForm(null)} className="p-2 -m-2 text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <Row label="Campo formativo">
                            <select value={form.field_of_study} onChange={e => setForm({ ...form, field_of_study: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 font-bold text-sm">
                                {CAMPOS.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </Row>
                        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                            <Row label="Disciplina (opcional)">
                                <input value={form.subject_name} onChange={e => setForm({ ...form, subject_name: e.target.value })} placeholder="Ej. Matemáticas" className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
                            </Row>
                            <Row label="Grado (opcional)">
                                <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold">
                                    <option value="">Todos</option>
                                    {Array.from({ length: tenant?.educationalLevel === 'PRIMARY' ? 6 : 3 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}°</option>)}
                                </select>
                            </Row>
                        </div>
                        <Row label="Partir de un contenido del programa sintético (opcional)">
                            <select value={form.base_content_id} onChange={e => {
                                const base = catalog.find(c => c.id === e.target.value)
                                setForm({ ...form, base_content_id: e.target.value, content: base ? base.content : form.content, field_of_study: base?.field_of_study && CAMPOS.includes(base.field_of_study) ? base.field_of_study : form.field_of_study })
                            }} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                                <option value="">— Contenido nuevo —</option>
                                {catalog.filter(c => !form.field_of_study || c.field_of_study === form.field_of_study).map(c => <option key={c.id} value={c.id}>{c.content.slice(0, 90)}</option>)}
                            </select>
                        </Row>
                        <Row label="Contenido">
                            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm" placeholder="Contenido o tema contextualizado" />
                        </Row>
                        <Row label="Proceso de desarrollo de aprendizaje (PDA)">
                            <textarea value={form.pda} onChange={e => setForm({ ...form, pda: e.target.value })} rows={4} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm" placeholder="Describe lo que el alumno logrará, de acuerdo con tu contexto…" />
                        </Row>
                        <Row label="Notas (opcional)">
                            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ej. Ajuste acordado en el CTE de noviembre" className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
                        </Row>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setForm(null)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500">Cancelar</button>
                            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm disabled:opacity-60">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1.5">{label}</span>
        {children}
    </label>
)
