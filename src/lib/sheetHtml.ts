/** Convierte una hoja de impresión en un archivo HTML que se ve igual fuera de la aplicación. */
export function buildSheetHtml(inner: string, css: string, title = 'Hoja VUNLEK'): string {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${css.replace(/<\/style/gi, '')}
body{margin:0;background:#fff}
.print-sheet{display:block!important;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;padding:16px;max-width:800px;margin:0 auto}
.print-sheet .print-page{break-after:page;margin-bottom:40px}
@media print{.print-sheet{padding:0;max-width:none}.print-sheet .print-page{margin-bottom:0}}
</style></head><body><div class="print-sheet">${inner}</div></body></html>`
}

/** Estilos cargados en la página (los de la aplicación), para que la hoja conserve su formato. */
export function pageCss(): string {
    const out: string[] = []
    for (const sheet of Array.from(document.styleSheets)) {
        try { out.push(Array.from(sheet.cssRules).map(r => r.cssText).join('\n')) } catch { /* hoja de otro origen: se omite */ }
    }
    return out.join('\n')
}
