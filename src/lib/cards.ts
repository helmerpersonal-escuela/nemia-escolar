/**
 * Credenciales de alumnos: QR, etiqueta NFC o lector USB.
 * La credencial lleva un código opaco; en la etiqueta NFC se graba como dirección web (…/c/CODIGO) para que
 * cualquier celular la pueda leer (un iPhone la abre solo) sin exponer datos del alumno.
 */
export const CARD_BASE = 'https://www.vunlek.com/c/'
export const cardUrl = (token: string) => `${CARD_BASE}${token}`
export const cardQr = (token: string) => `VK:${token}`

/** Deja solo el código: quita la dirección, el prefijo VK: y separadores (igual que private.card_code en la base). */
export function normalizeCode(raw: string): string {
    return String(raw ?? '').trim().replace(/^.*\/c\//, '').replace(/^VK:/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export type NfcSupport = 'web' | 'none'
/** Web NFC existe en Chrome para Android (también con VUNLEK instalada desde Chrome). */
export const nfcSupport = (): NfcSupport => (typeof window !== 'undefined' && 'NDEFReader' in window ? 'web' : 'none')

export type NfcRead = { url: string | null; serial: string | null }

function readUrl(message: any): string | null {
    for (const r of message?.records ?? []) {
        try {
            if (r.recordType === 'url' || r.recordType === 'absolute-url' || r.recordType === 'text') {
                const txt = new TextDecoder(r.encoding || 'utf-8').decode(r.data)
                if (txt) return txt
            }
        } catch { /* registro ilegible */ }
    }
    return null
}

/**
 * Escucha etiquetas NFC hasta que se llame a la función que regresa.
 * `onRead` puede regresar una dirección para grabarla en esa misma etiqueta (programación).
 */
export async function listenNfc(onRead: (r: NfcRead) => void | string | Promise<void | string>, onError?: (msg: string) => void): Promise<() => void> {
    const Reader = (window as any).NDEFReader
    if (!Reader) throw new Error('Este dispositivo o navegador no lee NFC. Usa Chrome en un celular Android con NFC.')
    const ctrl = new AbortController()
    const reader = new Reader()
    await reader.scan({ signal: ctrl.signal })
    let busy = false
    reader.onreading = async (e: any) => {
        if (busy) return
        busy = true
        try {
            const write = await onRead({ url: readUrl(e.message), serial: e.serialNumber || null })
            if (typeof write === 'string') await reader.write({ records: [{ recordType: 'url', data: write }] }, { signal: ctrl.signal, overwrite: true })
        } catch (err: any) {
            onError?.(err?.message || 'No se pudo leer o grabar la etiqueta')
        } finally { busy = false }
    }
    reader.onreadingerror = () => onError?.('No se pudo leer la etiqueta. Acércala de nuevo.')
    return () => ctrl.abort()
}

// Sonidos cortos de confirmación (sin archivos)
let ctx: AudioContext | null = null
export function beep(ok: boolean) {
    try {
        ctx = ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)()
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = ok ? 'sine' : 'square'
        o.frequency.value = ok ? 1040 : 220
        g.gain.setValueAtTime(0.25, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (ok ? 0.18 : 0.45))
        o.start(); o.stop(ctx.currentTime + (ok ? 0.18 : 0.45))
        if (navigator.vibrate) navigator.vibrate(ok ? 60 : [80, 60, 80])
    } catch { /* sin audio */ }
}
