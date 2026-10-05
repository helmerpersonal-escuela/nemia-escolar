import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Combine, X } from 'lucide-react'
import { useTenant, useWorkspaces } from '../../hooks/useTenant'

const STAFF = ['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT']

/** Invita al docente que tiene espacio personal y acaba de sumarse a una escuela a traer su información. */
export function MergeWorkspaceBanner() {
    const { data: tenant } = useTenant()
    const { data: workspaces } = useWorkspaces()
    const { pathname } = useLocation()
    const id = (tenant as any)?.id as string | undefined
    const key = `vunlek_suma_${id}`
    const [hidden, setHidden] = useState(false)
    let stored: string | null = null
    try { stored = id ? localStorage.getItem(key) : null } catch { /* nada */ }
    const hasPersonal = (workspaces ?? []).some(w => String(w.type).toUpperCase() === 'INDEPENDENT')
    if (!id || hidden || stored || !hasPersonal || (tenant as any)?.type !== 'SCHOOL' || !STAFF.includes(String((tenant as any)?.role).toUpperCase()) || pathname !== '/') return null
    const dismiss = () => { try { localStorage.setItem(key, 'despues') } catch { /* nada */ } setHidden(true) }
    return (
        <div className="mb-6 flex items-start gap-3 rounded-3xl border-2 border-indigo-100 bg-white p-4">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-2xl shrink-0"><Combine className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
                <p className="font-black text-slate-900">¿Ya usabas VUNLEK por tu cuenta?</p>
                <p className="text-sm text-slate-600">Suma a la escuela tus grupos, alumnos, planeaciones y asistencia para no capturar dos veces. Solo se agrega; nada se borra.</p>
                <Link to="/sumar-mi-espacio" className="mt-2 inline-flex items-center min-h-[44px] px-4 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700">Revisar y sumar</Link>
            </div>
            <button type="button" onClick={dismiss} aria-label="Ahora no" className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
    )
}
