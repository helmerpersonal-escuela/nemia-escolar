import { useEffect, useRef, useState } from 'react'
import { Mic, Send, Trash2 } from 'lucide-react'
import { MAX_VOICE_SECONDS, formatSeconds, pickAudioMime } from '../lib/chatFiles'

interface Props {
    disabled?: boolean
    onRecorded: (blob: Blob, mime: string, seconds: number) => void
    onRecordingChange?: (recording: boolean) => void
    onError?: (message: string) => void
}

/**
 * Nota de voz: un toque para grabar, otro para enviar (o el bote para descartar).
 * Se detiene sola a los 3 minutos.
 */
export const VoiceRecorder = ({ disabled, onRecorded, onRecordingChange, onError }: Props) => {
    const [recording, setRecording] = useState(false)
    const [seconds, setSeconds] = useState(0)
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)
    const startedAtRef = useRef(0)
    const discardRef = useRef(false)
    const timerRef = useRef<number | null>(null)

    const cleanup = () => {
        if (timerRef.current) window.clearInterval(timerRef.current)
        timerRef.current = null
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
        onRecordingChange?.(false)
    }

    useEffect(() => () => { discardRef.current = true; recorderRef.current?.state === 'recording' && recorderRef.current.stop(); cleanup() },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [])

    const start = async () => {
        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            onError?.('Este navegador no permite grabar notas de voz.')
            return
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            const mime = pickAudioMime()
            const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
            chunksRef.current = []
            discardRef.current = false
            rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
            rec.onstop = () => {
                const duration = (Date.now() - startedAtRef.current) / 1000
                const type = rec.mimeType || mime || 'audio/webm'
                const blob = new Blob(chunksRef.current, { type })
                cleanup()
                if (!discardRef.current && blob.size > 0 && duration >= 1) onRecorded(blob, type, duration)
            }
            recorderRef.current = rec
            startedAtRef.current = Date.now()
            setSeconds(0)
            rec.start(250)
            setRecording(true)
            onRecordingChange?.(true)
            timerRef.current = window.setInterval(() => {
                const s = (Date.now() - startedAtRef.current) / 1000
                setSeconds(s)
                if (s >= MAX_VOICE_SECONDS && rec.state === 'recording') rec.stop()
            }, 250)
        } catch {
            cleanup()
            onError?.('No se pudo usar el micrófono. Revisa que la app tenga permiso para usarlo.')
        }
    }

    const stop = (discard: boolean) => {
        discardRef.current = discard
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
        else cleanup()
    }

    if (!recording) {
        return (
            <button type="button" onClick={start} disabled={disabled} aria-label="Grabar nota de voz" title="Grabar nota de voz"
                className="p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-100 active:scale-95 transition-all">
                <Mic className="h-5 w-5" />
            </button>
        )
    }

    return (
        <div className="flex items-center gap-2 flex-1 justify-end" role="status" aria-live="polite">
            <button type="button" onClick={() => stop(true)} aria-label="Descartar nota de voz" title="Descartar"
                className="p-3 text-slate-500 hover:text-rose-600 rounded-full">
                <Trash2 className="h-5 w-5" />
            </button>
            <span className="flex items-center gap-2 text-sm font-bold text-rose-600 tabular-nums">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" /> Grabando {formatSeconds(seconds)}
            </span>
            <button type="button" onClick={() => stop(false)} aria-label="Enviar nota de voz" title="Enviar"
                className="p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-lg shadow-blue-100 active:scale-95 transition-all">
                <Send className="h-5 w-5" />
            </button>
        </div>
    )
}
