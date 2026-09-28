import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, Wand2, Loader2, Printer, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { FORMAT_KINDS, fillFormat, proposeFormat, setFormatChoice, useFormats, type FilledFormat, type FormatKind, type HeaderSource } from '../../lib/formats'
import { FormatDocument, printFormat } from './FormatDocument'

interface Props {
    kind: FormatKind
    /** Todo lo que la IA necesita para llenar el formato (texto plano). */
    material: string
    /** Datos del encabezado que ya se conocen (escuela, docente, grupo…). */
    known?: Partial<Record<Exclude<HeaderSource, null>, string>>
    title: string
    onUseDefault?: () => void
}

/**
 * Pregunta "¿cuentas con un formato?" y genera el documento con el formato del docente.
 * Si no tiene, ofrece subir el de su escuela, que la IA proponga uno o seguir con el de VUNLEK.
 */
export const MyFormatPanel = ({ kind, material, known = {}, title, onUseDefault }: Props) => {
    const { data: formats = [], isLoading } = useFormats(kind)
    const { data: tenant } = useTenant()
    const qc = useQueryClient()
    const [formatId, setFormatId] = useState<string>('')
    const [filled, setFilled] = useState<FilledFormat | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const current = formats.find(f => f.id === formatId) ?? formats[0]
    const label = FORMAT_KINDS.find(k => k.id === kind)?.label.toLowerCase()

    useEffect(() => { if (!formatId && formats[0]) setFormatId(formats[0].id) }, [formats, formatId])
    useEffect(() => { setFilled(null) }, [formatId])

    const generate = async () => {
        if (!current) return
        setBusy('Llenando tu formato…'); setError(null)
        try { setFilled(await fillFormat(current.spec, material, known)) }
        catch (e: any) { setError(e?.message || 'No se pudo generar el documento') }
        finally { setBusy(null) }
    }

    const propose = async () => {
        if (!tenant?.id) return
        setBusy('La IA está proponiendo un formato según los lineamientos de la SEP…'); setError(null)
        try {
            const level = tenant.educationalLevel === 'PRIMARY' ? 'primaria' : 'secundaria'
            const spec = await proposeFormat(kind, { level })
            const { data, error: e } = await supabase.from('teacher_formats').insert({ tenant_id: tenant.id, kind, source: 'AI', name: spec.title, spec, is_default: true }).select('id').single()
            if (e) throw e
            await qc.invalidateQueries({ queryKey: ['teacher-formats'] })
            setFormatId(data.id)
        } catch (e: any) { setError(e?.message || 'No se pudo proponer el formato') }
        finally { setBusy(null) }
    }

    if (isLoading) return <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>

    if (!formats.length) {
        return (
            <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
                <h3 className="text-lg font-black text-slate-900">¿Tu escuela te pide un formato de {label}?</h3>
                <p className="text-sm text-slate-500">Súbelo una vez y VUNLEK generará tus documentos con ese mismo formato. Si no tienes uno, la IA puede proponerte uno según los lineamientos de la SEP.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Link to={`/formatos?kind=${kind}`} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black"><FileUp className="w-4 h-4" /> Sí, subirlo</Link>
                    <button onClick={propose} disabled={!!busy} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 text-white text-sm font-black disabled:opacity-60"><Wand2 className="w-4 h-4" /> Que la IA lo proponga</button>
                    <button onClick={() => { setFormatChoice(kind, 'VUNLEK'); onUseDefault?.() }} className="px-4 py-3 rounded-2xl border border-slate-200 text-sm font-black text-slate-600">Usar el de VUNLEK</button>
                </div>
                {busy && <p className="text-sm font-bold text-indigo-700 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {busy}</p>}
                {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-slate-100 p-3">
                <select aria-label="Formato" value={current?.id} onChange={e => setFormatId(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold max-w-full">
                    {formats.map(f => <option key={f.id} value={f.id}>{f.name}{f.is_default ? ' (predeterminado)' : ''}</option>)}
                </select>
                <button onClick={generate} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-60">
                    {filled ? <RefreshCw className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />} {filled ? 'Volver a generar' : 'Generar con este formato'}
                </button>
                {filled && <button onClick={() => printFormat('my-format-doc', title)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-black"><Printer className="w-4 h-4" /> Imprimir / PDF</button>}
                <Link to={`/formatos?kind=${kind}`} className="ml-auto text-xs font-bold text-indigo-600">Administrar formatos</Link>
            </div>
            {busy && <p className="text-sm font-bold text-indigo-700 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {busy}</p>}
            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
            {current && (
                <div className="bg-white p-6 shadow-sm border border-slate-100 overflow-x-auto">
                    <FormatDocument id="my-format-doc" spec={current.spec} filled={filled} />
                </div>
            )}
        </div>
    )
}
