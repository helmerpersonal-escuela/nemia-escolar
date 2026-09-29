import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

/**
 * Archivos del chat (fotos, PDF y notas de voz).
 * Bucket privado `chat_files`, una carpeta por conversación: solo los participantes
 * pueden subir o abrir. Los enlaces son firmados y caducan en una hora.
 */
export const CHAT_BUCKET = 'chat_files'
export const MAX_CHAT_FILE_MB = 15
export const MAX_VOICE_SECONDS = 180

export type ChatAttachmentKind = 'IMAGE' | 'DOCUMENT' | 'AUDIO'

export interface ChatFileMeta {
    path: string
    name: string
    size: number
    mime: string
    duration?: number
}

const EXT: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif',
    'application/pdf': 'pdf',
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav',
}

/** Tipo base sin parámetros ("audio/webm;codecs=opus" → "audio/webm"). */
export const baseMime = (mime: string) => (mime || '').split(';')[0].trim().toLowerCase()

export function kindForFile(mime: string): ChatAttachmentKind | null {
    const m = baseMime(mime)
    if (m.startsWith('image/')) return 'IMAGE'
    if (m === 'application/pdf') return 'DOCUMENT'
    if (m.startsWith('audio/')) return 'AUDIO'
    return null
}

export function describeFileProblem(file: { type: string; size: number }): string | null {
    if (!kindForFile(file.type)) return 'Solo se pueden enviar fotos, PDF o notas de voz.'
    if (!EXT[baseMime(file.type)]) return 'Ese formato no se puede enviar. Usa JPG, PNG o PDF.'
    if (file.size > MAX_CHAT_FILE_MB * 1024 * 1024) return `El archivo pesa más de ${MAX_CHAT_FILE_MB} MB.`
    return null
}

/** Reduce fotos grandes (la cámara del celular saca 4–12 MB) a ~1600 px en JPG. */
export async function prepareImage(file: File): Promise<{ blob: Blob; mime: string; name: string }> {
    const mime = baseMime(file.type)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime) || file.size < 400 * 1024) {
        return { blob: file, mime, name: file.name }
    }
    try {
        const bitmap = await createImageBitmap(file)
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(bitmap.width * scale)
        canvas.height = Math.round(bitmap.height * scale)
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82))
        if (!blob || blob.size >= file.size) return { blob: file, mime, name: file.name }
        return { blob, mime: 'image/jpeg', name: file.name.replace(/\.[^.]+$/, '') + '.jpg' }
    } catch {
        return { blob: file, mime, name: file.name }
    }
}

export async function uploadChatFile(roomId: string, blob: Blob, mime: string): Promise<string> {
    const m = baseMime(mime)
    const ext = EXT[m] ?? 'bin'
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const path = `${roomId}/${id}.${ext}`
    const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, blob, { contentType: m, upsert: false })
    if (error) throw error
    return path
}

// Caché de enlaces firmados (duran 1 h; se renuevan a los 50 min)
const signed = new Map<string, { url: string; at: number }>()

export async function signedChatUrl(path: string): Promise<string | null> {
    const hit = signed.get(path)
    if (hit && Date.now() - hit.at < 50 * 60 * 1000) return hit.url
    const { data, error } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) return null
    signed.set(path, { url: data.signedUrl, at: Date.now() })
    return data.signedUrl
}

export function useSignedChatUrl(path?: string | null) {
    const [url, setUrl] = useState<string | null>(null)
    const [failed, setFailed] = useState(false)
    useEffect(() => {
        let alive = true
        setUrl(null)
        setFailed(false)
        if (!path) return
        signedChatUrl(path).then(u => {
            if (!alive) return
            if (u) setUrl(u)
            else setFailed(true)
        })
        return () => { alive = false }
    }, [path])
    return { url, failed }
}

/** Formato de audio que el navegador sabe grabar (Chrome/Android: webm; iPhone: mp4). */
export function pickAudioMime(): string {
    if (typeof MediaRecorder === 'undefined') return ''
    const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    return options.find(o => MediaRecorder.isTypeSupported?.(o)) ?? ''
}

export const formatSeconds = (s: number) => {
    const total = Math.max(0, Math.round(s))
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export const formatSize = (bytes: number) =>
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
