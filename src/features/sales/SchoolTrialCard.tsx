import { Link } from 'react-router-dom'
import { ArrowRight, Gift } from 'lucide-react'
import { formatDateEs } from '../../components/ui/DateInput'
import { useSchoolTrial } from './useSchoolTrial'

/** Aviso en el inicio de la dirección: cuánto queda de la prueba y cómo pedir presupuesto. */
export const SchoolTrialCard = () => {
    const trial = useSchoolTrial()
    if (!trial || !trial.canManage) return null
    const over = trial.daysLeft <= 0
    const soon = !over && trial.daysLeft <= 7
    return (
        <section className={`rounded-3xl border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 ${over || soon ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'}`}>
            <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center ${over || soon ? 'bg-amber-100 text-amber-800' : 'bg-white text-indigo-600'}`}><Gift className="w-5 h-5" /></div>
            <div className="min-w-0 flex-1">
                <h2 className="font-black text-slate-900">
                    {over ? 'Tu mes de prueba terminó' : `Mes de prueba: ${trial.daysLeft === 1 ? 'queda 1 día' : `quedan ${trial.daysLeft} días`}`}
                </h2>
                <p className="text-sm text-slate-700 mt-0.5">
                    {over ? `Terminó el ${formatDateEs(trial.endsAt.slice(0, 10))}. ` : `Tu escuela usa todas las funciones hasta el ${formatDateEs(trial.endsAt.slice(0, 10))}. `}
                    El costo para escuelas depende del número de docentes y alumnos: solicita tu presupuesto y ventas te contactará.
                </p>
            </div>
            <Link to="/presupuesto" className="shrink-0 inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black">
                Solicitar presupuesto <ArrowRight className="w-4 h-4" />
            </Link>
        </section>
    )
}
