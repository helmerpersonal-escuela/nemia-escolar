import React from 'react'
import { Briefcase } from 'lucide-react'

interface ErrorModalProps {
    isOpen: boolean
    title: string
    message: string
    buttonText?: string
    action?: () => void
    onClose: () => void
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
    isOpen,
    title,
    message,
    buttonText,
    action,
    onClose
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                    <Briefcase className="w-8 h-8 text-amber-700" />
                </div>
                <h3 className="text-xl font-black text-gray-900 text-center mb-2">{title}</h3>
                <p className="text-gray-500 text-center text-sm leading-relaxed mb-8">
                    {message}
                </p>
                <button
                    onClick={() => {
                        if (action) action()
                        else onClose()
                    }}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-widest"
                >
                    {buttonText || 'Continuar'}
                </button>
            </div>
        </div>
    )
}
