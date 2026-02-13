import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface ImageUploadProps {
    currentUrl?: string | null
    onUpload: (url: string) => void
    label: string
    bucket?: string
    maxSizeMB?: number // Default 2MB
}

export const ImageUpload = ({ currentUrl, onUpload, label, bucket = 'school-assets', maxSizeMB = 2 }: ImageUploadProps) => {
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState<string | null>(currentUrl || null)

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0]
        if (!file) return

        if (file.size > maxSizeMB * 1024 * 1024) {
            alert(`El archivo es demasiado grande. El tamaño máximo es ${maxSizeMB}MB.`)
            return
        }

        setUploading(true)
        try {
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
            alert('Error al subir imagen: ' + error.message)
        } finally {
            setUploading(false)
        }
    }, [bucket, maxSizeMB, onUpload])

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
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600 mb-1">
                            {isDragActive ? 'Suelta la imagen aquí' : 'Haz clic o arrastra una imagen'}
                        </p>
                        <p className="text-xs text-gray-400">
                            PNG, JPG, WEBP (Máx. {maxSizeMB}MB)
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
