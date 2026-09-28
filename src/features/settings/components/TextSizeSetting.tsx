import { useEffect, useState } from 'react'
import { Type, Check } from 'lucide-react'
import { SettingsCard } from './SettingsUI'
import { getTextSize, setTextSize, onTextSizeChange, TEXT_SIZE_OPTIONS, type TextSize } from '../../../lib/textSize'

const PREVIEW: Record<TextSize, string> = { normal: 'text-base', lg: 'text-lg', xl: 'text-xl' }

/** Selector de tamaño de letra. Se aplica al instante y se recuerda en este dispositivo. */
export function TextSizeSetting() {
    const [size, setSize] = useState<TextSize>(getTextSize())
    useEffect(() => onTextSizeChange(setSize), [])

    return (
        <SettingsCard icon={Type} title="Tamaño de letra" hint="Si te cuesta leer, elige una letra más grande. Se aplica de inmediato y se guarda en este dispositivo (no necesita el botón Guardar).">
            <div role="radiogroup" aria-label="Tamaño de letra" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TEXT_SIZE_OPTIONS.map(opt => {
                    const active = size === opt.value
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setTextSize(opt.value)}
                            className={`relative flex items-center sm:flex-col sm:items-start gap-3 sm:gap-1 rounded-2xl border-2 p-4 text-left transition-colors ${active ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}
                        >
                            <span className={`font-bold text-gray-900 ${PREVIEW[opt.value]}`}>Aa</span>
                            <span className="flex-1">
                                <span className="block font-semibold text-gray-900">{opt.label}</span>
                                <span className="block text-xs text-gray-500">{opt.hint}</span>
                            </span>
                            {active && <Check className="w-5 h-5 text-blue-600 sm:absolute sm:top-3 sm:right-3" />}
                        </button>
                    )
                })}
            </div>
        </SettingsCard>
    )
}
