import React from 'react';
import { X, AlertCircle, Copy, Check } from 'lucide-react';

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    details?: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    details
}) => {
    const [copied, setCopied] = React.useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        const textToCopy = `${title}\n${message}${details ? `\n\nDetalles:\n${details}` : ''}`;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-200 border border-red-100">
                {/* Header */}
                <div className="bg-red-50 p-6 flex justify-between items-center border-b border-red-100">
                    <div className="flex items-center">
                        <div className="bg-red-100 p-2 rounded-xl mr-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <h2 className="text-xl font-bold text-red-900">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-red-100 rounded-full transition-colors text-red-400 hover:text-red-900"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    <p className="text-gray-900 font-medium mb-4 select-text">
                        {message}
                    </p>

                    {details && (
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mt-4 relative">
                            <p className="text-xs font-mono text-gray-500 overflow-y-auto max-h-40 whitespace-pre-wrap select-text">
                                {details}
                            </p>
                            <button
                                onClick={handleCopy}
                                className="absolute top-2 right-2 p-2 bg-white rounded-lg shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors flex items-center text-xs font-bold text-gray-600"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-3 h-3 mr-1 text-green-600" />
                                        Copiado
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3 h-3 mr-1" />
                                        Copiar
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-8 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-95"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
