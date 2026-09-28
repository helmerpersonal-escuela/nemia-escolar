import { useState } from 'react'
import { Eye, EyeOff, Landmark, Loader2, Pencil, Plus, Trash2, Users, User, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { useToast } from '../../../components/ui/Toast'
import { CAMPOS_FORMATIVOS, OFFICIAL_EJES, OFFICIAL_METODOLOGIAS, useCatalogActions, useHiddenItems, usePedagogyItems, type CatalogItem } from '../../../lib/nemCatalog'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

type Kind = 'EJE' | 'METODOLOGIA'
const TEXT = {
    EJE: { title: 'Ejes articuladores', one: 'eje articulador', intro: 'Los siete ejes oficiales del Plan de Estudio 2022 más los que construyas tú o tu comunidad escolar. Todos se pueden elegir al planear y al crear instrumentos.' },
    METODOLOGIA: { title: 'Metodologías sociocríticas', one: 'metodología', intro: 'La SEP sugiere una metodología para cada campo formativo; puedes usar cualquiera o crear la tuya con sus fases o momentos.' },
}

const emptyForm = { id: '', name: '', description: '', field_of_study: '', scope: 'PERSONAL' as 'PERSONAL' | 'SCHOOL', phases: '' }

export const CatalogItemsSection = ({ kind }: { kind: Kind }) => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const { showToast } = useToast()
    const { data: hidden } = useHiddenItems()
    const { data: own = [], isLoading } = usePedagogyItems(kind)
    const { hide, restore, refresh } = useCatalogActions()
    const [form, setForm] = useState<typeof emptyForm | null>(null)
    const [saving, setSaving] = useState(false)
    const official = kind === 'EJE' ? OFFICIAL_EJES : OFFICIAL_METODOLOGIAS
    const isSchool = tenant?.type !== 'INDEPENDENT'
    const t = TEXT[kind]

    const save = async () => {
        if (!form || !tenant?.id) return
        if (form.name.trim().length < 2) { showToast('Escribe el nombre', 'error'); return }
        setSaving(true)
        const row = {
            tenant_id: tenant.id,
            kind,
            scope: isSchool ? form.scope : 'PERSONAL',
            name: form.name.trim(),
            description: form.description.trim() || null,
            field_of_study: form.field_of_study || null,
            phases: form.phases.split('\n').map(s => s.trim()).filter(Boolean),
            updated_at: new Date().toISOString(),
        }
        const { error } = form.id
            ? await supabase.from('pedagogy_items').update(row).eq('id', form.id)
            : await supabase.from('pedagogy_items').insert(row)
        setSaving(false)
        if (error) { showToast('No se pudo guardar', 'error'); return }
        showToast('Guardado', 'success')
        setForm(null)
        refresh()
    }

    const remove = async (item: CatalogItem) => {
        if (!(await askConfirm(`¿Eliminar "${item.name}"?`))) return
        const { error } = await supabase.from('pedagogy_items').delete().eq('id', item.id)
        if (error) showToast('No se pudo eliminar', 'error')
        refresh()
    }

    const Card = ({ item }: { item: CatalogItem }) => {
        const isHidden = item.official && hidden?.has(`${kind}:${item.id}`)
        const mine = !item.official && item.created_by === profile?.id
        return (
            <article className={`bg-white rounded-2xl border p-4 sm:p-5 space-y-2 ${isHidden ? 'border-dashed border-slate-200 opacity-60' : 'border-slate-100'}`}>
                <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 text-indigo-600">
                        {item.official ? <><Landmark className="w-3 h-3" /> Oficial SEP</> : item.scope === 'SCHOOL' ? <><Users className="w-3 h-3" /> Comunidad escolar</> : <><User className="w-3 h-3" /> Propio</>}
                        {item.field_of_study && <span className="text-slate-500">· {kind === 'METODOLOGIA' && item.official ? 'Sugerida para ' : ''}{item.field_of_study}</span>}
                    </p>
                    <div className="flex gap-1 shrink-0">
                        {item.official ? (
                            isHidden
                                ? <button onClick={() => restore(kind, item.id)} aria-label="Restaurar" title="Restaurar" className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"><Eye className="w-4 h-4" /></button>
                                : <button onClick={() => hide(kind, item.id)} aria-label="Ocultar" title="Quitar de mis listas" className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><EyeOff className="w-4 h-4" /></button>
                        ) : (mine || item.scope === 'SCHOOL') && (
                            <>
                                <button aria-label="Editar" onClick={() => setForm({ id: item.id, name: item.name, description: item.description ?? '', field_of_study: item.field_of_study ?? '', scope: item.scope ?? 'PERSONAL', phases: (item.phases ?? []).join('\n') })} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil className="w-4 h-4" /></button>
                                <button aria-label="Eliminar" onClick={() => remove(item)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                            </>
                        )}
                    </div>
                </div>
                <p className="text-sm font-black text-slate-900">{item.name}</p>
                {item.description && <p className="text-sm text-slate-600">{item.description}</p>}
                {!!item.phases?.length && (
                    <ol className="text-xs text-slate-500 list-decimal pl-5 space-y-0.5">{item.phases.map((p, i) => <li key={i}>{p}</li>)}</ol>
                )}
            </article>
        )
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black text-slate-900">{t.title}</h2>
                    <p className="text-sm text-slate-500 max-w-2xl">{t.intro}</p>
                </div>
                <button onClick={() => setForm({ ...emptyForm })} className="self-start inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm whitespace-nowrap"><Plus className="w-4 h-4" /> Crear {t.one}</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {official.map(o => <Card key={o.id} item={o} />)}
                {isLoading ? <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div> : own.map(o => <Card key={o.id} item={o} />)}
            </div>

            {form && (
                <div className="fixed inset-0 z-[120] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setForm(null)}>
                    <div role="dialog" aria-modal="true" aria-label={`Nuevo ${t.one}`} onClick={e => e.stopPropagation()} className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 max-h-[92dvh] overflow-y-auto space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">{form.id ? 'Editar' : 'Crear'} {t.one}</h2>
                            <button aria-label="Cerrar" onClick={() => setForm(null)} className="p-2 -m-2 text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <Field label="Nombre"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} placeholder={kind === 'EJE' ? 'Ej. Cultura de paz' : 'Ej. Aprendizaje basado en retos locales'} /></Field>
                        <Field label="Descripción (opcional)"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={inp} /></Field>
                        {kind === 'METODOLOGIA' && (
                            <>
                                <Field label="Campo formativo sugerido (opcional)">
                                    <select value={form.field_of_study} onChange={e => setForm({ ...form, field_of_study: e.target.value })} className={inp}>
                                        <option value="">Cualquiera</option>
                                        {CAMPOS_FORMATIVOS.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </Field>
                                <Field label="Fases o momentos (uno por línea)"><textarea value={form.phases} onChange={e => setForm({ ...form, phases: e.target.value })} rows={5} className={inp} placeholder={'Identificamos el reto\nInvestigamos\nDiseñamos la solución\nCompartimos'} /></Field>
                            </>
                        )}
                        {isSchool && (
                            <Field label="¿Quién lo puede usar?">
                                <div className="grid grid-cols-2 gap-2">
                                    {(['PERSONAL', 'SCHOOL'] as const).map(s => (
                                        <button key={s} type="button" onClick={() => setForm({ ...form, scope: s })} className={`px-3 py-2.5 rounded-xl border-2 text-sm font-bold ${form.scope === s ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-600'}`}>{s === 'PERSONAL' ? 'Solo yo' : 'Toda la escuela'}</button>
                                    ))}
                                </div>
                            </Field>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setForm(null)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500">Cancelar</button>
                            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm disabled:opacity-60">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}

const inp = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm'
const Field = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <label className="block"><span className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1.5">{label}</span>{children}</label>
)
