import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import { saveFile } from '../../lib/download'
import { buildSheetHtml, pageCss } from '../../lib/sheetHtml'

/**
 * Impresión de una hoja: `print(<Contenido />)` la coloca fuera de la aplicación y abre el
 * diálogo de impresión. Al imprimir solo se ve esa hoja (regla `.print-sheet` de index.css).
 * En la app de Android no existe ese diálogo: la hoja se entrega como archivo por el menú
 * «Compartir», para abrirla en el navegador e imprimirla o guardarla como PDF desde ahí.
 */
export function usePrint() {
    const [content, setContent] = useState<ReactNode>(null)
    useEffect(() => {
        if (!content) return
        const done = () => setContent(null)
        if (Capacitor.getPlatform() === 'android') {
            const t = setTimeout(async () => {
                const el = document.querySelector('.print-sheet')
                try { if (el) await saveFile(new Blob([buildSheetHtml(el.innerHTML, pageCss())], { type: 'text/html' }), `hoja-vunlek-${Date.now()}.html`) } finally { done() }
            }, 200)
            return () => clearTimeout(t)
        }
        window.addEventListener('afterprint', done)
        const t = setTimeout(() => window.print(), 200)
        return () => { clearTimeout(t); window.removeEventListener('afterprint', done) }
    }, [content])
    return { sheet: content ? createPortal(<div className="print-sheet">{content}</div>, document.body) : null, print: setContent }
}

/** Encabezado común de las hojas impresas. */
export const SheetHeader = ({ school, title, folio, right }: { school: string; title: string; folio?: string; right?: ReactNode }) => (
    <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-2 mb-3">
        <div>
            <p className="text-[11pt] font-bold">{school}</p>
            <h1 className="text-[14pt] font-black leading-tight">{title}</h1>
        </div>
        <div className="text-right text-[10pt] shrink-0">
            {folio && <p className="font-black text-[13pt] border-2 border-black px-2 py-0.5 inline-block">Folio {folio}</p>}
            {right}
        </div>
    </header>
)

export const SheetField = ({ label, value, lines = 1 }: { label: string; value?: ReactNode; lines?: number }) => (
    <div className="mb-2 break-inside-avoid">
        <p className="text-[8.5pt] font-bold uppercase keep-caps tracking-wide">{label}</p>
        {value ? <div className="text-[10.5pt] whitespace-pre-wrap border-b border-black/40 pb-1 min-h-[1.4em]">{value}</div>
            : Array.from({ length: lines }).map((_, i) => <div key={i} className="border-b border-black/50 h-[1.9em]" />)}
    </div>
)

export const SheetSignatures = ({ names }: { names: string[] }) => (
    <div className="grid gap-6 mt-10 break-inside-avoid" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
        {names.map(n => <div key={n} className="text-center text-[9.5pt]"><div className="border-t border-black pt-1 mt-10">{n}</div></div>)}
    </div>
)
