import { useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Loader2, Paperclip } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export interface EvidenceFile { path: string; name: string; type: string; uploaded_at: string }
export const asEvidence = (v: unknown): EvidenceFile[] => Array.isArray(v) ? (v as EvidenceFile[]).filter(f => f && typeof f.path === 'string') : []

const BUCKET = 'school_evidence'
const MAX = 8 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/**
 * Evidencias de un registro (fotos o PDF). Se guardan en una carpeta privada de la escuela;
 * solo el personal puede abrirlas. No se pueden borrar desde aquí: la bitácora conserva lo registrado.
 */
export const EvidenceBox = ({ tenantId, folder, value, onChange, disabled }: { tenantId: string; folder: string; value: EvidenceFile[]; onChange: (v: EvidenceFile[]) => Promise<void> | void; disabled?: boolean }) => {
    const input = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const upload = async (files: FileList | null) => {
        if (!files?.length) return
        setError(''); setBusy(true)
        const added: EvidenceFile[] = []
        for (const file of Array.from(files)) {
            if (!ALLOWED.includes(file.type)) { setError(`«${file.name}» no es una foto ni un PDF.`); continue }
            if (file.size > MAX) { setError(`«${file.name}» pesa más de 8 MB.`); continue }
            const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'dat'
            const path = `${tenantId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
            const { error: e } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
            if (e) { setError(`No se pudo subir «${file.name}»: ${e.message}`); continue }
            added.push({ path, name: file.name, type: file.type, uploaded_at: new Date().toISOString() })
        }
        if (added.length) await onChange([...value, ...added])
        setBusy(false)
        if (input.current) input.current.value = ''
    }

    const open = async (f: EvidenceFile) => {
        const { data, error: e } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 300)
        if (e || !data) return setError('No se pudo abrir el archivo.')
        window.open(data.signedUrl, '_blank', 'noopener')
    }

    return (
        <div className="space-y-2">
            {value.length === 0 ? <p className="text-sm text-slate-500">Sin evidencias.</p> : (
                <ul className="grid sm:grid-cols-2 gap-2">
                    {value.map(f => (
                        <li key={f.path}>
                            <button type="button" onClick={() => open(f)} className="w-full flex items-center gap-2 border border-slate-200 rounded-2xl px-3 py-2 text-left hover:border-indigo-300 hover:bg-indigo-50/40">
                                {f.type === 'application/pdf' ? <FileText className="w-4 h-4 text-slate-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />}
                                <span className="text-sm font-bold text-slate-800 truncate flex-1">{f.name}</span>
                                <span className="text-xs text-slate-500 shrink-0">{new Date(f.uploaded_at).toLocaleDateString('es-MX')}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {error && <p role="alert" className="text-sm font-bold text-rose-700 bg-rose-50 rounded-xl px-3 py-2">{error}</p>}
            {!disabled && (
                <>
                    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={e => upload(e.target.files)} />
                    <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />} Agregar foto o PDF
                    </button>
                    <p className="text-xs text-slate-500">Evita fotos donde se vea la cara de alumnos si no es necesario. Máximo 8 MB por archivo.</p>
                </>
            )}
        </div>
    )
}
