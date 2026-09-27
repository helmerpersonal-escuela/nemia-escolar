import type { ComponentType, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react'

/**
 * Sistema de diseño único para asistentes paso a paso (wizards).
 *
 * Reglas:
 *  - Un solo color de acento (índigo) en todos los pasos; los estados usan verde (listo),
 *    ámbar (aviso) y rojo (error) solo para mensajes.
 *  - Tipografía: título de página text-2xl/3xl font-black; título de paso text-xl font-black;
 *    sin cursivas ni MAYÚSCULAS forzadas.
 *  - Progreso: pasos numerados con etiqueta (en celular: "Paso X de N" + barra).
 *  - Navegación: "Anterior" (secundario, izquierda) y acción principal (derecha).
 *    En celular la barra queda fija abajo, por encima del menú inferior.
 *  - Campos: WizardField + clases wizardInput / wizardChoice.
 */

export interface WizardStep { label: string; icon?: ComponentType<{ className?: string }> }

export const wizardInput =
    'w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition'

export const wizardChoice = (selected: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left text-sm font-bold transition active:scale-[0.99] ${selected
        ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`

export const Radio = ({ checked }: { checked: boolean }) => (
    <span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${checked ? 'border-indigo-600' : 'border-slate-300'}`}>
        {checked && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
    </span>
)

export const WizardProgress = ({ steps, current, onStepClick, freeNavigation, className = 'mb-6' }: { steps: WizardStep[]; current: number; onStepClick?: (i: number) => void; freeNavigation?: boolean; className?: string }) => {
    const pct = Math.round(((current + 1) / steps.length) * 100)
    // Con muchos pasos solo se muestra la etiqueta del paso actual (las demás van en el tooltip)
    const compact = steps.length > 5
    return (
        <nav aria-label="Progreso" className={className}>
            {/* Celular */}
            <div className="sm:hidden">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                    <span>Paso {current + 1} de {steps.length}</span>
                    {freeNavigation && onStepClick ? (
                        <span className="flex gap-1">
                            {steps.map((s, i) => (
                                <button key={s.label} type="button" onClick={() => onStepClick(i)} aria-current={i === current ? 'step' : undefined}
                                    className={`px-2 py-0.5 rounded-lg ${i === current ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{s.label}</button>
                            ))}
                        </span>
                    ) : <span className="text-indigo-700">{steps[current]?.label}</span>}
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
            </div>
            {/* Tableta y computadora */}
            <ol className="hidden sm:flex items-center gap-2">
                {steps.map((s, i) => {
                    const done = i < current
                    const active = i === current
                    const clickable = !!onStepClick && (done || (freeNavigation && !active))
                    return (
                        <li key={s.label} className={`flex items-center gap-2 min-w-0 last:flex-none ${compact && active ? 'flex-[2]' : 'flex-1'}`}>
                            <button
                                type="button"
                                disabled={!clickable}
                                onClick={() => clickable && onStepClick?.(i)}
                                aria-current={active ? 'step' : undefined}
                                title={s.label}
                                className={`flex items-center gap-2 min-w-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-black transition ${done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                                    {done ? <Check className="w-4 h-4" /> : i + 1}
                                </span>
                                {(!compact || active) && <span className={`text-xs font-bold truncate ${active ? 'text-slate-900' : done ? 'text-indigo-700' : 'text-slate-400'}`}>{s.label}</span>}
                            </button>
                            {i < steps.length - 1 && <span className={`flex-1 h-0.5 min-w-4 rounded-full ${done ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}

export const WizardStepHeader = ({ icon: Icon, title, description }: { icon?: ComponentType<{ className?: string }>; title: string; description?: ReactNode }) => (
    <div className="flex items-start gap-4 mb-6">
        {Icon && (
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Icon className="w-6 h-6" />
            </div>
        )}
        <div className="min-w-0">
            <h2 className="text-xl font-black text-slate-900 leading-tight">{title}</h2>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
        </div>
    </div>
)

export const WizardField = ({ label, hint, required, children, className = '' }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string }) => (
    <label className={`block ${className}`}>
        <span className="block text-xs font-black text-slate-600 mb-1.5">
            {label}{required && <span className="text-rose-500"> *</span>}
        </span>
        {children}
        {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
)

export const WizardAlert = ({ tone = 'error', children }: { tone?: 'error' | 'info' | 'warning' | 'success'; children: ReactNode }) => {
    const styles = {
        error: 'bg-rose-50 border-rose-100 text-rose-700',
        info: 'bg-indigo-50 border-indigo-100 text-indigo-800',
        warning: 'bg-amber-50 border-amber-100 text-amber-800',
        success: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    }[tone]
    return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border px-4 py-3 text-sm font-medium ${styles}`}>{children}</div>
}

interface FooterProps {
    onBack?: () => void
    backLabel?: string
    onNext?: () => void
    nextLabel?: string
    nextIcon?: ComponentType<{ className?: string }>
    nextDisabled?: boolean
    loading?: boolean
    tone?: 'primary' | 'success'
    extra?: ReactNode
    /** En celular, fija la barra abajo (por encima del menú inferior de la app). */
    sticky?: boolean
}

export const WizardFooter = ({ onBack, backLabel = 'Anterior', onNext, nextLabel = 'Siguiente', nextIcon: NextIcon = ArrowRight, nextDisabled, loading, tone = 'primary', extra, sticky = true }: FooterProps) => (
    <div className={`${sticky ? 'fixed sm:static left-0 right-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-0 z-30 bg-white/95 backdrop-blur border-t border-slate-100 sm:border-0 sm:bg-transparent px-4 py-3 sm:p-0' : ''} sm:mt-6`}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            {onBack ? (
                <button type="button" onClick={onBack} disabled={loading} className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-black text-slate-600 hover:bg-slate-100 disabled:opacity-40">
                    <ArrowLeft className="w-4 h-4" /> {backLabel}
                </button>
            ) : <span />}
            <div className="flex items-center gap-2">
                {extra}
                {onNext && (
                    <button type="button" onClick={onNext} disabled={nextDisabled || loading}
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black text-white shadow-lg transition disabled:opacity-40 disabled:shadow-none ${tone === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'}`}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {nextLabel}
                        {!loading && <NextIcon className="w-4 h-4" />}
                    </button>
                )}
            </div>
        </div>
    </div>
)

interface LayoutProps {
    eyebrow?: string
    title: string
    subtitle?: ReactNode
    steps: WizardStep[]
    current: number
    onStepClick?: (i: number) => void
    children: ReactNode
    footer?: ReactNode
    /** Ancho del contenido: 'md' (formularios) o 'lg' (tablas, catálogos). */
    width?: 'md' | 'lg'
    headerAction?: ReactNode
}

/** Página completa de asistente: encabezado, progreso, tarjeta del paso y navegación. */
export const WizardLayout = ({ eyebrow, title, subtitle, steps, current, onStepClick, children, footer, width = 'md', headerAction }: LayoutProps) => (
    <div className={`${width === 'lg' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-3 sm:px-4 py-6 sm:py-10 pb-32 sm:pb-10`}>
        <header className="mb-6 flex items-start justify-between gap-3">
            <div className="min-w-0">
                {eyebrow && <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600 mb-1">{eyebrow}</p>}
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
                {subtitle && <p className="text-sm sm:text-base text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {headerAction}
        </header>
        <WizardProgress steps={steps} current={current} onStepClick={onStepClick} />
        <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 sm:p-8 relative">
            {children}
        </section>
        {footer}
    </div>
)

/** Capa de "guardando" para el contenido del asistente. */
export const WizardSaving = ({ label = 'Guardando…' }: { label?: string }) => (
    <div className="absolute inset-0 z-20 rounded-[2rem] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-600">{label}</p>
    </div>
)

/** Encabezado estándar de asistentes en ventana (modal): título, subtítulo, cerrar y progreso. */
export const WizardModalHeader = ({ title, subtitle, icon: Icon, onClose, steps, current, action }: {
    title: string; subtitle?: ReactNode; icon?: ComponentType<{ className?: string }>; onClose: () => void
    steps?: WizardStep[]; current?: number; action?: ReactNode
}) => (
    <div className="shrink-0 border-b border-slate-100">
        <div className="px-5 sm:px-6 pt-5 pb-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
                {Icon && <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></div>}
                <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{title}</h2>
                    {subtitle && <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>}
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {action}
                <button type="button" aria-label="Cerrar" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
        </div>
        {steps && current != null && <div className="px-5 sm:px-6"><WizardProgress steps={steps} current={current} className="mb-4" /></div>}
    </div>
)
