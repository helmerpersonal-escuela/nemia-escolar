import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Image as ImageIcon, Loader2, AlertTriangle, Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/** Medidas recomendadas para la imagen (se muestran al docente y se revisan al subir). */
export interface ImageSpec {
    /** Tamaño ideal en píxeles. */
    width: number
    height: number
    /** Lado más largo mínimo para que no se vea borrosa al imprimir. */
    min: number
    /** Texto corto extra (p. ej. "fondo transparente"). */
    note?: string
    /** Tamaño aproximado en el documento impreso. */
    printed?: string
}

/** Logotipos del encabezado de planeaciones, boletas y reportes (se imprimen en un recuadro de ~2.8 cm). */
export const LOGO_SPEC: ImageSpec = { width: 600, height: 600, min: 300, note: 'PNG con fondo transparente, cuadrado o casi cuadrado', printed: 'unos 2.8 × 2.8 cm' }

interface ImageUploadProps {
    currentUrl?: string | null
    onUpload: (url: string) => void
    label: string
    bucket?: string
    maxSizeMB?: number // Default 2MB
    spec?: ImageSpec
    /** Muestra el recuadro con la medida ideal (ponlo en false si ya lo muestras una vez para varias imágenes). */
    showSpec?: boolean
}

const MAX_SIDE = 1200 // más grande no mejora la impresión y solo hace lentos los PDF

function readImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => { resolve(img); URL.revokeObjectURL(url) }
        img.onerror = () => { reject(new Error('No se pudo leer la imagen')); URL.revokeObjectURL(url) }
        img.src = url
    })
}

/** Reduce imágenes enormes (conserva la transparencia en PNG/WEBP). */
async function shrinkIfNeeded(file: File, img: HTMLImageElement): Promise<File> {
    const side = Math.max(img.naturalWidth, img.naturalHeight)
    if (side <= MAX_SIDE) return file
    const k = MAX_SIDE / side
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, type, 0.9))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, type === 'image/jpeg' ? '.jpg' : '.png'), { type })
}

export const ImageUpload = ({ currentUrl, onUpload, label, bucket = 'school-assets', maxSizeMB = 2, spec, showSpec = true }: ImageUploadProps) => {
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState<string | null>(currentUrl || null)
    const [error, setError] = useState<string | null>(null)
    const [warnings, setWarnings] = useState<string[]>([])
    useEffect(() => { setPreview(currentUrl || null) }, [currentUrl])

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        let file = acceptedFiles[0]
        if (!file) return
        setError(null); setWarnings([])

        setUploading(true)
        try {
            // Revisa medidas y ajusta antes de subir
            const img = await readImage(file)
            const w = img.naturalWidth, h = img.naturalHeight
            const notes: string[] = []
            if (spec) {
                if (Math.max(w, h) < spec.min) notes.push(`Tu imagen mide ${w} × ${h} px: es pequeña y puede verse borrosa al imprimir. Lo ideal es ${spec.width} × ${spec.height} px.`)
                const ratio = Math.max(w, h) / Math.min(w, h)
                if (ratio > 2.5) notes.push(`Tu imagen es muy alargada (${w} × ${h} px). En el documento se verá pequeña; usa una versión más cuadrada.`)
                if (file.type === 'image/jpeg') notes.push('Es JPG: tendrá fondo blanco. Si la tienes en PNG con fondo transparente, se verá mejor.')
            }
            file = await shrinkIfNeeded(file, img)
            if (file.size > maxSizeMB * 1024 * 1024) {
                setError(`La imagen pesa más de ${maxSizeMB} MB. Guárdala en PNG o JPG más ligero e intenta de nuevo.`)
                return
            }
            setWarnings(notes)

            // Create a unique file path
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
            const filePath = `logos/${fileName}`

            // Upload to Supabase
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file)

            if (uploadError) {
                // If bucket doesn't exist, try 'public' or handle error
                if (uploadError.message.includes('Bucket not found')) {
                    throw new Error(`El bucket '${bucket}' no existe. Por favor contacta a soporte.`)
                }
                throw uploadError
            }

            // Get Public URL
            const { data: string } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath)

            const publicUrl = string.publicUrl

            setPreview(publicUrl)
            onUpload(publicUrl)

        } catch (error: any) {
            console.error('Error uploading image:', error)
            setError('No se pudo subir la imagen: ' + (error?.message || 'intenta de nuevo'))
        } finally {
            setUploading(false)
        }
    }, [bucket, maxSizeMB, onUpload, spec])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': [],
            'image/png': [],
            'image/webp': []
        },
        maxFiles: 1,
        disabled: uploading
    })

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation()
        setPreview(null)
        onUpload('')
    }

    return (
        <div className="w-full">
            <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>

            <div
                {...getRootProps()}
                className={`
                    relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer flex flex-col items-center justify-center text-center min-h-[160px]
                    ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'}
                    ${preview ? 'border-solid border-blue-200 bg-blue-50/30' : ''}
                `}
            >
                <input {...getInputProps()} />

                {uploading ? (
                    <div className="flex flex-col items-center animate-pulse">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                        <p className="text-sm font-medium text-blue-600">Subiendo imagen...</p>
                    </div>
                ) : preview ? (
                    <div className="relative w-full h-full flex flex-col items-center">
                        <div className="relative bg-white p-2 rounded-lg shadow-sm border border-gray-100 mb-2">
                            <img
                                src={preview}
                                alt="Preview"
                                className="max-h-32 object-contain rounded-md"
                            />
                            <button
                                onClick={handleRemove}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                title="Eliminar imagen"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <p className="text-xs text-blue-600 font-bold">Clic o arrastrar para cambiar</p>
                    </div>
                ) : (
                    <>
                        <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                            <ImageIcon className="w-6 h-6 text-gray-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-600 mb-1">
                            {isDragActive ? 'Suelta la imagen aquí' : 'Haz clic o arrastra una imagen'}
                        </p>
                        <p className="text-xs text-gray-500">
                            PNG, JPG o WEBP (máx. {maxSizeMB} MB)
                        </p>
                    </>
                )}
            </div>
            {spec && showSpec && <ImageSpecHint spec={spec} className="mt-2" />}
            {warnings.map((w, i) => (
                <p key={i} role="status" className="mt-2 flex gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{w}
                </p>
            ))}
            {error && <p role="alert" className="mt-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">{error}</p>}
        </div>
    )
}

/** Recuadro con las medidas recomendadas (una sola vez para un grupo de imágenes). */
export function ImageSpecHint({ spec, className = '' }: { spec: ImageSpec; className?: string }) {
    return (
        <div className={`flex gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs sm:text-sm text-blue-900 ${className}`}>
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
                <strong>Medida ideal: {spec.width} × {spec.height} px</strong> (mínimo {spec.min} × {spec.min} px).
                {spec.note && <> {spec.note}.</>}
                {spec.printed && <> En el documento se imprime de {spec.printed}.</>}
                {' '}Si la imagen es más grande, la ajustamos automáticamente.
            </p>
        </div>
    )
}
