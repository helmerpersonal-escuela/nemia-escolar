import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, HelpCircle } from 'lucide-react'

/**
 * Ventana de confirmación propia (reemplaza a window.confirm).
 * La nativa muestra "www.vunlek.com dice…" en gris y confunde a quien usa poco la computadora.
 *
 *   if (!(await askConfirm('¿Eliminar este grupo?'))) return
 *
 * Detecta sola si la acción es destructiva (eliminar, borrar, quitar…) para pintarla en rojo.
 */

interface Options { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
interface Request extends Options { message: string; resolve: (v: boolean) => void }

let push: ((r: Request) => void) | null = null
const queue: Request[] = []

const DANGER = /elimin|borrar|borrará|quitar|revocar|cancelar tu registro|desactivar|irreversible|no se puede deshacer|reemplaz|sobrescrib|perder/i

export function askConfirm(message: string, opts: Options = {}): Promise<boolean> {
    return new Promise(resolve => {
        const req = { message, ...opts, resolve }
        if (push) push(req)
        else if (typeof window !== 'undefined') resolve(window.confirm(message)) // respaldo si aún no se monta la ventana
        else { queue.push(req) }
    })
}

function labelsFor(message: string, danger: boolean) {
    if (/elimin|borrar|quitar/i.test(message)) return { title: 'Confirmar eliminación', confirm: 'Sí, eliminar' }
    if (danger) return { title: '¿Estás seguro?', confirm: 'Sí, continuar' }
    return { title: 'Confirmar', confirm: 'Aceptar' }
}

/** Se monta una sola vez (en App). */
export function ConfirmHost() {
    const [current, setCurrent] = useState<Request | null>(null)
    const pending = useRef<Request[]>([])
    const confirmBtn = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        push = (r: Request) => setCurrent(c => { if (c) { pending.current.push(r); return c } return r })
        while (queue.length) push(queue.shift()!)
        return () => { push = null }
    }, [])

    const close = (value: boolean) => {
        current?.resolve(value)
        setCurrent(pending.current.shift() ?? null)
    }

    useEffect(() => {
        if (!current) return
        const t = setTimeout(() => confirmBtn.current?.focus(), 30)
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
        window.addEventListener('keydown', onKey)
        return () => { clearTimeout(t); window.removeEventListener('keydown', onKey) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current])

    if (!current) return null
    const danger = current.danger ?? DANGER.test(current.message)
    const auto = labelsFor(current.message, danger)
    const Icon = danger ? AlertTriangle : HelpCircle

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => close(false)}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg" onClick={e => e.stopPropagation()}
                className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${danger ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <h2 id="confirm-title" className="text-lg font-black text-slate-900">{current.title ?? auto.title}</h2>
                        <p id="confirm-msg" className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-line">{current.message}</p>
                    </div>
                </div>
                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button type="button" onClick={() => close(false)} className="w-full sm:w-auto px-5 py-3 rounded-2xl text-sm font-black text-slate-700 bg-slate-100 hover:bg-slate-200">
                        {current.cancelLabel ?? 'No, regresar'}
                    </button>
                    <button ref={confirmBtn} type="button" onClick={() => close(true)}
                        className={`w-full sm:w-auto px-5 py-3 rounded-2xl text-sm font-black text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {current.confirmLabel ?? auto.confirm}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}
