import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ExternalLink, Search, RefreshCw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

export interface Textbook {
    id: string
    clave: string | null
    title: string
    level: string
    grade: number | null
    grades: number[] | null
    field_of_study: string | null
    reader_url: string | null
    thumbnail_url: string | null
    text_status: string
    synced_at: string | null
}

const LEVELS = [
    { id: 'PRIMARIA', label: 'Primaria', grades: [1, 2, 3, 4, 5, 6] },
    { id: 'SECUNDARIA', label: 'Secundaria', grades: [1, 2, 3] },
    { id: 'TELESECUNDARIA', label: 'Telesecundaria', grades: [1, 2, 3] },
]

const TENANT_LEVEL: Record<string, string> = { PRIMARY: 'PRIMARIA', SECONDARY: 'SECUNDARIA', TELESECUNDARIA: 'TELESECUNDARIA' }

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export const TextbooksPage = () => {
    const { data: tenant } = useTenant()
    const [level, setLevel] = useState<string>(TENANT_LEVEL[tenant?.educationalLevel ?? ''] ?? 'SECUNDARIA')
    const [grade, setGrade] = useState<number | 0>(0)
    const [field, setField] = useState('')
    const [query, setQuery] = useState('')

    const { data: books = [], isLoading, refetch, isFetching } = useQuery({
        queryKey: ['textbooks-catalog', level],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('textbooks')
                .select('id, clave, title, level, grade, grades, field_of_study, reader_url, thumbnail_url, text_status, synced_at')
                .eq('is_current', true)
                .eq('level', level)
                .order('grade')
                .order('title')
            if (error) throw error
            return (data ?? []) as Textbook[]
        },
        staleTime: 6 * 60 * 60 * 1000,
    })

    const fields = useMemo(() => [...new Set(books.map(b => b.field_of_study).filter(Boolean) as string[])].sort(), [books])
    const lastSync = useMemo(() => books.map(b => b.synced_at).filter(Boolean).sort().pop(), [books])

    const visible = books.filter(b =>
        (!grade || b.grade === grade || (b.grades ?? []).includes(grade)) &&
        (!field || b.field_of_study === field) &&
        (!query.trim() || normalize(b.title).includes(normalize(query.trim()))))

    const levelInfo = LEVELS.find(l => l.id === level)!

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">Libros de texto gratuitos · CONALITEG</p>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Biblioteca de libros oficiales</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Catálogo vigente sincronizado a diario desde el sitio oficial.
                        {lastSync && <> Última revisión: {new Date(lastSync).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.</>}
                    </p>
                </div>
                <button onClick={() => refetch()} className="self-start md:self-auto p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Actualizar">
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-4 flex flex-col lg:flex-row gap-3">
                <div className="flex gap-2 overflow-x-auto shrink-0">
                    {LEVELS.map(l => (
                        <button key={l.id} onClick={() => { setLevel(l.id); setGrade(0); setField('') }}
                            aria-pressed={level === l.id}
                            className={`min-h-11 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${level === l.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
                            {l.label}
                        </button>
                    ))}
                </div>
                <select value={grade} onChange={e => setGrade(Number(e.target.value))} className="min-h-11 border border-slate-200 rounded-xl px-3 py-2 text-sm" aria-label="Grado">
                    <option value={0}>Todos los grados</option>
                    {levelInfo.grades.map(g => <option key={g} value={g}>{g}° grado</option>)}
                </select>
                <select value={field} onChange={e => setField(e.target.value)} className="min-h-11 border border-slate-200 rounded-xl px-3 py-2 text-sm" aria-label="Campo formativo">
                    <option value="">Todos los campos / tipos</option>
                    {fields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <label className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3">
                    <Search className="w-4 h-4 text-slate-500" />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por título" aria-label="Buscar por título" className="flex-1 min-h-11 py-2 text-sm outline-none bg-transparent" />
                </label>
            </div>

            {isLoading ? (
                <p className="text-center text-sm text-slate-500 py-10">Cargando catálogo…</p>
            ) : visible.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-10">No hay libros con esos filtros.</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {visible.map(b => (
                        <a
                            key={b.id}
                            href={b.reader_url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all flex flex-col"
                        >
                            <div className="aspect-[3/4] bg-slate-100 overflow-hidden">
                                {b.thumbnail_url ? (
                                    <img src={b.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-10 h-10 text-slate-300" /></div>
                                )}
                            </div>
                            <div className="p-3 flex-1 flex flex-col">
                                <p className="text-xs font-bold text-slate-800 line-clamp-3">{b.title}</p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    {(b.grades?.length ?? 0) > 1 ? `${b.grades!.join('°, ')}°` : `${b.grade}°`} · {b.field_of_study ?? 'General'}
                                </p>
                                <span className="mt-auto pt-2 flex items-center gap-1 text-[11px] font-black text-indigo-600 uppercase tracking-widest">
                                    <ExternalLink className="w-3 h-3" /> Ver libro
                                </span>
                            </div>
                        </a>
                    ))}
                </div>
            )}
            <p className="text-[11px] text-slate-500 text-center">
                Los libros se abren en el lector oficial de CONALITEG. Sus PDF están protegidos por el editor, por lo que el sistema guarda solo el catálogo.
            </p>
        </div>
    )
}
