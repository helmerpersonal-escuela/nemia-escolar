import type { ReactNode, ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

type Action = { label: string; to?: string; onClick?: () => void; icon?: ComponentType<{ className?: string }> }

/**
 * Pantalla vacía que orienta: dice qué falta, por qué importa y cuál es el siguiente paso.
 * Pensada para docentes con poca experiencia: un solo botón principal, texto sencillo.
 */
export function EmptyState({
    icon: Icon, title, description, action, secondary, steps, compact, children,
}: {
    icon?: ComponentType<{ className?: string }>
    title: string
    description?: ReactNode
    action?: Action
    secondary?: Action
    /** Pasos cortos opcionales: "1. Crea el grupo  2. Agrega alumnos…" */
    steps?: string[]
    compact?: boolean
    children?: ReactNode
}) {
    return (
        <div className={`text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 mx-auto max-w-2xl ${compact ? 'p-5' : 'px-5 py-10 sm:p-12'}`}>
            {Icon && (
                <div className={`mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center ${compact ? 'w-11 h-11 mb-3' : 'w-16 h-16 mb-5'}`}>
                    <Icon className={compact ? 'w-5 h-5' : 'w-8 h-8'} />
                </div>
            )}
            <h3 className={`font-bold text-slate-900 ${compact ? 'text-base' : 'text-xl'}`}>{title}</h3>
            {description && <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed">{description}</p>}
            {steps && steps.length > 0 && (
                <ol className="mt-5 max-w-sm mx-auto text-left space-y-2">
                    {steps.map((s, i) => (
                        <li key={i} className="flex gap-3 text-sm text-slate-700">
                            <span className="w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                            <span className="pt-0.5">{s}</span>
                        </li>
                    ))}
                </ol>
            )}
            {children}
            {(action || secondary) && (
                <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 ${compact ? 'mt-4' : 'mt-7'}`}>
                    {action && <ActionButton a={action} primary />}
                    {secondary && <ActionButton a={secondary} />}
                </div>
            )}
        </div>
    )
}

function ActionButton({ a, primary }: { a: Action; primary?: boolean }) {
    const Icon = a.icon ?? (primary ? ArrowRight : undefined)
    const cls = primary
        ? 'inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700'
        : 'inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50'
    const content = <>{a.icon && Icon && <Icon className="w-4 h-4" />}{a.label}{!a.icon && primary && Icon && <Icon className="w-4 h-4" />}</>
    if (a.to) return <Link to={a.to} className={cls}>{content}</Link>
    return <button type="button" onClick={a.onClick} className={cls}>{content}</button>
}
