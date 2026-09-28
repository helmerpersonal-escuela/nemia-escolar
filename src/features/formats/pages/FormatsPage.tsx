import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, Wand2, Loader2, Star, Trash2, Eye, X, Printer, Users, User, FileText, Info } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { useToast } from '../../../components/ui/Toast'
import { FORMAT_KINDS, analyzeFormat, proposeFormat, useFormats, type FormatKind, type FormatSpec, type TeacherFormat } from '../../../lib/formats'
import { FormatDocument, printFormat } from '../../../components/formats/FormatDocument'
import { extractFileText } from '../../cte/lib/docText'
import { readSpreadsheet } from '../../../lib/textImport'

const safeName = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)

async function fileToText(file: File): Promise<string> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.xlsx') || name.endsWith('.csv')) {
        const rows = await readSpreadsheet(file)
        return rows.map(r => r.join(' | ')).join('\n')
    }
    return extractFileText(file)
}

/** Mis formatos: el docente sube el formato de su escuela (o la IA le propone uno) y los resultados salen con ese formato. */
export const FormatsPage = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const { showToast } = useToast()
    const qc = useQueryClient()
    const [params] = useSearchParams()
    const initialKind = (FORMAT_KINDS.find(k => k.id === params.get('kind'))?.id ?? 'PLANEACION') as FormatKind
    const [kind, setKind] = useState<FormatKind>(initialKind)
    const { data: formats = [], isLoading } = useFormats()
    const [busy, setBusy] = useState<string | null>(null)
    const [preview, setPreview] = useState<{ name: string, spec: FormatSpec } | null>(null)
    const [proposeText, setProposeText] = useState('')
    const fileRef = useRef<HTMLInputElement>(null)
    const isSchool = tenant?.type !== 'INDEPENDENT'
    const list = formats.filter(f => f.kind === kind)
    const refresh = () => qc.invalidateQueries({ queryKey: ['teacher-formats'] })

    const save = async (spec: FormatSpec, source: 'UPLOAD' | 'AI', file?: File) => {
        if (!tenant?.id || !profile?.id) return
        let file_path: string | null = null
        if (file) {
            file_path = `${tenant.id}/${profile.id}/${Date.now()}_${safeName(file.name)}`
            const { error: upErr } = await supabase.storage.from('teacher_formats').upload(file_path, file, { upsert: false })
            if (upErr) file_path = null   // el análisis ya está hecho; el original es opcional
        }
        const first = !formats.some(f => f.kind === kind)
        const { error } = await supabase.from('teacher_formats').insert({
            tenant_id: tenant.id, kind, source, name: spec.title, spec, file_path, file_name: file?.name ?? null, is_default: first,
        })
        if (error) throw error
        refresh()
        setPreview({ name: spec.title, spec })
    }

    const onUpload = async (file: File) => {
        if (file.size > 10 * 1024 * 1024) { showToast('El archivo pesa más de 10 MB', 'error'); return }
        setBusy('Leyendo y analizando tu formato…')
        try {
            const text = await fileToText(file)
            if (text.trim().length < 40) throw new Error('No encontramos texto en el archivo. Si es una imagen o un PDF escaneado, súbelo en Word (.docx), Excel o un PDF con texto.')
            const spec = await analyzeFormat(text, kind, file.name)
            if (!spec.sections.length) throw new Error('No pudimos identificar las secciones del formato. Prueba con la versión en Word.')
            await save(spec, 'UPLOAD', file)
            showToast('Formato analizado. Revisa la vista previa.', 'success')
        } catch (e: any) {
            showToast(e?.message || 'No se pudo analizar el formato', 'error')
        } finally {
            setBusy(null)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    const onPropose = async () => {
        setBusy('La IA está proponiendo un formato según los lineamientos de la SEP…')
        try {
            const level = tenant?.educationalLevel === 'PRIMARY' ? 'primaria' : tenant?.educationalLevel === 'TELESECUNDARIA' ? 'telesecundaria' : 'secundaria'
            const spec = await proposeFormat(kind, { level, extra: proposeText.trim() || undefined })
            await save(spec, 'AI')
            setProposeText('')
            showToast('Formato propuesto. Puedes usarlo o subir el de tu escuela.', 'success')
        } catch (e: any) {
            showToast(e?.message || 'No se pudo generar la propuesta', 'error')
        } finally { setBusy(null) }
    }

    const setDefault = async (f: TeacherFormat) => {
        await supabase.from('teacher_formats').update({ is_default: false }).eq('tenant_id', f.tenant_id).eq('kind', f.kind).eq('created_by', profile?.id ?? '')
        await supabase.from('teacher_formats').update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', f.id)
        refresh()
    }
    const toggleScope = async (f: TeacherFormat) => {
        await supabase.from('teacher_formats').update({ scope: f.scope === 'SCHOOL' ? 'PERSONAL' : 'SCHOOL' }).eq('id', f.id)
        refresh()
    }
    const remove = async (f: TeacherFormat) => {
        if (!window.confirm(`¿Eliminar el formato "${f.name}"?`)) return
        if (f.file_path) await supabase.storage.from('teacher_formats').remove([f.file_path])
        await supabase.from('teacher_formats').delete().eq('id', f.id)
        refresh()
    }
    const openOriginal = async (f: TeacherFormat) => {
        if (!f.file_path) return
        const { data } = await supabase.storage.from('teacher_formats').createSignedUrl(f.file_path, 300)
        if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    }

    return (
        <div className="max-w-5xl mx-auto px-3 sm:px-0 pb-20 space-y-6">
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Tus documentos, a tu manera</p>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Mis formatos</h1>
                <p className="text-sm text-slate-500 mt-1 max-w-2xl">¿Tu escuela te pide un formato? Súbelo y VUNLEK lo analiza: tus planeaciones, instrumentos y reportes saldrán con ese mismo formato. Si no tienes uno, la IA te propone uno según los lineamientos de la SEP.</p>
            </div>

            <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
                {FORMAT_KINDS.map(k => (
                    <button key={k.id} role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)} className={`shrink-0 px-4 py-2.5 rounded-2xl text-sm font-black ${kind === k.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-100 text-slate-600'}`}>
                        {k.label} <span className="opacity-70">({formats.filter(f => f.kind === k.id).length})</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><FileUp className="w-5 h-5" /></div>
                    <h2 className="font-black text-slate-900">Sí, tengo el formato de mi escuela</h2>
                    <p className="text-sm text-slate-500">Word (.docx), PDF con texto, Excel (.xlsx) o texto. Se respeta el encabezado, las secciones, las columnas y las firmas.</p>
                    <input ref={fileRef} type="file" accept=".docx,.pdf,.xlsx,.csv,.txt" className="hidden" id="format-upload" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} disabled={!!busy} />
                    <label htmlFor="format-upload" className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}><FileUp className="w-4 h-4" /> Subir formato</label>
                </div>
                <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center"><Wand2 className="w-5 h-5" /></div>
                    <h2 className="font-black text-slate-900">No tengo formato: que la IA me proponga uno</h2>
                    <p className="text-sm text-slate-500">Apegado a la Nueva Escuela Mexicana y a lo que suele pedir la supervisión.</p>
                    <input value={proposeText} onChange={e => setProposeText(e.target.value)} placeholder="Opcional: p. ej. “que quepa en una hoja horizontal”" aria-label="Indicaciones para la propuesta" className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
                    <button onClick={onPropose} disabled={!!busy} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 text-white font-black text-sm disabled:opacity-60"><Wand2 className="w-4 h-4" /> Proponer formato</button>
                </div>
            </div>

            {busy && <div className="flex items-center gap-3 bg-indigo-50 text-indigo-800 rounded-2xl p-4 text-sm font-bold"><Loader2 className="w-5 h-5 animate-spin" /> {busy}</div>}

            <section className="space-y-3">
                <h2 className="text-lg font-black text-slate-900">Formatos de {FORMAT_KINDS.find(k => k.id === kind)?.label.toLowerCase()}</h2>
                {isLoading ? <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /> : list.length === 0 ? (
                    <p className="text-sm text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center">Aún no tienes formatos de este tipo. Mientras tanto se usa el formato de VUNLEK.</p>
                ) : list.map(f => {
                    const mine = f.created_by === profile?.id
                    return (
                        <article key={f.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap items-center gap-3">
                            <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-900 text-sm truncate">{f.name} {f.is_default && <span className="ml-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Predeterminado</span>}</p>
                                <p className="text-xs text-slate-500 flex items-center gap-2">
                                    {f.source === 'AI' ? 'Propuesto por IA' : f.file_name ?? 'Subido'} · {f.spec.sections?.length ?? 0} secciones
                                    <span className="inline-flex items-center gap-1">{f.scope === 'SCHOOL' ? <><Users className="w-3 h-3" /> Toda la escuela</> : <><User className="w-3 h-3" /> Solo yo</>}</span>
                                </p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setPreview({ name: f.name, spec: f.spec })} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Vista previa" title="Vista previa"><Eye className="w-4 h-4" /></button>
                                {f.file_path && <button onClick={() => openOriginal(f)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Ver original" title="Ver archivo original"><FileText className="w-4 h-4" /></button>}
                                {!f.is_default && <button onClick={() => setDefault(f)} className="p-2 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600" aria-label="Usar como predeterminado" title="Usar como predeterminado"><Star className="w-4 h-4" /></button>}
                                {mine && isSchool && <button onClick={() => toggleScope(f)} className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100">{f.scope === 'SCHOOL' ? 'Hacer privado' : 'Compartir con la escuela'}</button>}
                                {mine && <button onClick={() => remove(f)} className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar"><Trash2 className="w-4 h-4" /></button>}
                            </div>
                        </article>
                    )
                })}
                <p className="text-xs text-slate-500 flex items-start gap-2"><Info className="w-4 h-4 shrink-0" /> El formato predeterminado se usa al imprimir tus planeaciones (Vista previa → “Con mi formato”) y al generar instrumentos.</p>
            </section>

            {preview && (
                <div className="fixed inset-0 z-[150] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPreview(null)}>
                    <div role="dialog" aria-modal="true" aria-label="Vista previa del formato" onClick={e => e.stopPropagation()} className="w-full sm:max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
                            <p className="font-black text-slate-900 truncate">{preview.name}</p>
                            <div className="flex gap-2">
                                <button onClick={() => printFormat('format-preview', preview.name)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black"><Printer className="w-4 h-4" /> Imprimir en blanco</button>
                                <button onClick={() => setPreview(null)} aria-label="Cerrar" className="p-2 text-slate-400"><X className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="overflow-auto p-4 sm:p-8 bg-slate-50"><div className="bg-white p-6 shadow-sm"><FormatDocument id="format-preview" spec={preview.spec} /></div></div>
                    </div>
                </div>
            )}
        </div>
    )
}
