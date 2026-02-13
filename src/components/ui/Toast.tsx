import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
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

    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
        const id = Math.random().toString(36).substr(2, 9)
        setToasts(prev => [...prev, { id, message, type, duration }])

        setTimeout(() => {
            removeToast(id)
        }, duration)
    }, [removeToast])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-right-full duration-300
                            ${toast.type === 'success' ? 'bg-white border-emerald-100 text-emerald-800' :
                                toast.type === 'error' ? 'bg-white border-red-100 text-red-800' :
                                    toast.type === 'warning' ? 'bg-white border-amber-100 text-amber-800' :
                                        'bg-white border-blue-100 text-blue-800'}
                        `}
                    >
                        <div className={`p-1 rounded-full ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                            toast.type === 'error' ? 'bg-red-100 text-red-600' :
                                toast.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                    'bg-blue-100 text-blue-600'
                            }`}>
                            {toast.type === 'success' && <CheckCircle2 size={16} />}
                            {toast.type === 'error' && <AlertCircle size={16} />}
                            {toast.type === 'warning' && <AlertTriangle size={16} />}
                            {toast.type === 'info' && <Info size={16} />}
                        </div>
                        <p className="text-sm font-medium pr-4">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
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
