import { useEffect, type ComponentType, type ReactNode } from 'react'
import { Loader2, Save, Undo2, CheckCircle2, Plus } from 'lucide-react'

/**
 * Piezas comunes de Configuración. TODAS las pantallas usan el mismo patrón:
 *  1. <SettingsHeader>: título y explicación arriba.
 *  2. <SettingsCard>: cada bloque en una tarjeta igual (icono, título, ayuda, botón opcional "Agregar…").
 *  3. <SaveBar>: los cambios de un formulario se guardan SIEMPRE con la barra que aparece abajo
 *     en cuanto hay algo sin guardar (Descartar / Guardar cambios). No hay botones "Guardar" arriba
 *     ni flotando en otras posiciones. Las acciones puntuales (cambiar contraseña, crear un ciclo)
 *     viven dentro de su tarjeta.
 */

type Icon = ComponentType<{ className?: string }>

export function SettingsHeader({ icon: Icon, title, description, notice }: { icon: Icon; title: string; description: string; notice?: ReactNode }) {
    return (
        <header className="border-b border-slate-100 pb-5 mb-6">
            <div className="flex items-start gap-3">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                <div className="min-w-0">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
                    <p className="text-sm text-slate-500 mt-1">{description}</p>
                </div>
            </div>
            {notice && <div className="mt-4 text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-2">{notice}</div>}
        </header>
    )
}

export function SettingsCard({ icon: Icon, title, hint, action, children, tone = 'default', className = '' }: {
    icon?: Icon; title: string; hint?: ReactNode; action?: ReactNode; children?: ReactNode; tone?: 'default' | 'danger'; className?: string
}) {
    const danger = tone === 'danger'
    return (
        <section className={`rounded-3xl border ${danger ? 'border-red-100 bg-red-50/40' : 'border-slate-100 bg-white'} p-5 sm:p-6 space-y-4 ${className}`}>
            <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className={`text-base font-black flex items-center gap-2 ${danger ? 'text-red-900' : 'text-slate-900'}`}>
                        {Icon && <Icon className={`w-5 h-5 shrink-0 ${danger ? 'text-red-600' : 'text-indigo-600'}`} />} {title}
                    </h3>
                    {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </header>
            {children}
        </section>
    )
}

/** Botón secundario uniforme para acciones dentro de una tarjeta ("Agregar periodo", "Cambiar contraseña"…). */
export function SettingsActionButton({ onClick, children, icon: Icon = Plus, disabled, type = 'button', tone = 'default' }: {
    onClick?: () => void; children: ReactNode; icon?: Icon | null; disabled?: boolean; type?: 'button' | 'submit'; tone?: 'default' | 'danger'
}) {
    const cls = tone === 'danger'
        ? 'border-red-200 text-red-700 bg-white hover:bg-red-50'
        : 'border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50'
    return (
        <button type={type} onClick={onClick} disabled={disabled}
            className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-2xl border text-sm font-bold whitespace-nowrap disabled:opacity-50 ${cls}`}>
            {Icon && <Icon className="w-4 h-4" />}{children}
        </button>
    )
}

/**
 * Barra única para guardar. Aparece abajo (sobre el menú del celular) solo cuando hay cambios.
 * Al final de la pantalla deja una línea discreta que dice si todo está guardado.
 */
export function SaveBar({ dirty, saving, onSave, onDiscard, label = 'Guardar cambios', what = 'cambios', saved }: {
    dirty: boolean; saving: boolean; onSave: () => void; onDiscard?: () => void; label?: string; what?: string; saved?: boolean
}) {
    useEffect(() => {
        if (!dirty) return
        const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', h)
        return () => window.removeEventListener('beforeunload', h)
    }, [dirty])

    return (
        <>
            <p role="status" className="mt-6 text-sm text-slate-500 flex items-center gap-2">
                {dirty
                    ? <>Tienes {what} sin guardar. Usa el botón <strong className="text-slate-700">{label}</strong> de abajo.</>
                    : <><CheckCircle2 className={`w-4 h-4 ${saved ? 'text-emerald-600' : 'text-slate-400'}`} /> Todo está guardado.</>}
            </p>
            {/* espacio para que la barra no tape lo último del formulario */}
            {dirty && <div aria-hidden className="h-24" />}
            {dirty && (
                <div className="fixed left-3 right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-auto lg:right-8 lg:w-[30rem] z-40 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-2xl">
                    <span className="text-sm font-bold">Tienes {what} sin guardar</span>
                    <div className="ml-auto flex items-center gap-2">
                        {onDiscard && (
                            <button type="button" onClick={onDiscard} disabled={saving}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50">
                                <Undo2 className="w-4 h-4" /> Descartar
                            </button>
                        )}
                        <button type="button" onClick={onSave} disabled={saving}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 disabled:opacity-60">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Guardando…' : label}
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
