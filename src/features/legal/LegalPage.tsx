import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PrivacyContent } from '../../components/auth/PrivacyModal'
import { TermsContent } from '../../components/auth/TermsModal'

type Kind = 'privacy' | 'terms'

const META: Record<Kind, { title: string; other: { to: string; label: string } }> = {
    privacy: { title: 'Política de Privacidad', other: { to: '/terminos', label: 'Términos y Condiciones' } },
    terms: { title: 'Términos y Condiciones de Uso', other: { to: '/privacidad', label: 'Política de Privacidad' } },
}

/** Páginas públicas (sin iniciar sesión) de los documentos legales. */
export const LegalPage = ({ kind }: { kind: Kind }) => {
    const meta = META[kind]
    useEffect(() => {
        document.title = `${meta.title} · Vunlek`
        window.scrollTo(0, 0)
    }, [meta.title])

    return (
        <div className="min-h-dvh bg-slate-50">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 font-black text-slate-900">
                        <img src="/favicon.svg" alt="" className="w-8 h-8" />
                        Vunlek
                    </Link>
                    <Link to="/login" className="min-h-11 inline-flex items-center px-4 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-50">
                        Iniciar sesión
                    </Link>
                </div>
            </header>
            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
                <h1 className="text-3xl font-black text-slate-900 mb-6">{meta.title}</h1>
                <article className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 text-[15px] text-slate-700 leading-relaxed space-y-4">
                    {kind === 'privacy' ? <PrivacyContent /> : <TermsContent />}
                </article>
                <nav className="mt-8 flex flex-wrap gap-4 text-sm font-bold">
                    <Link to={meta.other.to} className="text-indigo-700 hover:underline">{meta.other.label}</Link>
                    <Link to="/" className="text-slate-600 hover:underline">Volver al inicio</Link>
                </nav>
            </main>
        </div>
    )
}
