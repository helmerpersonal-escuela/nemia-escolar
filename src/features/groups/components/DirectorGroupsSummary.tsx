import { useMemo, useState } from 'react'
import { Users, School, Search, ArrowRight } from 'lucide-react'

type SummaryGroup = {
    id: string
    grade: string | number
    section: string
    shift?: string
    students?: Array<{ count: number }>
}

const countOf = (g: SummaryGroup) => g.students?.[0]?.count || 0

const gradeColor: Record<string, string> = {
    '1': 'bg-blue-100 text-blue-700 border-blue-200',
    '2': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    '3': 'bg-violet-100 text-violet-700 border-violet-200',
}

/**
 * Resumen de grupos para dirección y personal directivo:
 * totales de la escuela, desglose por grado y acceso rápido a un grupo.
 */
export const DirectorGroupsSummary = ({ groups, onSelect }: {
    groups: SummaryGroup[]
    onSelect: (groupId: string) => void
}) => {
    const [query, setQuery] = useState('')
    const [notFound, setNotFound] = useState(false)

    const byGrade = useMemo(() => {
        const map = new Map<string, SummaryGroup[]>()
        for (const g of groups) {
            const k = String(g.grade)
            if (!map.has(k)) map.set(k, [])
            map.get(k)!.push(g)
        }
        return [...map.entries()]
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([grade, list]) => ({
                grade,
                groups: list.sort((a, b) => a.section.localeCompare(b.section)),
                students: list.reduce((s, g) => s + countOf(g), 0),
            }))
    }, [groups])

    const totalStudents = groups.reduce((s, g) => s + countOf(g), 0)

    // Acepta "2B", "2 B", "2°B", "2° b"
    const goTo = (e: React.FormEvent) => {
        e.preventDefault()
        const m = query.trim().toUpperCase().match(/^(\d+)\s*°?\s*"?([A-Z]+)"?$/)
        const found = m && groups.find(g => String(g.grade) === m[1] && g.section.toUpperCase() === m[2])
        if (found) {
            setNotFound(false)
            setQuery('')
            onSelect(found.id)
        } else {
            setNotFound(true)
        }
    }

    return (
        <div className="space-y-6">
            {/* Totales de la escuela */}
            <div className="grid grid-cols-2 gap-4">
                <div className="squishy-card bg-white p-5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-indigo-100 text-indigo-700"><School className="w-6 h-6" /></div>
                    <div>
                        <p className="text-3xl font-black text-gray-900 leading-none">{groups.length}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-1">Grupos</p>
                    </div>
                </div>
                <div className="squishy-card bg-white p-5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-100 text-blue-700"><Users className="w-6 h-6" /></div>
                    <div>
                        <p className="text-3xl font-black text-gray-900 leading-none">{totalStudents}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-1">Alumnos en la escuela</p>
                    </div>
                </div>
            </div>

            {/* Ir directo a un grupo */}
            <form onSubmit={goTo} className="squishy-card bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <label htmlFor="go-group" className="text-sm font-black text-gray-700 flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-500" /> Abrir grupo
                </label>
                <input
                    id="go-group"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setNotFound(false) }}
                    placeholder='Escribe grado y grupo, p. ej. 2B'
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="submit" className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">Abrir</button>
                {notFound && <p className="text-sm text-rose-600 font-bold">No existe ese grupo.</p>}
            </form>

            {/* Desglose por grado: toca un grupo para abrirlo */}
            <div className="space-y-4">
                {byGrade.map(row => (
                    <div key={row.grade} className="squishy-card bg-white p-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                            <h3 className="text-2xl font-black text-gray-900">{row.grade}° grado</h3>
                            <p className="text-sm font-bold text-gray-500">
                                {row.groups.length} {row.groups.length === 1 ? 'grupo' : 'grupos'} · {row.students} alumnos
                            </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {row.groups.map(g => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => onSelect(g.id)}
                                    className={`group text-left p-4 rounded-2xl border-2 hover:shadow-lg active:scale-95 transition-all ${gradeColor[row.grade] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                                >
                                    <p className="text-2xl font-black leading-none">{g.grade}° {g.section}</p>
                                    <p className="text-xs font-bold mt-2 opacity-80 flex items-center justify-between">
                                        {countOf(g)} alumnos
                                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
