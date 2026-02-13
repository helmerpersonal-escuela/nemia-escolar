
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

    useEffect(() => {
        // Initialize Mercado Pago
        initMercadoPago(MP_PUBLIC_KEY, {
            locale: 'es-MX'
        })
    }, [])

    return (
        <div className="w-full max-w-md mx-auto">
            <div className={`transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0 h-48'}`}>
                {preferenceId && (
                    <Wallet
                        initialization={{ preferenceId: preferenceId }}
                        onReady={() => {
                            setIsReady(true)
                            onReady?.()
                        }}
                        onError={(error) => {
                            console.error("MP Brick Error:", error)
                            onError?.(error)
                        }}
                    />
                )}
            </div>

            {!isReady && (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium text-sm animate-pulse">Cargando módulo de pago seguro...</p>
                </div>
            )}
        </div>
    )
}
