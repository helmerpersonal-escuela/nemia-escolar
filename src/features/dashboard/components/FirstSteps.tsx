import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Rocket, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'

/**
 * "Primeros pasos": guía para docentes con poca experiencia en sistemas.
 * Muestra en orden lo que falta para empezar a trabajar, con un botón para hacerlo.
 * Desaparece sola cuando todo está listo (o si el docente la oculta).
 */

interface Step { id: string; title: string; why: string; action: string; to: string; done: boolean }

const count = async (q: any) => { const { count: c } = await q; return c ?? 0 }

export function FirstSteps() {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()
    const profile = useProfile()?.profile
    const profileId = (profile as any)?.id as string | undefined
    const tenantId = tenant?.id
    const independent = (tenant as any)?.type === 'INDEPENDENT'
    const hideKey = `vunlek_first_steps_hidden:${tenantId}`
    const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(hideKey) === '1' } catch { return false } })

    const { data: steps } = useQuery({
        queryKey: ['first-steps', tenantId, profileId],
        enabled: !!tenantId && !!profileId && !hidden,
        staleTime: 60_000,
        queryFn: async (): Promise<Step[]> => {
            const t = tenantId!, p = profileId!
            // Grupos del docente: en su espacio propio, todos; en una escuela, los asignados a él
            const { data: myGroupRows } = independent
                ? await supabase.from('groups').select('id').eq('tenant_id', t).is('archived_at', null)
                : await supabase.from('group_subjects').select('group_id').eq('tenant_id', t).eq('teacher_id', p)
            const groupIds = [...new Set(((myGroupRows ?? []) as any[]).map(r => r.id ?? r.group_id).filter(Boolean))]

            const [subjects, programs, students, plans, attendance, school] = await Promise.all([
                count(supabase.from('profile_subjects').select('id', { count: 'exact', head: true }).eq('profile_id', p).eq('tenant_id', t)),
                count(supabase.from('analytical_programs').select('id', { count: 'exact', head: true }).eq('tenant_id', t)),
                groupIds.length ? count(supabase.from('students').select('id', { count: 'exact', head: true }).in('group_id', groupIds)) : Promise.resolve(0),
                groupIds.length ? count(supabase.from('lesson_plans').select('id', { count: 'exact', head: true }).in('group_id', groupIds)) : Promise.resolve(0),
                groupIds.length ? count(supabase.from('attendance').select('id', { count: 'exact', head: true }).in('group_id', groupIds)) : Promise.resolve(0),
                supabase.from('school_details').select('address_state').eq('tenant_id', t).maybeSingle(),
            ])

            const list: Step[] = []
            if (independent) list.push({ id: 'school', title: 'Completa los datos de tu escuela', why: 'Aparecen en tus planeaciones y documentos.', action: 'Completar', to: '/settings?tab=school', done: !!(school as any)?.data?.address_state })
            list.push({ id: 'subjects', title: 'Registra las materias que impartes', why: 'Con ellas se arma tu programa analítico y tus planeaciones.', action: 'Registrar materias', to: '/settings?tab=subjects', done: subjects > 0 })
            if (independent) list.push({ id: 'groups', title: 'Crea tu primer grupo', why: 'Por ejemplo, 1° A. Ahí vivirán tu lista y calificaciones.', action: 'Crear grupo', to: '/groups', done: groupIds.length > 0 })
            else list.push({ id: 'groups', title: 'Revisa tus grupos asignados', why: 'La dirección te asigna los grupos y materias. Si no ves ninguno, pídelo.', action: 'Ver mis grupos', to: '/groups', done: groupIds.length > 0 })
            if (independent) list.push({ id: 'students', title: 'Agrega a tus alumnos', why: 'Uno por uno o todos juntos desde un archivo de Excel.', action: 'Agregar alumnos', to: groupIds[0] ? `/groups/${groupIds[0]}` : '/groups', done: students > 0 })
            list.push({ id: 'program', title: 'Elabora tu programa analítico', why: 'La IA te ayuda paso a paso; se hace una vez por ciclo.', action: 'Empezar', to: '/analytical-program', done: programs > 0 })
            list.push({ id: 'plan', title: 'Crea tu primera planeación', why: 'Toma los contenidos de tu programa analítico y te propone el título.', action: 'Planear', to: '/planning/new', done: plans > 0 })
            list.push({ id: 'attendance', title: 'Pasa lista por primera vez', why: 'Un toque por alumno. Funciona aunque no haya señal.', action: 'Pasar lista', to: '/gradebook?tab=ATTENDANCE', done: attendance > 0 })
            return list
        },
    })

    if (hidden || !steps) return null
    const doneCount = steps.filter(s => s.done).length
    if (doneCount === steps.length) return null
    const next = steps.find(s => !s.done)!
    const pct = Math.round((doneCount / steps.length) * 100)

    const hide = () => { try { localStorage.setItem(hideKey, '1') } catch { /* nada */ } setHidden(true) }

    return (
        <section aria-labelledby="primeros-pasos" className="rounded-[2rem] border border-indigo-100 bg-white shadow-sm p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-600 text-white flex items-center justify-center"><Rocket className="w-5 h-5" /></div>
                    <div className="min-w-0">
                        <h2 id="primeros-pasos" className="text-lg font-black text-slate-900 leading-tight">Primeros pasos</h2>
                        <p className="text-sm text-slate-500">{doneCount} de {steps.length} listos. Sigue el orden y en unos minutos estarás trabajando.</p>
                    </div>
                </div>
                <button type="button" onClick={hide} aria-label="Ocultar primeros pasos" className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="h-2 rounded-full bg-slate-100 overflow-hidden my-4" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance">
                <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>

            <ol className="space-y-2">
                {steps.map((s, i) => {
                    const isNext = s.id === next.id
                    return (
                        <li key={s.id} className={`rounded-2xl border p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 ${isNext ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-100'}`}>
                            <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${s.done ? 'bg-emerald-600 text-white' : isNext ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {s.done ? <Check className="w-4 h-4" /> : i + 1}
                            </span>
                            <div className="flex-1 min-w-[10rem]">
                                <p className={`text-sm font-black ${s.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{s.title}</p>
                                {!s.done && <p className="text-xs text-slate-500 mt-0.5">{s.why}</p>}
                            </div>
                            {!s.done && (
                                <button type="button" onClick={() => navigate(s.to)}
                                    className={`w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl text-sm sm:text-xs font-black ${isNext ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-indigo-700 hover:bg-indigo-50'}`}>
                                    {s.action} <ChevronRight className="w-4 h-4" />
                                </button>
                            )}
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
