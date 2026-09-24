import { Link } from 'react-router-dom'

export const NotFoundPage = () => (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md text-center space-y-4">
            <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Error 404</p>
            <h1 className="text-3xl font-black text-slate-900">No encontramos esta página</h1>
            <p className="text-slate-600">Es posible que el enlace esté incompleto o que la página se haya movido.</p>
            <Link to="/" className="inline-flex items-center justify-center min-h-11 px-6 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                Volver al inicio
            </Link>
        </div>
    </main>
)
