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
/** Grabar `url` en la etiqueta y, solo si se grabó, llamar a `onWritten`. */
export type NfcWrite = { url: string; onWritten?: () => void | Promise<void> }

export async function listenNfc(onRead: (r: NfcRead) => void | string | NfcWrite | Promise<void | string | NfcWrite>, onError?: (msg: string) => void): Promise<() => void> {
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
            const res = await onRead({ url: readUrl(e.message), serial: e.serialNumber || null })
            const w: NfcWrite | null = typeof res === 'string' ? { url: res } : (res && typeof res === 'object' ? res : null)
            if (w) {
                try {
                    await reader.write({ records: [{ recordType: 'url', data: w.url }] }, { signal: ctrl.signal, overwrite: true })
                } catch (err: any) {
                    const m = String(err?.name || err?.message || '')
                    throw new Error(/NotAllowed|ReadOnly|locked/i.test(m)
                        ? 'La etiqueta está bloqueada o es de solo lectura; usa otra.'
                        : 'No se pudo grabar. Deja la etiqueta pegada al celular hasta que suene y vuelve a intentar.')
                }
                await w.onWritten?.()
            }
        } catch (err: any) {
            onError?.(err?.message || 'No se pudo leer o grabar la etiqueta')
        } finally { busy = false }
    }
    reader.onreadingerror = () => onError?.('No se pudo leer la etiqueta. Acércala de nuevo.')
    return () => ctrl.abort()
}

/**
 * Lector de PC (ACR122U) con el programa "Lector VUNLEK" abierto en la computadora
 * (tools/lector-nfc). Escucha solo en esta misma computadora.
 */
const PC_READER = 'http://127.0.0.1:47123'

async function pcFetch(path: string, init: RequestInit = {}, ms = 1500, outer?: AbortSignal) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), ms)
    const onAbort = () => ctrl.abort()
    outer?.addEventListener('abort', onAbort)
    try {
        const r = await fetch(PC_READER + path, { ...init, signal: ctrl.signal })
        return await r.json()
    } finally {
        clearTimeout(t)
        outer?.removeEventListener('abort', onAbort)
    }
}

/** Nombre del lector si el programa está abierto; null si no. */
export async function pcReaderStatus(): Promise<string | null> {
    try {
        const r = await pcFetch('/status', {}, 1200)
        return r?.ok ? (r.reader || 'Lector de PC') : null
    } catch { return null }
}

export type PcWrite = { ok: true; uid: string } | { ok: false; timeout?: boolean; error?: string }

/** Pide al lector de PC grabar la dirección en la siguiente credencial que se acerque (espera hasta ~25 s). */
export async function pcReaderWrite(url: string, signal?: AbortSignal): Promise<PcWrite> {
    return pcFetch('/write', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ url }) }, 30000, signal)
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
