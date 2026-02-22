import { useState, useEffect } from 'react'
import { useTrialStatus } from '../../../hooks/useTrialStatus'
import { Clock, AlertTriangle, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppMode } from '../../../hooks/useAppMode'
import { useProfile } from '../../../hooks/useProfile'

export const TrialNotificationSystem = () => {
    const { daysRemaining, isTrial, isExpired } = useTrialStatus()
    const { isAppMode } = useAppMode()
    const { profile } = useProfile()
    const [isVisible, setIsVisible] = useState(false)
    const [message, setMessage] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        if (!isTrial || isExpired || profile?.role?.toUpperCase() === 'TUTOR') return

        const checkNotification = () => {
            const today = new Date().toLocaleDateString()
            const lastShown = localStorage.getItem('vunlek_trial_last_shown')

            // Logic:
            // 1. If 10 days remaining: Show once
            // 2. If <= 5 days remaining: Show once per day

            let shouldShow = false
            let msg = ''

            if (daysRemaining === 10) {
                if (lastShown !== `10_days_${today}`) {
                    shouldShow = true
                    msg = 'Quedan 10 días de prueba. ¡Aprovecha al máximo todas las funciones!'
                    localStorage.setItem('vunlek_trial_last_shown', `10_days_${today}`)
                }
            } else if (daysRemaining <= 5 && daysRemaining > 0) {
                if (lastShown !== `daily_${today}`) {
                    shouldShow = true
                    msg = `Tu periodo de prueba termina en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}.`
                    localStorage.setItem('vunlek_trial_last_shown', `daily_${today}`)
                }
            }

            if (shouldShow) {
                setMessage(msg)
                setIsVisible(true)
            }
        }

        checkNotification()
    }, [daysRemaining, isTrial, isExpired])

    if (!isVisible) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#0A0A1F] border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 relative">
                <button
                    onClick={() => setIsVisible(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <Clock className="w-8 h-8 text-amber-500" />
                    </div>

                    <h3 className="text-xl font-black text-white uppercase italic tracking-tight mb-2">
                        Tu prueba está por terminar
                    </h3>

                    <p className="text-slate-300 text-sm font-medium mb-8 leading-relaxed">
                        {message} <br />
                        Asegura tu acceso continuado a Vunlek hoy mismo.
                    </p>

                    {isAppMode ? (
                        <div className="w-full py-4 bg-white/5 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-dashed border-white/10">
                            Gestionar suscripción desde Web
                        </div>
                    ) : (
                        <div className="flex gap-4 w-full">
                            <button
                                onClick={() => setIsVisible(false)}
                                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-widest transition-all"
                            >
                                Entendido
                            </button>
                            <button
                                onClick={() => {
                                    setIsVisible(false)
                                    navigate('/paywall')
                                }}
                                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 transition-all"
                            >
                                Ver Planes
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
