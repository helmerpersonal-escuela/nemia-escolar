import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EyeOff, Eye, Loader2, Search, Landmark } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { CAMPOS_FORMATIVOS, phaseFor, useCatalogActions, useHiddenItems } from '../../../lib/nemCatalog'

interface OfficialPda { id: string, phase: number, field_of_study: string, subject_name: string | null, content: string, grade: number | null, pda: string }

/** Hook: PDAs oficiales de la fase del docente, sin los que ocultó (salvo que se pida verlos). */
export function useOfficialPdas(opts: { phase?: number | null, campo?: string, includeHidden?: boolean } = {}) {
    const { data: tenant } = useTenant()
    const phase = opts.phase ?? phaseFor(tenant?.educationalLevel, (tenant as any)?.grade)
    const { data: hidden } = useHiddenItems()
    const q = useQuery({
        queryKey: ['official-pdas', phase],
        enabled: !!phase,
        staleTime: 60 * 60_000,
        queryFn: async () => {
            const { data, error } = await supabase.from('official_pdas').select('id, phase, field_of_study, subject_name, content, grade, pda').eq('phase', phase!).order('field_of_study').order('subject_name').order('content').order('grade').limit(5000)
            if (error) throw error
            return (data ?? []) as OfficialPda[]
        },
    })
    const rows = (q.data ?? []).filter(r => (!opts.campo || r.field_of_study === opts.campo) && (opts.includeHidden || !hidden?.has(`PDA:${r.id}`)))
    return { ...q, rows, phase, hidden }
}

export const OfficialPdasSection = () => {
    const { data: tenant } = useTenant()
    const [campo, setCampo] = useState('')
    const [grade, setGrade] = useState<number | ''>('')
    const [subject, setSubject] = useState('')
    const [search, setSearch] = useState('')
    const [showHidden, setShowHidden] = useState(false)
    const { rows, isLoading, phase, hidden } = useOfficialPdas({ campo: campo || undefined, includeHidden: true })
    const { hide, restore } = useCatalogActions()

    const subjects = useMemo(() => [...new Set(rows.map(r => r.subject_name).filter(Boolean) as string[])].sort(), [rows])
    const grades = tenant?.educationalLevel === 'PRIMARY' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]
    const hiddenCount = rows.filter(r => hidden?.has(`PDA:${r.id}`)).length

    const visible = useMemo(() => {
        const t = search.trim().toLowerCase()
        return rows.filter(r => {
            const isHidden = hidden?.has(`PDA:${r.id}`)
            if (showHidden ? !isHidden : isHidden) return false
            if (grade !== '' && r.grade !== grade) return false
            if (subject && r.subject_name !== subject) return false
            return !t || `${r.content} ${r.pda}`.toLowerCase().includes(t)
        })
    }, [rows, hidden, showHidden, grade, subject, search])

    // Agrupa por contenido
    const groups = useMemo(() => {
        const m = new Map<string, OfficialPda[]>()
        for (const r of visible) {
            const k = `${r.field_of_study}|${r.subject_name ?? ''}|${r.content}`
            m.set(k, [...(m.get(k) ?? []), r])
        }
        return [...m.entries()].slice(0, 150)
    }, [visible])

    return (
        <section className="space-y-4">
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5" /> Programa sintético SEP{phase ? ` · Fase ${phase}` : ''}</p>
                <h2 className="text-xl font-black text-slate-900">PDAs oficiales</h2>
                <p className="text-sm text-slate-500 max-w-2xl">Los que fija la autoridad educativa para cada campo formativo. Oculta los que no trabajarás: dejarán de aparecer al planear y al crear instrumentos (puedes restaurarlos).</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[12rem]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contenido o PDA…" aria-label="Buscar PDA oficial" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-100 text-sm" />
                </div>
                <select aria-label="Campo formativo" value={campo} onChange={e => { setCampo(e.target.value); setSubject('') }} className="px-3 py-2.5 rounded-xl bg-white border border-slate-100 text-sm font-bold text-slate-600 max-w-full">
                    <option value="">Todos los campos</option>
                    {CAMPOS_FORMATIVOS.map(c => <option key={c}>{c}</option>)}
                </select>
                {subjects.length > 0 && (
                    <select aria-label="Disciplina" value={subject} onChange={e => setSubject(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-slate-100 text-sm font-bold text-slate-600 max-w-full">
                        <option value="">Todas las disciplinas</option>
                        {subjects.map(s => <option key={s}>{s}</option>)}
                    </select>
                )}
                <select aria-label="Grado" value={grade} onChange={e => setGrade(e.target.value === '' ? '' : Number(e.target.value))} className="px-3 py-2.5 rounded-xl bg-white border border-slate-100 text-sm font-bold text-slate-600">
                    <option value="">Todos los grados</option>
                    {grades.map(g => <option key={g} value={g}>{g}°</option>)}
                </select>
                <button onClick={() => setShowHidden(v => !v)} aria-pressed={showHidden} className={`px-3 py-2.5 rounded-xl text-sm font-bold border ${showHidden ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-slate-100 text-slate-600'}`}>
                    {showHidden ? 'Ver activos' : `Ocultos (${hiddenCount})`}
                </button>
            </div>

            {isLoading ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-7 h-7 text-indigo-400 animate-spin" /></div>
            ) : !phase ? (
                <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-100 p-5">Configura el nivel educativo (y el grado en primaria) en Ajustes para ver los PDAs oficiales de tu fase.</p>
            ) : groups.length === 0 ? (
                <p className="text-sm text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                    {rows.length === 0 ? 'Aún no se cargan los PDAs oficiales de tu fase. Mientras tanto puedes crear los tuyos abajo.' : showHidden ? 'No tienes PDAs oficiales ocultos.' : 'Sin resultados con esos filtros.'}
                </p>
            ) : (
                <div className="space-y-3">
                    {groups.map(([k, items]) => (
                        <article key={k} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
                            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{items[0].field_of_study}{items[0].subject_name ? ` · ${items[0].subject_name}` : ''}</p>
                            <p className="text-sm font-black text-slate-900 mt-1">{items[0].content}</p>
                            <ul className="mt-2 space-y-2">
                                {items.map(r => (
                                    <li key={r.id} className="flex items-start gap-3">
                                        {r.grade && <span className="shrink-0 text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 mt-0.5">{r.grade}°</span>}
                                        <p className="text-sm text-slate-600 flex-1">{r.pda}</p>
                                        {showHidden ? (
                                            <button onClick={() => restore('PDA', r.id)} aria-label="Restaurar PDA" title="Restaurar" className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 shrink-0"><Eye className="w-4 h-4" /></button>
                                        ) : (
                                            <button onClick={() => hide('PDA', r.id)} aria-label="Ocultar PDA" title="Quitar de mis listas" className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"><EyeOff className="w-4 h-4" /></button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))}
                    {visible.length > 0 && groups.length >= 150 && <p className="text-xs text-slate-500 text-center">Mostrando los primeros 150 contenidos; usa los filtros para acotar.</p>}
                </div>
            )}
        </section>
    )
}
