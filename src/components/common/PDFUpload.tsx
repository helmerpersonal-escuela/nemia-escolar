import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileText, CheckCircle2, AlertCircle, X, UploadCloud, Loader2 } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '../../lib/supabase'

// Worker setup for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

interface PDFUploadProps {
    onUploadComplete: (url: string, extractedText: string) => void
    label?: string
    validationKeywords?: string[]
    currentFileUrl?: string
}

export const PDFUpload = ({ onUploadComplete, label = "Subir PDF", validationKeywords = [], currentFileUrl }: PDFUploadProps) => {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Extract text from PDF
    const extractText = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let fullText = ''

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items.map((item: any) => item.str).join(' ')
            fullText += pageText + '\n'
        }

        return fullText
    }

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const selectedFile = acceptedFiles[0]
        if (!selectedFile) return

        if (selectedFile.type !== 'application/pdf') {
            setError('Solo se permiten archivos PDF.')
            return
        }

        if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
            setError('El archivo no debe superar los 10MB.')
            return
        }

        setFile(selectedFile)
        setError(null)
        setSuccess(false)
    }, [])

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)
        setError(null)

        try {
            // 1. Extract and Validate Text
            const text = await extractText(file)

            if (validationKeywords.length > 0) {
                const missingKeywords = validationKeywords.filter(kw => !text.toLowerCase().includes(kw.toLowerCase()))

                if (missingKeywords.length > 0) {
                    // Soft validation warning, but allow proceed if user insists? 
                    // For now, strict validation as per requirement "revisar si cumple..."
                    // We can make it cleaner by throwing an error or just setting a warning state.
                    // Let's throw for now to ensure quality.
                    throw new Error(`El documento no parece cumplir con la estructura requerida. No se encontraron términos clave como: ${missingKeywords.slice(0, 3).join(', ')}`)
                }
            }

            // 2. Upload to Storage
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = `teacher-uploads/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('student-evidence') // Reusing existing bucket or create new. Let's use 'student-evidence' for now/simplicity but ideally 'teacher-uploads'
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('student-evidence')
                .getPublicUrl(filePath)

            // 3. Callback
            onUploadComplete(publicUrl, text)
            setSuccess(true)
            setFile(null) // Reset file input

        } catch (err: any) {
            console.error(err)
            setError(err.message || 'Error al procesar el archivo.')
        } finally {
            setUploading(false)
        }
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1 })

    return (
        <div className="w-full">
            {!file && !success && (
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                        ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'}`}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
                            <UploadCloud className="w-6 h-6 text-indigo-500" />
                        </div>
                        <p className="text-sm font-bold text-gray-700">{label}</p>
                        <p className="text-xs text-gray-400 mt-1">Arrastra tu PDF aquí o haz clic</p>
                    </div>
                    {currentFileUrl && (
                        <div className="mt-4 pt-4 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Archivo Actual</p>
                            <a
                                href={currentFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                Ver Documento Cargado
                            </a>
                        </div>
                    )}
                </div>
            )}

            {file && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center overflow-hidden">
                            <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                                <FileText className="w-5 h-5 text-rose-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setFile(null)}
                            className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600"
                            disabled={uploading}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start text-rose-600 text-xs font-bold">
                            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            'Subir y Validar'
                        )}
                    </button>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in zoom-in-95">
                    <div className="flex items-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mr-2" />
                        <span className="text-sm font-bold text-emerald-700">Documento cargado correctamente</span>
                    </div>
                    <button
                        onClick={() => setSuccess(false)}
                        className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                        Subir otro
                    </button>
                </div>
            )}
        </div>
    )
}
