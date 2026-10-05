import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { QrCode, Nfc, Keyboard, CheckCircle2, XCircle, AlertTriangle, Radio, Square } from 'lucide-react'
import { beep, listenNfc, nfcSupport, normalizeCode } from '../../../lib/cards'

export type ScanResult = { tone: 'ok' | 'warn' | 'bad'; title: string; detail?: string; notFound?: boolean }
type Mode = 'QR' | 'NFC' | 'LECTOR'

const MODES: { id: Mode; label: string; icon: any; hint: string }[] = [
    { id: 'QR', label: 'Código QR', icon: QrCode, hint: 'Con la cámara de este dispositivo. Funciona en cualquier celular o computadora con cámara.' },
    { id: 'NFC', label: 'NFC (acercar)', icon: Nfc, hint: 'El alumno acerca su credencial a la parte de atrás del celular. Requiere Chrome en Android con NFC.' },
    { id: 'LECTOR', label: 'Lector USB', icon: Keyboard, hint: 'Lector NFC o de códigos conectado a la computadora (los que "escriben" el código como un teclado).' },
]
const REPEAT_MS = 3500

/**
 * "Modo escucha": queda leyendo credenciales una tras otra (QR, NFC o lector USB) y avisa con color y sonido.
 * Quien lo usa decide qué hacer con cada código en `onCode` (pasar lista, registrar una tarea, control de acceso).
 */
export function CardListener({ onCode, title = 'Modo escucha' }: { onCode: (code: string) => Promise<ScanResult>; title?: string }) {
    const [mode, setMode] = useState<Mode>(() => (nfcSupport() === 'web' ? 'NFC' : 'QR'))
    const [on, setOn] = useState(false)
    const [last, setLast] = useState<ScanResult | null>(null)
    const [log, setLog] = useState<(ScanResult & { at: string })[]>([])
    const [error, setError] = useState<string | null>(null)
    const seen = useRef<Record<string, number>>({})
    const handler = useRef(onCode)
    handler.current = onCode
    const inputRef = useRef<HTMLInputElement>(null)
    const qrId = useRef(`qr-${Math.random().toString(36).slice(2)}`)

    const handle = useCallback(async (raw: string, alt?: string | null) => {
        const code = normalizeCode(raw)
        if (code.length < 4) return
        const now = Date.now()
        if (seen.current[code] && now - seen.current[code] < REPEAT_MS) return // la misma credencial sigue frente al lector
        seen.current[code] = now
        let res: ScanResult
        try {
            res = await handler.current(code)
            // La etiqueta puede traer el código grabado y además su número de serie: se prueba el otro si el primero no existe
            if (res.notFound && alt && normalizeCode(alt) !== code) res = await handler.current(normalizeCode(alt))
        } catch (e: any) {
            res = { tone: 'bad', title: 'No se pudo registrar', detail: e?.message }
        }
        beep(res.tone === 'ok')
        setLast(res)
        setLog(l => [{ ...res, at: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...l].slice(0, 40))
    }, [])

    // Pantalla encendida mientras escucha
    useEffect(() => {
        if (!on) return
        let lock: any
        ;(navigator as any).wakeLock?.request('screen').then((l: any) => { lock = l }).catch(() => {})
        return () => { lock?.release?.().catch(() => {}) }
    }, [on])

    useEffect(() => {
        if (!on) return
        setError(null)
        let stop: (() => void) | undefined
        let cancelled = false
        if (mode === 'QR') {
            const qr = new Html5Qrcode(qrId.current)
            qr.start({ facingMode: 'environment' }, { fps: 12, qrbox: (w: number, h: number) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s } } },
                text => { handle(text) }, () => {})
                .catch(e => setError(/Permission|NotAllowed/i.test(String(e)) ? 'Permite el uso de la cámara para leer los códigos.' : 'No se pudo encender la cámara.'))
            stop = () => { qr.stop().then(() => qr.clear()).catch(() => {}) }
        } else if (mode === 'NFC') {
            listenNfc(r => { handle(r.url ?? r.serial ?? '', r.url ? r.serial : null) }, setError)
                .then(s => { if (cancelled) s(); else stop = s })
                .catch(e => setError(/NotAllowed|permission/i.test(String(e)) ? 'Permite el uso de NFC y revisa que esté encendido en el celular.' : (e?.message || 'No se pudo usar NFC.')))
        } else {
            const focus = () => inputRef.current?.focus()
            focus()
            const t = setInterval(focus, 800)
            stop = () => clearInterval(t)
        }
        return () => { cancelled = true; stop?.() }
    }, [on, mode, handle])

    const M = MODES.find(m => m.id === mode)!
    const tone = last?.tone === 'ok' ? 'bg-emerald-500' : last?.tone === 'warn' ? 'bg-amber-500' : last ? 'bg-rose-600' : 'bg-slate-800'
    const Icon = last?.tone === 'ok' ? CheckCircle2 : last?.tone === 'warn' ? AlertTriangle : last ? XCircle : Radio

    return (
        <section className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-6 space-y-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-black text-slate-900 flex items-center gap-2"><Radio className={`w-5 h-5 ${on ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} /> {title}</h3>
                <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-2xl" role="radiogroup" aria-label="Cómo leer la credencial">
                    {MODES.map(m => (
                        <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => { setMode(m.id); setLast(null) }}
                            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl text-xs font-bold ${mode === m.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-white'}`}>
                            <m.icon className="w-4 h-4" /> {m.label}
                        </button>
                    ))}
                </div>
            </div>
            <p className="text-sm text-slate-500">{M.hint}</p>
            {mode === 'NFC' && nfcSupport() === 'none' && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                    Este dispositivo no puede leer NFC desde el navegador. En iPhone, acerca la credencial a la parte superior del teléfono: se abre VUNLEK y registra la entrada. En computadora usa un lector USB, o el código QR.
                </p>
            )}

            {!on ? (
                <button type="button" onClick={() => setOn(true)} disabled={mode === 'NFC' && nfcSupport() === 'none'}
                    className="w-full min-h-[56px] rounded-2xl bg-slate-900 text-white font-black text-lg hover:bg-slate-800 disabled:opacity-40">
                    Empezar a escuchar
                </button>
            ) : (
                <>
                    <div className={`rounded-3xl ${tone} text-white p-5 sm:p-8 text-center transition-colors duration-200`} aria-live="assertive">
                        <Icon className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-2xl sm:text-3xl font-black leading-tight">{last?.title ?? (mode === 'QR' ? 'Muestra el código a la cámara' : mode === 'NFC' ? 'Acerca la credencial' : 'Pasa la credencial por el lector')}</p>
                        {last?.detail && <p className="text-base sm:text-lg font-bold opacity-90 mt-1">{last.detail}</p>}
                    </div>
                    {mode === 'QR' && <div id={qrId.current} className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-slate-900 min-h-[240px]" />}
                    {mode === 'LECTOR' && (
                        <form onSubmit={e => { e.preventDefault(); const v = inputRef.current?.value ?? ''; if (inputRef.current) inputRef.current.value = ''; handle(v) }}>
                            <input ref={inputRef} aria-label="Código leído por el lector" autoComplete="off" inputMode="none"
                                className="w-full min-h-[48px] rounded-2xl border-2 border-dashed border-slate-300 px-4 text-center font-mono text-slate-500" placeholder="Esperando al lector…" />
                        </form>
                    )}
                    {error && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-2xl p-3">{error}</p>}
                    <button type="button" onClick={() => { setOn(false); setLast(null) }} className="w-full min-h-[48px] rounded-2xl border border-slate-200 text-slate-700 font-bold inline-flex items-center justify-center gap-2 hover:bg-slate-50">
                        <Square className="w-4 h-4" /> Detener
                    </button>
                </>
            )}

            {log.length > 0 && (
                <details className="text-sm">
                    <summary className="cursor-pointer font-bold text-slate-700">Últimas lecturas ({log.length})</summary>
                    <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {log.map((l, i) => (
                            <li key={i} className="flex justify-between gap-2">
                                <span className={l.tone === 'ok' ? 'text-emerald-800' : l.tone === 'warn' ? 'text-amber-800' : 'text-rose-800'}>{l.title}{l.detail ? ` · ${l.detail}` : ''}</span>
                                <span className="text-slate-400 shrink-0">{l.at}</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    )
}
