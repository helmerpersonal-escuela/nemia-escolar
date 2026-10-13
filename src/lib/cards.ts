/**
 * Credenciales de alumnos: QR, etiqueta NFC o lector USB.
 * La credencial lleva un código opaco; en la etiqueta NFC se graba como dirección web (…/c/CODIGO) para que
 * cualquier celular la pueda leer (un iPhone la abre solo) sin exponer datos del alumno.
 */
import { Capacitor } from '@capacitor/core'

export const CARD_BASE = 'https://www.vunlek.com/c/'
export const cardUrl = (token: string) => `${CARD_BASE}${token}`
export const cardQr = (token: string) => `VK:${token}`

/** Deja solo el código: quita la dirección, el prefijo VK: y separadores (igual que private.card_code en la base). */
export function normalizeCode(raw: string): string {
    return String(raw ?? '').trim().replace(/^.*\/c\//, '').replace(/^VK:/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export type NfcSupport = 'web' | 'native' | 'none'
/**
 * - App de VUNLEK (Android/iPhone): NFC del teléfono con el complemento phonegap-nfc.
 * - Chrome en Android: Web NFC.
 * (Dentro de la app no se usa Web NFC: su navegador interno lo rechaza.)
 */
export const nfcSupport = (): NfcSupport => {
    if (typeof window === 'undefined') return 'none'
    if (Capacitor.isNativePlatform()) return 'native'
    return 'NDEFReader' in window ? 'web' : 'none'
}

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

type OnRead = (r: NfcRead) => void | string | NfcWrite | Promise<void | string | NfcWrite>
const asWrite = (res: void | string | NfcWrite): NfcWrite | null => (typeof res === 'string' ? { url: res } : (res && typeof res === 'object' ? res : null))

export async function listenNfc(onRead: OnRead, onError?: (msg: string) => void): Promise<() => void> {
    if (Capacitor.isNativePlatform()) return listenNativeNfc(onRead, onError)
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
            const w = asWrite(await onRead({ url: readUrl(e.message), serial: e.serialNumber || null }))
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

// ---------- NFC del teléfono dentro de la app (phonegap-nfc) ----------

async function nativeNfcPlugin(): Promise<any> {
    for (let i = 0; i < 30; i++) {
        const nfc = (window as any).nfc
        if (nfc && (window as any).ndef) return nfc
        await new Promise(r => setTimeout(r, 100))
    }
    throw new Error('Esta versión de la app no tiene NFC. Actualiza la app de VUNLEK.')
}

function nativeUrl(message: any[] | undefined): string | null {
    const ndef = (window as any).ndef, nfc = (window as any).nfc
    for (const r of message ?? []) {
        try {
            const type = r.type?.[0]
            if (r.tnf === 1 && type === 0x55) return ndef.uriHelper.decodePayload(r.payload)            // "U": dirección
            if (r.tnf === 1 && type === 0x54) return nfc.bytesToString(r.payload.slice(1 + (r.payload[0] & 0x3f))) // "T": texto
        } catch { /* registro ilegible */ }
    }
    return null
}

const nativeWrite = (nfc: any, url: string) => new Promise<void>((resolve, reject) =>
    nfc.write([(window as any).ndef.uriRecord(url)], () => resolve(), (e: any) => reject(e)))

async function listenNativeNfc(onRead: OnRead, onError?: (msg: string) => void): Promise<() => void> {
    const nfc = await nativeNfcPlugin()
    await new Promise<void>((resolve, reject) => nfc.enabled(() => resolve(), (e: any) => reject(new Error(
        e === 'NFC_DISABLED' ? 'El NFC del celular está apagado. Enciéndelo en Ajustes y vuelve a intentar.' : 'Este celular no tiene NFC.'))))
    let stopped = false, busy = false

    const process = async (tag: any, canWrite: boolean) => {
        const serial = tag?.id ? nfc.bytesToHexString(tag.id) : null
        const w = asWrite(await onRead({ url: nativeUrl(tag?.ndefMessage), serial }))
        if (!w) return
        if (!canWrite) throw new Error('Esta credencial no se puede grabar. Usa etiquetas NTAG213, NTAG215 o NTAG216.')
        try { await nativeWrite(nfc, w.url) } catch {
            throw new Error('No se pudo grabar. Deja la credencial pegada al celular hasta que suene y vuelve a intentar.')
        }
        await w.onWritten?.()
    }

    if (Capacitor.getPlatform() === 'ios') {
        // iPhone: cada lectura abre la ventanita del sistema; se repite mientras siga encendido
        ;(async () => {
            while (!stopped) {
                try {
                    const tag = await nfc.scanTag({ keepSessionOpen: true })
                    if (stopped) break
                    await process(tag, true)
                } catch (err: any) {
                    if (!stopped) onError?.(/cancel|invalidat/i.test(String(err?.message ?? err)) ? 'Lectura NFC detenida.' : (err?.message || String(err)))
                    stopped = true
                } finally {
                    try { await nfc.cancelScan() } catch { /* ya cerrada */ }
                }
            }
        })()
        return () => { stopped = true; nfc.cancelScan?.().catch?.(() => {}) }
    }

    // Android: escucha continua mientras la pantalla esté abierta
    const handler = (canWrite: boolean) => async (ev: any) => {
        if (stopped || busy) return
        busy = true
        try { await process(ev?.tag, canWrite) } catch (err: any) { onError?.(err?.message || 'No se pudo leer la credencial') } finally { busy = false }
    }
    // Una etiqueta NFC normal llega como "ndef"; el aviso genérico solo cuenta si no llegó el otro
    let lastNdef = 0
    const ndefHandler = handler(true), tagHandler = handler(false)
    const onNdef = (ev: any) => { lastNdef = Date.now(); ndefHandler(ev) }
    const onTag = (ev: any) => { setTimeout(() => { if (Date.now() - lastNdef > 400) tagHandler(ev) }, 250) }
    nfc.addNdefListener(onNdef, () => {}, () => onError?.('No se pudo encender el NFC.'))
    nfc.addTagDiscoveredListener(onTag, () => {}, () => {})
    return () => {
        stopped = true
        nfc.removeNdefListener(onNdef, () => {}, () => {})
        nfc.removeTagDiscoveredListener(onTag, () => {}, () => {})
    }
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
