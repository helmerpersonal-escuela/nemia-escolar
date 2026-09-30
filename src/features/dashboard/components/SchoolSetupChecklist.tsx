import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ArrowRight, ChevronDown, FileUp, Wrench } from 'lucide-react'
import type { SchoolOverview } from '../lib/useSchoolOverview'

export type SetupStep = { done: boolean; label: string; to: string }

/** Orden de arranque: cada paso necesita los datos del anterior (ver manual de implementación). */
export function setupSteps(o: SchoolOverview): SetupStep[] {
    return [
        { done: true, label: 'Crear el espacio de la escuela (datos, logo, CCT)', to: '/settings?tab=school' },
        { done: o.hasPeriods, label: 'Ciclo escolar y periodos de evaluación', to: '/settings?tab=cycle' },
        { done: o.hasSchedule, label: 'Jornada escolar: entrada, salida, módulos y recesos', to: '/settings?tab=horarios' },
        { done: o.schoolControl > 0, label: 'Dar de alta a control escolar (inscribe a los alumnos)', to: '/settings?tab=personal' },
        { done: o.teachers > 0, label: 'Dar de alta a docentes, coordinación, prefectura y apoyo', to: '/settings?tab=personal' },
        { done: o.groups > 0, label: 'Crear los grupos (grado, grupo y turno)', to: '/groups' },
        { done: o.groupSubjects > 0 && o.subjectsWithoutTeacher === 0, label: 'Asignar materias y docente a cada grupo', to: '/groups' },
        { done: o.students > 0, label: 'Inscribir a los alumnos con sus tutores y teléfonos', to: '/groups' },
        { done: o.familiesLinked > 0, label: 'Entregar los códigos a las familias', to: '/familias/codigos' },
    ]
}

const StepList = ({ steps }: { steps: SetupStep[] }) => (
    <ol className="space-y-2">
        {steps.map((s, i) => (
            <li key={i}>
                <Link to={s.to} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${s.done ? 'border-emerald-100 bg-emerald-50/50 text-slate-500' : 'border-slate-200 bg-white hover:border-indigo-300 text-slate-900 font-semibold'}`}>
                    {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
                    <span className={`flex-1 ${s.done ? 'line-through' : ''}`}>{s.label}</span>
                    {!s.done && <ArrowRight className="w-4 h-4 text-indigo-600" />}
                </Link>
            </li>
        ))}
    </ol>
)

/** Lista completa, para quien hace el arranque (administrador técnico). */
export function SetupChecklist({ o }: { o: SchoolOverview }) {
    const steps = setupSteps(o)
    const done = steps.filter(s => s.done).length
    return (
        <section className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-indigo-100">
            <h2 className="text-lg font-black text-slate-900">Arranque de la escuela</h2>
            <p className="text-sm text-slate-500 mb-4">{done} de {steps.length} pasos listos. Cada paso usa los datos del anterior.</p>
            <Link to="/importar-datos" className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/60 p-3 text-sm text-indigo-900 hover:border-indigo-400">
                <FileUp className="w-5 h-5 shrink-0" />
                <span><b>¿La escuela ya tiene listas, directorios u horarios en Excel o Word?</b> Súbelos y VUNLEK llena grupos, alumnos, tutores, personal y horario de una vez.</span>
            </Link>
            <StepList steps={steps} />
        </section>
    )
}

/**
 * Versión de una línea para la dirección: el arranque lo atiende el administrador técnico,
 * así que aquí solo se ve el avance y, si se quiere, el detalle.
 */
export function SetupStatusLine({ o }: { o: SchoolOverview }) {
    const [open, setOpen] = useState(false)
    const steps = setupSteps(o)
    const done = steps.filter(s => s.done).length
    if (done === steps.length) return null
    const hasTech = o.systemAdmins > 0
    return (
        <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Wrench className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div className="min-w-0">
                        <p className="font-black text-slate-900">Arranque de la escuela: {done} de {steps.length}</p>
                        <p className="text-sm text-slate-500">
                            {hasTech ? 'Lo atiende el administrador técnico. Si necesitas un cambio, envíale una solicitud.' : 'Invita a un administrador técnico para que cargue los datos de la escuela y tú te enfoques en lo pedagógico.'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {hasTech
                        ? <Link to="/solicitudes" className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-2xl bg-indigo-50 text-indigo-800 text-sm font-bold hover:bg-indigo-100">Enviar solicitud</Link>
                        : <Link to="/settings?tab=personal" className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">Invitar al técnico</Link>}
                    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                        {open ? 'Ocultar' : 'Ver pasos'} <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
            {open && <div className="mt-4"><StepList steps={steps} /></div>}
        </section>
    )
}
