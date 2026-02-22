
import { X, Type, Copy, Mic, Volume2, Minus, Plus, Printer } from 'lucide-react'
import { useState } from 'react'

type DictationModeModalProps = {
    isOpen: boolean
    onClose: () => void
    title: string
    content: string
}

export const DictationModeModal = ({ isOpen, onClose, title, content }: DictationModeModalProps) => {
    const [fontSize, setFontSize] = useState(24)
    const [isCopied, setIsCopied] = useState(false)

    if (!isOpen) return null

    const handleCopy = () => {
        navigator.clipboard.writeText(`${title}\n\n${content}`)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Parseamos el contenido para el documento impreso
        const sections = content.split('\n\n').map(section => {
            if (section.startsWith('**')) {
                const lines = section.split('\n');
                const sectionTitle = lines[0].replace(/\*\*/g, '');
                const sectionContent = lines.slice(1).join('<br>');
                return `
                    <div style="margin-top: 25pt; page-break-inside: avoid;">
                        <div style="font-size: 14pt; font-weight: bold; border-left: 5pt solid black; padding-left: 10pt; text-transform: uppercase;">
                            ${sectionTitle}
                        </div>
                        <div style="font-size: 12pt; margin-top: 10pt; line-height: 1.6;">
                            ${sectionContent}
                        </div>
                    </div>
                `;
            }
            return `<div style="font-size: 12pt; margin-top: 15pt; line-height: 1.6;">${section.replace(/\n/g, '<br>')}</div>`;
        }).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Impresión de Actividad</title>
                    <style>
                        body { 
                            font-family: 'Segoe UI', sans-serif; 
                            padding: 1.5cm; 
                            color: black; 
                            background: white;
                        }
                        h1 { 
                            font-size: 26pt; 
                            font-weight: 900; 
                            border-bottom: 2pt solid black; 
                            padding-bottom: 10pt; 
                            margin-bottom: 20pt;
                            text-transform: uppercase;
                        }
                        @media print {
                            body { padding: 0.5cm; }
                        }
                    </style>
                </head>
                <body>
                    <div style="font-size: 10pt; font-weight: bold; color: #666; margin-bottom: 5pt; text-transform: uppercase; letter-spacing: 2pt;">
                        Desafío / Actividad
                    </div>
                    <h1>${title}</h1>
                    ${sections}
                    <script>
                        window.onload = () => {
                            window.print();
                            window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full h-full flex flex-col p-6 md:p-12 text-white">
                {/* Header Controls */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 no-print">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-500/20">
                            <Mic className="w-8 h-8 text-white animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight uppercase leading-tight">Modo Dictado</h2>
                            <p className="text-indigo-300 font-bold uppercase tracking-widest text-[10px]">Identificación: {title}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 p-2 rounded-[2rem] border border-white/10">
                        {/* Font Size Controls */}
                        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-2xl mr-2">
                            <button
                                onClick={() => setFontSize(prev => Math.max(16, prev - 4))}
                                className="p-3 hover:bg-white/10 rounded-xl transition-all"
                            >
                                <Minus className="w-5 h-5" />
                            </button>
                            <div className="flex flex-col items-center px-2 min-w-[60px]">
                                <Type className="w-4 h-4 text-indigo-400 mb-0.5" />
                                <span className="text-[10px] font-black">{fontSize}px</span>
                            </div>
                            <button
                                onClick={() => setFontSize(prev => Math.min(64, prev + 4))}
                                className="p-3 hover:bg-white/10 rounded-xl transition-all"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>

                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all ${isCopied ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                        >
                            <Copy className="w-4 h-4" />
                            {isCopied ? 'Copiado' : 'Copiar'}
                        </button>

                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all bg-white/10 hover:bg-white/20 text-white no-print"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir
                        </button>

                        <button
                            onClick={onClose}
                            className="p-3 bg-white/10 hover:bg-rose-500 rounded-2xl transition-all group"
                        >
                            <X className="w-6 h-6 group-hover:scale-110" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar-white bg-white/5 rounded-[3rem] p-10 md:p-20 border border-white/5 shadow-inner">
                    <div className="max-w-4xl mx-auto space-y-12">
                        <div className="space-y-4">
                            <span className="inline-block px-4 py-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                                Desafío / Actividad
                            </span>
                            <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight uppercase">
                                {title}
                            </h1>
                        </div>

                        <div className="w-20 h-2 bg-indigo-500/50 rounded-full" />

                        <div
                            style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}
                            className="font-bold text-slate-100 whitespace-pre-wrap selection:bg-indigo-500/30"
                        >
                            {(() => {
                                const sections = content.split(/(?=\b(?:MISIÓN|ENTREGABLE|EVALUACIÓN|MISIÓ[Nn])[:\s*]*)/i)

                                return sections.map((section, idx) => {
                                    const trimmed = section.trim()
                                    if (!trimmed) return null

                                    let type = 'NORMAL'
                                    let label = ''
                                    let colorClass = ''
                                    let cleanText = trimmed

                                    // Robust detection with Regex
                                    if (/^\**MISIÓ[Nn]/i.test(trimmed)) {
                                        type = 'MISSION'
                                        label = 'MISIÓN'
                                        colorClass = 'text-indigo-400'
                                        cleanText = trimmed.replace(/^\**MISIÓ[Nn][:\s\*-]*/i, '').trim()
                                    } else if (/^\**ENTREGABLE/i.test(trimmed)) {
                                        type = 'DELIVERABLE'
                                        label = 'ENTREGABLE'
                                        colorClass = 'text-emerald-400'
                                        cleanText = trimmed.replace(/^\**ENTREGABLE[:\s\*-]*/i, '').trim()
                                    } else if (/^\**EVALUACIÓN/i.test(trimmed)) {
                                        type = 'EVALUATION'
                                        label = 'EVALUACIÓN'
                                        colorClass = 'text-amber-400'
                                        cleanText = trimmed.replace(/^\**EVALUACIÓ[Nn][:\s\*-]*/i, '').trim()
                                    }

                                    if (type !== 'NORMAL') {
                                        return (
                                            <div key={idx} className="mb-10 animate-in slide-in-from-left duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className={`h-8 w-1.5 rounded-full bg-current ${colorClass}`} />
                                                    <span className={`text-base font-black tracking-[0.3em] uppercase ${colorClass}`}>
                                                        {label}
                                                    </span>
                                                </div>
                                                <div className="pl-5 border-l border-white/10">
                                                    {cleanText}
                                                </div>
                                            </div>
                                        )
                                    }

                                    return <div key={idx} className="mb-6">{trimmed}</div>
                                })
                            })()}
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-8 flex justify-center">
                    <div className="flex items-center gap-4 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                        <Volume2 className="w-4 h-4" />
                        <span>Dicta pausadamente y confirma que todos los alumnos sigan el ritmo</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
