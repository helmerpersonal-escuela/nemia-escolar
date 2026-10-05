import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { saveOrQueue } from '../../../lib/offline/outbox'
import { normalizeCode } from '../../../lib/cards'
import { CardListener, type ScanResult } from './CardListener'

type Student = { id: string; first_name: string; last_name_paternal: string; curp?: string | null }
type Assignment = { id: string; title: string }
type Row = { tenant_id: string; group_id: string; student_id: string; date: string; status: string; subject_id: string | null }

/**
 * Pase de lista (o entrega de una tarea) con credencial dentro de la libreta del docente:
 * cada alumno acerca su credencial y queda registrado al instante, sin tocar la pantalla.
 */
export function GradebookCardMode({ tenantId, groupId, subjectId, date, students, assignments, attendance, onAttendance }: {
    tenantId: string; groupId: string; subjectId: string | null; date: string
    students: Student[]; assignments: Assignment[]; attendance: { student_id: string; date: string; status: string }[]
    onAttendance: (rows: Row[], queued: boolean) => void
}) {
    const [what, setWhat] = useState<'ATTENDANCE' | 'HOMEWORK'>('ATTENDANCE')
    const [assignmentId, setAssignmentId] = useState('')
    const [codes, setCodes] = useState<Record<string, string>>({})
    const [delivered, setDelivered] = useState<Set<string>>(new Set())
    const marked = useRef<Set<string>>(new Set())

    // Código → alumno (credenciales del grupo; también se aceptan las credenciales anteriores con CURP)
    useEffect(() => {
        if (!students.length) return
        let alive = true
        supabase.rpc('ensure_card_tokens', { p_group: groupId }).then(async () => {
            const { data } = await supabase.from('student_cards').select('student_id, code').in('student_id', students.map(s => s.id))
            if (!alive) return
            const m: Record<string, string> = {}
            for (const s of students) {
                m[normalizeCode(s.id)] = s.id
                if (s.curp) m[normalizeCode(s.curp)] = s.id
            }
            for (const c of (data as { student_id: string; code: string }[]) ?? []) m[c.code] = c.student_id
            setCodes(m)
        })
        return () => { alive = false }
    }, [groupId, students])

    useEffect(() => {
        if (what !== 'HOMEWORK' || !assignmentId) { setDelivered(new Set()); return }
        supabase.from('grades').select('student_id, delivered_at, is_graded').eq('assignment_id', assignmentId)
            .then(({ data }) => setDelivered(new Set(((data as any[]) ?? []).filter(g => g.delivered_at || g.is_graded).map(g => g.student_id))))
    }, [what, assignmentId])

    const presentToday = useMemo(() => new Set(attendance.filter(a => a.date === date && ['PRESENT', 'LATE'].includes(a.status)).map(a => a.student_id)), [attendance, date])

    const onCode = useCallback(async (code: string): Promise<ScanResult> => {
        const id = codes[code]
        const s = students.find(x => x.id === id)
        if (!s) return { tone: 'bad', title: 'No es de este grupo', detail: 'Credencial no reconocida en la lista', notFound: true }
        const name = `${s.first_name} ${s.last_name_paternal}`

        if (what === 'ATTENDANCE') {
            if (presentToday.has(s.id) || marked.current.has(s.id)) return { tone: 'warn', title: name, detail: 'Ya estaba en la lista' }
            const row: Row = { tenant_id: tenantId, group_id: groupId, student_id: s.id, date, status: 'PRESENT', subject_id: subjectId }
            const { queued } = await saveOrQueue({
                table: 'attendance', op: 'upsert', rows: [row], onConflict: 'student_id,date,group_id,subject_id',
                dedupeKey: `attendance:${groupId}:${date}:${subjectId || ''}:${s.id}`, label: `Asistencia de ${name} (${date})`,
            })
            marked.current.add(s.id)
            onAttendance([row], queued)
            return { tone: 'ok', title: name, detail: queued ? 'Presente (se enviará al volver la señal)' : 'Presente' }
        }

        if (!assignmentId) return { tone: 'warn', title: 'Elige la tarea', detail: 'Selecciona arriba qué tarea se está entregando' }
        if (delivered.has(s.id)) return { tone: 'warn', title: name, detail: 'Ya había entregado' }
        const now = new Date().toISOString()
        const { data: existing } = await supabase.from('grades').select('id').eq('assignment_id', assignmentId).eq('student_id', s.id).maybeSingle()
        const { error } = existing
            ? await supabase.from('grades').update({ delivered_at: now }).eq('id', (existing as any).id)
            : await supabase.from('grades').insert({ tenant_id: tenantId, assignment_id: assignmentId, student_id: s.id, delivered_at: now, is_graded: false })
        if (error) return { tone: 'bad', title: name, detail: 'No se pudo registrar: ' + error.message }
        setDelivered(d => new Set(d).add(s.id))
        return { tone: 'ok', title: name, detail: 'Tarea entregada' }
    }, [codes, students, what, presentToday, tenantId, groupId, subjectId, date, assignmentId, delivered, onAttendance])

    const done = what === 'ATTENDANCE' ? students.filter(s => presentToday.has(s.id) || marked.current.has(s.id)).length : delivered.size
    const missing = students.filter(s => (what === 'ATTENDANCE' ? !(presentToday.has(s.id) || marked.current.has(s.id)) : !delivered.has(s.id)))

    return (
        <div className="w-full space-y-3 text-left">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-slate-50 p-1 rounded-2xl" role="radiogroup" aria-label="Qué registrar">
                    {([['ATTENDANCE', 'Asistencia'], ['HOMEWORK', 'Entrega de tarea']] as const).map(([id, label]) => (
                        <button key={id} type="button" role="radio" aria-checked={what === id} onClick={() => setWhat(id)}
                            className={`min-h-[40px] px-4 rounded-xl text-sm font-bold ${what === id ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{label}</button>
                    ))}
                </div>
                {what === 'HOMEWORK' && (
                    <select aria-label="Tarea que se entrega" value={assignmentId} onChange={e => setAssignmentId(e.target.value)} className="min-h-[44px] flex-1 min-w-[12rem] rounded-2xl border border-slate-200 px-3 text-sm font-bold bg-white">
                        <option value="">Elige la tarea o actividad…</option>
                        {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                )}
                <span className="ml-auto text-sm font-bold text-slate-700">{done} de {students.length}</span>
            </div>
            <CardListener onCode={onCode} title={what === 'ATTENDANCE' ? 'Pase de lista con credencial' : 'Entrega de tarea con credencial'} />
            {missing.length > 0 && done > 0 && (
                <details className="bg-white rounded-2xl border border-slate-100 p-3 text-sm">
                    <summary className="cursor-pointer font-bold text-slate-700">Faltan {missing.length}</summary>
                    <p className="mt-2 text-slate-600">{missing.map(s => `${s.first_name} ${s.last_name_paternal}`).join(' · ')}</p>
                </details>
            )}
        </div>
    )
}
