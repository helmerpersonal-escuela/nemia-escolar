import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../../lib/errorReporting'

interface Props {
    children: ReactNode
    /** Texto corto de dónde ocurrió (para el registro). */
    area?: string
}

interface State {
    error: Error | null
}

/** Evita la pantalla en blanco: muestra un aviso amable y registra el error. */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        reportError('render', error, { area: this.props.area, componentStack: info.componentStack?.slice(0, 1500) })
    }

    render() {
        if (!this.state.error) return this.props.children
        return (
            <div role="alert" className="min-h-[60vh] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl" aria-hidden="true">!</div>
                    <h1 className="text-xl font-black text-slate-900">Algo no salió bien</h1>
                    <p className="text-sm text-slate-600">
                        Esta pantalla tuvo un problema. Tus datos guardados no se perdieron. Intenta recargar; si se repite, avísanos.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="min-h-11 px-5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
                        >
                            Recargar
                        </button>
                        <button
                            type="button"
                            onClick={() => { window.location.href = '/' }}
                            className="min-h-11 px-5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
                        >
                            Ir al inicio
                        </button>
                    </div>
                    {import.meta.env.DEV && (
                        <pre className="text-left text-xs text-rose-700 bg-rose-50 rounded-xl p-3 overflow-auto max-h-40">{this.state.error.message}</pre>
                    )}
                </div>
            </div>
        )
    }
}
