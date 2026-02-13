import { AnecdotalRecordForm } from '../components/AnecdotalRecordForm'
import { Sparkles, Layout } from 'lucide-react'

export const FormativeToolsPage = () => {
    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20">
            {/* Contextual Header */}
            <div className="max-w-6xl mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center space-x-2 text-indigo-600 font-black uppercase text-[10px] tracking-[0.3em] mb-3">
                            <Sparkles className="w-4 h-4" />
                            <span>Herramientas Pedagógicas</span>
                        </div>
                        <h1 className="text-5xl font-black text-gray-900 tracking-tight leading-none">
                            Evaluación <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Formativa</span>
                        </h1>
                    </div>
                    <p className="text-gray-500 font-medium max-w-md text-sm leading-relaxed">
                        Registra el progreso cualitativo de tus alumnos con instrumentos diseñados para la Nueva Escuela Mexicana.
                    </p>
                </div>

                <div className="space-y-16">
                    <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <AnecdotalRecordForm />
                    </section>

                    {/* Future placeholders */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section className="bg-white/50 backdrop-blur-sm rounded-[2rem] p-10 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center group hover:border-indigo-300 transition-all">
                            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-50 transition-colors">
                                <Layout className="w-6 h-6 text-gray-400 group-hover:text-indigo-500" />
                            </div>
                            <h3 className="font-black text-gray-400 uppercase text-xs tracking-widest group-hover:text-indigo-600 transition-colors">Lista de Cotejo</h3>
                            <p className="text-gray-400 text-[10px] mt-1 font-bold">PRÓXIMAMENTE</p>
                        </section>

                        <section className="bg-white/50 backdrop-blur-sm rounded-[2rem] p-10 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center group hover:border-rose-300 transition-all">
                            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-rose-50 transition-colors">
                                <Layout className="w-6 h-6 text-gray-400 group-hover:text-rose-500" />
                            </div>
                            <h3 className="font-black text-gray-400 uppercase text-xs tracking-widest group-hover:text-rose-600 transition-colors">Diario de Clase</h3>
                            <p className="text-gray-400 text-[10px] mt-1 font-bold">PRÓXIMAMENTE</p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
