import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

type Row = { id: string; kind: 'PROMEDIOS' | 'ADEUDO' | 'BAJA' | 'ALTA' | 'NOTA'; school_year: string | null; grade_group: string | null; data: Record<string, any>; source: string | null }

const TITLE: Record<Row['kind'], string> = { PROMEDIOS: 'Promedios', ADEUDO: 'Materias adeudadas', BAJA: 'Baja', ALTA: 'Alta', NOTA: 'Anotación de la escuela' }

function describe(r: Row): string {
    const d = r.data ?? {}
    switch (r.kind) {
        case 'PROMEDIOS': return [d.t1 && `1.º ${d.t1}`, d.t2 && `2.º ${d.t2}`, d.t3 && `3.º ${d.t3}`, d.final && `Final ${d.final}`].filter(Boolean).join(' · ') || 'Sin datos'
        case 'ADEUDO': return [d.subjects, d.count && `${d.count} materia(s)`, d.status].filter(Boolean).join(' · ')
        case 'BAJA': case 'ALTA': return [d.type, d.date, d.report].filter(Boolean).join(' · ')
        case 'NOTA': return `${d.text ?? ''}${d.origin ? ` (${String(d.origin).toLowerCase()})` : ''}`
    }
}

/** Antecedentes que la escuela ya tenía (importados de sus archivos): promedios, adeudos, bajas y altas. */
export function StudentHistoryCard({ studentId }: { studentId: string }) {
    const [rows, setRows] = useState<Row[]>([])
    useEffect(() => {
        let alive = true
        supabase.from('student_history').select('id, kind, school_year, grade_group, data, source').eq('student_id', studentId).order('created_at')
            .then(({ data }) => { if (alive) setRows((data as Row[]) ?? []) })
        return () => { alive = false }
    }, [studentId])
    if (!rows.length) return null
    return (
        <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5">
            <h3 className="font-black text-slate-900 flex items-center gap-2"><History className="w-4 h-4 text-indigo-600" /> Antecedentes</h3>
            <ul className="mt-2 space-y-2">
                {rows.map(r => (
                    <li key={r.id} className="text-sm">
                        <span className="font-bold text-slate-800">{TITLE[r.kind]}</span>
                        {(r.school_year || r.grade_group) && <span className="text-slate-500"> · {[r.grade_group, r.school_year].filter(Boolean).join(' · ')}</span>}
                        <span className="block text-slate-600">{describe(r)}</span>
                    </li>
                ))}
            </ul>
        </section>
    )
}
