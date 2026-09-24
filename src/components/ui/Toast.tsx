import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: string
    type: ToastType
    message: string
    duration?: number
}

interface ToastContextType {
    showToast: (message: string, type: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const id = Math.random().toString(36).slice(2, 11)
        // Tiempo suficiente para leer: 4 s mínimo, +60 ms por carácter, máximo 12 s.
        duration = Math.max(duration ?? 0, Math.min(12000, 4000 + message.length * 60))
        setToasts(prev => [...prev, { id, message, type, duration }])

        setTimeout(() => {
            removeToast(id)
        }, duration)
    }, [removeToast])

    // Los alert() heredados (≈200 en el código) se muestran como avisos no bloqueantes.
    useEffect(() => {
        const nativeAlert = window.alert
        window.alert = (message?: unknown) => {
            const text = String(message ?? '')
            const type: ToastType = /error|no se pudo|fall[óo]|inv[aá]lid|no tienes|debes|requiere|obligatori|incorrect/i.test(text)
                ? 'error'
                : /[ée]xito|correctamente|guardad|listo|enviad|cread|actualizad/i.test(text) ? 'success' : 'info'
            showToast(text, type)
        }
        return () => { window.alert = nativeAlert }
    }, [showToast])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div
                aria-live="polite"
                className="fixed z-[100] flex flex-col gap-2 left-3 right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm lg:bottom-6 pointer-events-none"
            >
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        role={toast.type === 'error' ? 'alert' : 'status'}
                        className={`
                            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-bottom-4 sm:slide-in-from-right-full duration-300
                            ${toast.type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' :
                                toast.type === 'error' ? 'bg-white border-red-100 text-red-800' :
                                    toast.type === 'warning' ? 'bg-white border-amber-100 text-amber-800' :
                                        'bg-white border-blue-100 text-blue-800'}
                        `}
                    >
                        <div className={`p-1 rounded-full ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-700' :
                            toast.type === 'error' ? 'bg-red-100 text-red-600' :
                                toast.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                                    'bg-blue-100 text-blue-600'
                            }`}>
                            {toast.type === 'success' && <CheckCircle2 size={16} />}
                            {toast.type === 'error' && <AlertCircle size={16} />}
                            {toast.type === 'warning' && <AlertTriangle size={16} />}
                            {toast.type === 'info' && <Info size={16} />}
                        </div>
                        <p className="text-sm font-medium flex-1 whitespace-pre-line">{toast.message}</p>
                        <button
                            type="button"
                            onClick={() => removeToast(toast.id)}
                            aria-label="Cerrar aviso"
                            className="shrink-0 p-2 -m-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export const useToast = () => {
    const context = useContext(ToastContext)
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}
