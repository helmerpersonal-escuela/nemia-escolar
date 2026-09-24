import { useCallback, useEffect, useState } from 'react'
import { Upload, FileText, Trash2, Download, ClipboardPaste, ExternalLink } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import { extractFileText, fileKind } from '../lib/docText'
import {
    CTE_PORTAL_URL, DOCUMENT_KIND_LABEL, sessionLabel,
    type CteDocument, type CteSession, type DocumentKind,
} from '../lib/cteApi'

const MAX_BYTES = 20 * 1024 * 1024
const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,image/png,image/jpeg'

interface Props {
    tenantId: string
    sessions: CteSession[]
    defaultSessionId: string | null
}

const safeName = (name: string) =>
    name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)

export const DocumentsPanel = ({ tenantId, sessions, defaultSessionId }: Props) => {
    const { showToast } = useToast()
    const [docs, setDocs] = useState<CteDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [kind, setKind] = useState<DocumentKind>('GUIA_OFICIAL')
    const [sessionId, setSessionId] = useState<string>(defaultSessionId ?? '')
    const [pasteMode, setPasteMode] = useState(false)
    const [pasteTitle, setPasteTitle] = useState('')
    const [pasteText, setPasteText] = useState('')
    const [preview, setPreview] = useState<CteDocument | null>(null)

    const load = useCallback(async () => {
        const { data, error } = await supabase
            .from('cte_documents')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
        if (error) showToast('No se pudieron cargar los insumos.', 'error')
        setDocs((data ?? []) as CteDocument[])
        setLoading(false)
    }, [tenantId, showToast])

    useEffect(() => { load() }, [load])

    const upload = async (file: File) => {
        if (file.size > MAX_BYTES) { showToast('El archivo supera 20 MB.', 'warning'); return }
        setBusy(true)
        try {
            let text = ''
            try {
                text = await extractFileText(file)
            } catch (e) {
                console.warn('Sin texto extraíble', e)
            }
            const path = `${tenantId}/${crypto.randomUUID()}-${safeName(file.name)}`
            const { error: upErr } = await supabase.storage.from('cte_documents').upload(path, file, { contentType: file.type || undefined })
            if (upErr) throw upErr
            const { error } = await supabase.from('cte_documents').insert({
                tenant_id: tenantId,
                session_id: sessionId || null,
                kind,
                title: file.name.replace(/\.[^.]+$/, ''),
                storage_path: path,
                mime_type: file.type || null,
                size_bytes: file.size,
                extracted_text: text || null,
            })
            if (error) {
                await supabase.storage.from('cte_documents').remove([path])
                throw error
            }
            const k = fileKind(file)
            showToast(text
                ? `Insumo guardado (${text.length.toLocaleString('es-MX')} caracteres de texto para la IA).`
                : k === 'image' ? 'Imagen guardada. La IA no lee imágenes: agrega un resumen con "Pegar texto".'
                    : 'Archivo guardado, pero no se pudo leer su texto. Puedes pegarlo con "Pegar texto".', text ? 'success' : 'warning', 6000)
            load()
        } catch (e) {
            console.error(e)
            showToast('No se pudo subir el archivo.', 'error')
        } finally {
            setBusy(false)
        }
    }

    const savePasted = async () => {
        if (!pasteTitle.trim() || !pasteText.trim()) return
        setBusy(true)
        const { error } = await supabase.from('cte_documents').insert({
            tenant_id: tenantId, session_id: sessionId || null, kind, title: pasteTitle.trim(),
            extracted_text: pasteText.trim().slice(0, 200_000), mime_type: 'text/plain', size_bytes: pasteText.length,
        })
        setBusy(false)
        if (error) { showToast('No se pudo guardar el texto.', 'error'); return }
        setPasteMode(false); setPasteTitle(''); setPasteText('')
        load()
    }

    const download = async (d: CteDocument) => {
        if (!d.storage_path) return
        const { data, error } = await supabase.storage.from('cte_documents').createSignedUrl(d.storage_path, 120)
        if (error || !data) { showToast('No se pudo abrir el archivo.', 'error'); return }
        window.open(data.signedUrl, '_blank', 'noopener')
    }

    const remove = async (d: CteDocument) => {
        if (!window.confirm(`¿Eliminar "${d.title}"?`)) return
        if (d.storage_path) await supabase.storage.from('cte_documents').remove([d.storage_path])
        const { error } = await supabase.from('cte_documents').delete().eq('id', d.id)
        if (error) { showToast('No se pudo eliminar.', 'error'); return }
        setDocs(prev => prev.filter(x => x.id !== d.id))
    }

    const sessionName = (id: string | null) => {
        const s = sessions.find(x => x.id === id)
        return s ? sessionLabel(s) : 'General'
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h2 className="font-black text-slate-900">Subir insumos</h2>
                        <p className="text-xs text-slate-500">
                            Guías oficiales, presentaciones, actas y evidencias. El texto se guarda para que la IA lo tome en cuenta.
                            El portal de la SEP no permite descargas automáticas: descarga la guía y súbela aquí.
                        </p>
                    </div>
                    <a href={CTE_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-indigo-600 whitespace-nowrap">
                        <ExternalLink className="w-3.5 h-3.5" /> Portal de insumos CTE
                    </a>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select value={kind} onChange={e => setKind(e.target.value as DocumentKind)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" aria-label="Tipo de insumo">
                        {Object.entries(DOCUMENT_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" aria-label="Sesión">
                        <option value="">General (todas las sesiones)</option>
                        {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)} · {s.date}</option>)}
                    </select>
                    <div className="flex gap-2">
                        <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer ${busy ? 'bg-slate-200 text-slate-500' : 'bg-indigo-600 text-white'}`}>
                            <Upload className="w-4 h-4" /> {busy ? 'Procesando…' : 'Subir archivo'}
                            <input
                                type="file"
                                accept={ACCEPT}
                                className="hidden"
                                disabled={busy}
                                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }}
                            />
                        </label>
                        <button onClick={() => setPasteMode(v => !v)} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700">
                            <ClipboardPaste className="w-4 h-4" /> Pegar texto
                        </button>
                    </div>
                </div>
                {pasteMode && (
                    <div className="space-y-2">
                        <input value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} placeholder="Título (p. ej. Guía 2ª sesión ordinaria)" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                        <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={8} placeholder="Pega aquí el contenido" className="w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm" />
                        <div className="flex justify-end">
                            <button onClick={savePasted} disabled={busy || !pasteTitle.trim() || !pasteText.trim()} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">Guardar texto</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 divide-y divide-slate-100">
                {loading && <p className="p-6 text-sm text-slate-500">Cargando…</p>}
                {!loading && docs.length === 0 && <p className="p-6 text-sm text-slate-500">Aún no hay insumos.</p>}
                {docs.map(d => (
                    <div key={d.id} className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{d.title}</p>
                            <p className="text-xs text-slate-500">
                                {DOCUMENT_KIND_LABEL[d.kind]} · {sessionName(d.session_id)} ·{' '}
                                {d.extracted_text ? `${d.extracted_text.length.toLocaleString('es-MX')} caracteres para IA` : 'sin texto'}
                            </p>
                        </div>
                        {d.extracted_text && (
                            <button onClick={() => setPreview(d)} className="text-xs font-bold text-slate-500 hover:text-indigo-600">Ver texto</button>
                        )}
                        {d.storage_path && (
                            <button onClick={() => download(d)} className="p-2 text-slate-500 hover:text-indigo-600" aria-label="Descargar"><Download className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => remove(d)} className="p-2 text-slate-500 hover:text-rose-500" aria-label="Eliminar"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>

            {preview && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
                    <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-900 truncate">{preview.title}</h3>
                            <button onClick={() => setPreview(null)} className="text-sm font-bold text-slate-500">Cerrar</button>
                        </div>
                        <pre className="p-5 overflow-auto text-xs text-slate-700 whitespace-pre-wrap font-sans">{preview.extracted_text}</pre>
                    </div>
                </div>
            )}
        </div>
    )
}
