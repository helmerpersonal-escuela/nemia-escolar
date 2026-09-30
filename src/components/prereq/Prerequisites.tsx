import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ListChecks, ArrowRight, LifeBuoy, Lightbulb, Loader2 } from 'lucide-react'
import { useTenant } from '../../hooks/useTenant'
import { useSetupStatus } from '../../hooks/useSetupStatus'
import { canFix, missingSteps, requestLink, type StepDef, type StepId } from '../../lib/prerequisites'

/**
 * Aviso de "falta un paso": dice qué paso previo falta y ofrece ir a completarlo o cancelar.
 * Si la persona no puede hacer ese paso (p. ej. un docente), ofrece pedírselo al técnico.
 */
export function MissingStepDialog({ action, missing, role, onGo, onCancel }: {
    action: string; missing: StepDef[]; role: string; onGo: (path: string) => void; onCancel: () => void
}) {
    const first = missing[0]
    const mine = canFix(first, role)
    const goBtn = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        const t = setTimeout(() => goBtn.current?.focus(), 30)
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
        window.addEventListener('keydown', onKey)
        return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
    }, [onCancel])

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="prereq-title" aria-describedby="prereq-msg" onClick={e => e.stopPropagation()}
                className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-600"><ListChecks className="w-6 h-6" /></div>
                    <div className="min-w-0">
                        <h2 id="prereq-title" className="text-lg font-black text-slate-900">Falta un paso anterior</h2>
                        <p id="prereq-msg" className="text-sm text-slate-600 mt-1 leading-relaxed">
                            Para <b>{action}</b> primero hay que completar {missing.length === 1 ? 'este paso' : 'estos pasos, en este orden'}:
                        </p>
                    </div>
                </div>
                <ol className="mt-4 space-y-2">
                    {missing.map((s, i) => (
                        <li key={s.id} className={`rounded-2xl border p-3 ${i === 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                            <p className="font-bold text-slate-900 text-sm">Paso {s.number}: {s.label}</p>
                            <p className="text-xs text-slate-600">{s.why}</p>
                        </li>
                    ))}
                </ol>
                <p className="mt-4 flex items-start gap-2 text-xs text-slate-600 bg-indigo-50/60 rounded-2xl p-3">
                    <Lightbulb className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span><b>La regla de oro:</b> si un paso "no funciona", casi siempre falta algo del paso anterior.{!mine && ' Este paso lo completa la dirección, control escolar o el administrador técnico; puedes pedírselo desde aquí.'}</span>
                </p>
                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button type="button" onClick={onCancel} className="w-full sm:w-auto px-5 py-3 rounded-2xl text-sm font-black text-slate-700 bg-slate-100 hover:bg-slate-200">Cancelar</button>
                    <button ref={goBtn} type="button" onClick={() => onGo(mine ? first.path : requestLink(first, action))}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700">
                        {mine ? <>Ir al paso {first.number} <ArrowRight className="w-4 h-4" /></> : <><LifeBuoy className="w-4 h-4" /> Pedir que lo completen</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}

const useRole = () => {
    const { data: tenant } = useTenant()
    const type = (tenant as any)?.type
    const role = String((tenant as any)?.role || '').toUpperCase()
    return type === 'INDEPENDENT' && !['TUTOR', 'STUDENT', 'SUPER_ADMIN'].includes(role) ? 'INDEPENDENT_TEACHER' : role
}

/** Regresa a la pantalla anterior dentro de la app o, si se entró directo, al inicio. */
function useCancel() {
    const navigate = useNavigate()
    const location = useLocation()
    return () => (location.key !== 'default' ? navigate(-1) : navigate('/', { replace: true }))
}

/**
 * Envuelve una pantalla que necesita pasos previos. Si falta alguno, no la muestra (evita pantallas
 * "rotas" o vacías) y en su lugar explica qué falta, con la opción de ir a ese paso o cancelar.
 */
export function RequireSteps({ steps, action, children }: { steps: StepId[]; action: string; children: React.ReactNode }) {
    const { data: status, isLoading, isError } = useSetupStatus()
    const role = useRole()
    const navigate = useNavigate()
    const cancel = useCancel()
    if (isLoading) return <p className="flex items-center gap-2 text-slate-500 p-6"><Loader2 className="w-5 h-5 animate-spin" /> Revisando que todo esté listo…</p>
    // Si no se pudo revisar (sin conexión, por ejemplo), no se bloquea: la pantalla maneja su propio caso
    if (isError || !status) return <>{children}</>
    const missing = missingSteps(status, steps)
    if (!missing.length) return <>{children}</>
    return (
        <>
            <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-100 p-6 text-center text-slate-500 text-sm">Falta completar un paso anterior para {action}.</div>
            <MissingStepDialog action={action} missing={missing} role={role} onGo={p => navigate(p, { replace: true })} onCancel={cancel} />
        </>
    )
}

/**
 * Para botones: `if (!(await ensure(['ciclo'], 'crear un grupo'))) return`.
 * Si falta un paso muestra el aviso (renderiza `dialog` en tu componente) y regresa false.
 */
export function usePrerequisites() {
    const { refetch } = useSetupStatus()
    const role = useRole()
    const navigate = useNavigate()
    const [pending, setPending] = useState<{ action: string; missing: StepDef[] } | null>(null)
    const ensure = async (steps: StepId[], action: string) => {
        const { data } = await refetch()
        if (!data) return true
        const missing = missingSteps(data, steps)
        if (!missing.length) return true
        setPending({ action, missing })
        return false
    }
    const dialog = pending ? (
        <MissingStepDialog action={pending.action} missing={pending.missing} role={role}
            onGo={p => { setPending(null); navigate(p) }} onCancel={() => setPending(null)} />
    ) : null
    return { ensure, dialog }
}
