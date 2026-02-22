import { useState, useEffect } from 'react'
import { Fingerprint, CheckCircle2, ShieldAlert } from 'lucide-react'

interface BiometricScannerMockProps {
    onScanSuccess: (studentId: string) => void
    students?: any[]
    onClose: () => void
}

export const BiometricScannerMock = ({ onScanSuccess, students = [], onClose }: BiometricScannerMockProps) => {
    const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR'>('IDLE')
    const [scannedStudent, setScannedStudent] = useState<any>(null)

    const simulateScan = () => {
        if (status === 'SCANNING') return

        setStatus('SCANNING')

        // Simulate a 2.5 second scan
        setTimeout(() => {
            if (students.length > 0) {
                // Randomly pick a student for the mock, or just the first one if you want it predictable
                const randomStudent = students[Math.floor(Math.random() * students.length)]
                setScannedStudent(randomStudent)
                setStatus('SUCCESS')

                // Call success handler after showing success screen briefly
                setTimeout(() => {
                    onScanSuccess(randomStudent.id)
                    // Reset for next scan
                    setStatus('IDLE')
                    setScannedStudent(null)
                }, 1500)
            } else {
                setStatus('ERROR')
                setTimeout(() => setStatus('IDLE'), 2000)
            }
        }, 2500)
    }

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto p-8 bg-white rounded-3xl shadow-xl border border-slate-100 animate-in fade-in zoom-in duration-300 relative">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full transition-colors"
                disabled={status === 'SCANNING'}
            >
                ✕
            </button>

            <div className="text-center mb-8">
                <h3 className="text-xl font-black text-slate-800">Verificación Biométrica</h3>
                <p className="text-sm text-slate-500 mt-1">Coloque su huella en el lector</p>
            </div>

            <button
                onClick={simulateScan}
                disabled={status === 'SCANNING' || status === 'SUCCESS'}
                className={`
                    relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500
                    ${status === 'IDLE' ? 'bg-slate-50 shadow-[inset_0px_0px_20px_rgba(0,0,0,0.05)] text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 cursor-pointer' : ''}
                    ${status === 'SCANNING' ? 'bg-indigo-600 text-white shadow-[0_0_40px_rgba(79,70,229,0.5)] scale-110 cursor-wait' : ''}
                    ${status === 'SUCCESS' ? 'bg-emerald-500 text-white shadow-[0_0_40px_rgba(16,185,129,0.5)] scale-110' : ''}
                    ${status === 'ERROR' ? 'bg-rose-500 text-white shadow-[0_0_40px_rgba(244,63,94,0.5)] animate-shake' : ''}
                `}
            >
                {/* Fingerprint Icon Container */}
                <div className="relative z-10 flex flex-col items-center justify-center space-y-2">
                    {status === 'SUCCESS' ? (
                        <CheckCircle2 className="w-16 h-16 animate-in zoom-in" />
                    ) : status === 'ERROR' ? (
                        <ShieldAlert className="w-16 h-16 animate-in zoom-in" />
                    ) : (
                        <Fingerprint className={`w-16 h-16 transition-colors duration-500 ${status === 'SCANNING' ? 'animate-pulse' : ''}`} />
                    )}
                </div>

                {/* Scanning Animation Rings */}
                {status === 'SCANNING' && (
                    <>
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-400 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-20"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-300 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-10"></div>

                        {/* Scanning Line */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/50 blur-[1px] rounded-full animate-[scan_2s_ease-in-out_infinite]" style={{
                            boxShadow: '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.4)',
                            top: '10%'
                        }}></div>
                    </>
                )}
            </button>

            <div className="mt-8 h-12 flex items-center justify-center text-center">
                {status === 'IDLE' && <span className="text-sm font-bold text-slate-400">Esperando lectura...</span>}
                {status === 'SCANNING' && <span className="text-sm font-bold text-indigo-600 animate-pulse">Analizando minucias...</span>}
                {status === 'SUCCESS' && scannedStudent && (
                    <div className="animate-in slide-in-from-bottom-2 fade-in flex flex-col items-center">
                        <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Identidad Confirmada</span>
                        <span className="text-sm font-bold text-slate-800">{scannedStudent.first_name} {scannedStudent.last_name_paternal}</span>
                    </div>
                )}
                {status === 'ERROR' && <span className="text-sm font-bold text-rose-500 group-hover:block">Huella no reconocida</span>}
            </div>

            <style>{`
                @keyframes scan {
                    0% { top: 10%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 90%; opacity: 0; }
                }
            `}</style>
        </div>
    )
}
