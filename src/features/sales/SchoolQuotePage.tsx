import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, GraduationCap, MessagesSquare, Users } from 'lucide-react'
import { SchoolQuoteForm } from './SchoolQuoteForm'

const STEPS = [
    { icon: Users, title: 'Nos cuentas de tu escuela', text: 'Cuántos docentes y alumnos tiene. Con eso estimamos el uso.' },
    { icon: MessagesSquare, title: 'Ventas te contacta', text: 'Te enviamos un presupuesto a la medida de tu escuela.' },
    { icon: CalendarCheck, title: 'Mientras tanto, pruébalo', text: 'Un mes con todas las funciones, sin costo y sin tarjeta.' },
]

/** Página pública: presupuesto para escuelas (no requiere cuenta). */
export const SchoolQuotePage = () => {
    const [sent, setSent] = useState(false)
    useEffect(() => { document.title = 'Presupuesto para escuelas · Vunlek'; window.scrollTo(0, 0) }, [])

    return (
        <div className="min-h-dvh bg-slate-50">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 font-black text-slate-900"><img src="/favicon.svg" alt="" className="w-8 h-8" /> Vunlek</Link>
                    <Link to="/login" className="min-h-11 inline-flex items-center px-4 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-50">Iniciar sesión</Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5"><GraduationCap className="w-4 h-4" /> Para escuelas</p>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">Un presupuesto a la medida de tu escuela</h1>
                    <p className="text-slate-600 mt-3 text-lg">El costo de VUNLEK para una escuela depende de cuántos docentes y alumnos la usarán. Déjanos tus datos y el equipo de ventas te contactará con una propuesta.</p>
                </div>

                <ol className="grid sm:grid-cols-3 gap-3">
                    {STEPS.map((s, i) => (
                        <li key={s.title} className="bg-white rounded-2xl border border-slate-200 p-4">
                            <div className="flex items-center gap-2 text-indigo-600"><s.icon className="w-5 h-5" /><span className="text-xs font-black">Paso {i + 1}</span></div>
                            <p className="font-black text-slate-900 mt-2">{s.title}</p>
                            <p className="text-sm text-slate-600 mt-1">{s.text}</p>
                        </li>
                    ))}
                </ol>

                <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-8">
                    <SchoolQuoteForm onSent={() => setSent(true)} />
                </section>

                <section className={`rounded-3xl border p-5 sm:p-6 ${sent ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200'}`}>
                    <h2 className={`font-black text-lg ${sent ? 'text-white' : 'text-slate-900'}`}>{sent ? '¿Quieres empezar hoy mismo?' : 'No tienes que esperar el presupuesto'}</h2>
                    <p className={`text-sm mt-1 ${sent ? 'text-indigo-100' : 'text-slate-600'}`}>Crea el espacio de tu escuela y usa todas las funciones durante un mes. Lo que captures se conserva cuando contrates.</p>
                    <Link to="/register" className={`mt-4 inline-flex items-center min-h-12 px-6 rounded-2xl text-sm font-black ${sent ? 'bg-white text-indigo-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>Crear mi escuela y empezar la prueba</Link>
                </section>
            </main>
        </div>
    )
}
