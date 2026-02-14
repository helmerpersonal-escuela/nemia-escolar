
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react'
import { useEffect, useState } from 'react'

// Initialize MP with Public Key (from env)
// Note: In a real app, this should be outside the component or in a context
// to avoid re-initializing on every render, but SDK handles it gracefully.
const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY || 'TEST-00000000-0000-0000-0000-000000000000' // Fail-safe default


interface PaymentModuleProps {
    preferenceId: string
    onReady?: () => void
    onError?: (error: any) => void
}


export const PaymentModule = ({ preferenceId, onReady, onError }: PaymentModuleProps) => {
    const [isReady, setIsReady] = useState(false)
    const [timedOut, setTimedOut] = useState(false)

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>
        if (!isReady && preferenceId) {
            timeout = setTimeout(() => {
                setTimedOut(true)
            }, 8000) // 8 seconds timeout
        }
        return () => clearTimeout(timeout)
    }, [isReady, preferenceId])

    useEffect(() => {
        if (preferenceId) {
            console.log("Initializing MP with Key:", MP_PUBLIC_KEY.substring(0, 10) + "...")
            initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-MX' })
        }
    }, [preferenceId])

    if (timedOut && !isReady) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="text-slate-900 font-bold">No se pudo cargar el pago</h3>
                <p className="text-slate-500 text-sm">
                    Hubo un problema conectando con Mercado Pago.
                    <br /> Verifica tu conexión o intenta de nuevo.
                </p>
                <div className="text-xs font-mono bg-slate-100 p-2 rounded text-slate-400 max-w-xs break-all">
                    Ref: {preferenceId?.substring(0, 15)}...
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors"
                >
                    Recargar Página
                </button>
            </div>
        )
    }

    return (
        <div className="w-full max-w-md mx-auto min-h-[200px] flex flex-col justify-center">
            <div className={`transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                {preferenceId && (
                    <Wallet
                        initialization={{ preferenceId: preferenceId }}
                        onReady={() => {
                            console.log("MP Wallet Ready")
                            setIsReady(true)
                            onReady?.()
                        }}
                        onError={(error) => {
                            console.error("MP Brick Error:", error)
                            setTimedOut(true) // Show error UI
                            onError?.(error)
                        }}
                    />
                )}
            </div>

            {!isReady && !timedOut && (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium text-sm animate-pulse">Cargando pasarela de pago...</p>
                    <p className="text-xs text-slate-400">Espere un momento, por favor.</p>
                </div>
            )}
        </div>
    )
}
