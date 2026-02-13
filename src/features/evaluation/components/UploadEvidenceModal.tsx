import { useState, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import {
    X,
    Upload,
    Camera,
    Image as ImageIcon,
    FileText,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    BookOpen,
    Sparkles,
    Award
} from 'lucide-react'
import Webcam from 'react-webcam'

interface UploadEvidenceModalProps {
    isOpen: boolean
    onClose: () => void
    studentId: string
    onSuccess: () => void
}

const CATEGORIES = [
    { id: 'CLASSWORK', label: 'Trabajo en Clase', icon: BookOpen },
    { id: 'PROJECT', label: 'Proyecto', icon: Sparkles },
    { id: 'EXAM', label: 'Examen / Prueba', icon: FileText },
    { id: 'EXTRA', label: 'Actividad Extra', icon: Award }
]

export const UploadEvidenceModal = ({ isOpen, onClose, studentId, onSuccess }: UploadEvidenceModalProps) => {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('CLASSWORK')
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [isCameraActive, setIsCameraActive] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const webcamRef = useRef<Webcam>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            const reader = new FileReader()
            reader.onloadend = () => setPreview(reader.result as string)
            reader.readAsDataURL(selectedFile)
            setIsCameraActive(false)
        }
    }

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot()
        if (imageSrc) {
            setPreview(imageSrc)
            // Convert base64 to File
            fetch(imageSrc)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })
                    setFile(file)
                })
            setIsCameraActive(false)
        }
    }, [webcamRef])

    const handleUpload = async () => {
        if (!file || !title) return setError('El título y el archivo son obligatorios')
        setUploading(true)
        setError(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No se encontró sesión de usuario')

            // 1. Get Teacher Profile for tenant_id
            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('id', user.id)
                .single()

            if (!profile?.tenant_id) throw new Error('No se encontró información del plantel')

            const fileExt = file.name.split('.').pop()
            const fileName = `${studentId}/${Date.now()}.${fileExt}`
            const filePath = `evidence/${fileName}`

            // 2. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('student-evidence')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('student-evidence')
                .getPublicUrl(filePath)

            // 4. Insert into DB
            const { error: dbError } = await supabase
                .from('evidence_portfolio')
                .insert([{
                    tenant_id: profile.tenant_id,
                    student_id: studentId,
                    teacher_id: user.id,
                    title,
                    description,
                    file_url: publicUrl,
                    file_type: file.type.startsWith('image/') ? 'IMAGE' : 'FILE',
                    category
                }])

            if (dbError) throw dbError

            onSuccess()
            onClose()
            // Reset state
            setTitle('')
            setDescription('')
            setFile(null)
            setPreview(null)
        } catch (err: any) {
            console.error(err)
            setError(err.message || 'Error al subir la evidencia')
        } finally {
            setUploading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 bg-gradient-to-r from-indigo-600 to-violet-700 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Subir Evidencia</h2>
                        <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">Nuevo Trabajo del Alumno</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto max-h-[80vh]">
                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center text-rose-600 text-sm font-bold">
                            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Media Section */}
                        <div className="space-y-4">
                            <div className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2rem] overflow-hidden flex flex-col items-center justify-center relative group">
                                {isCameraActive ? (
                                    <div className="w-full h-full relative">
                                        <Webcam
                                            audio={false}
                                            ref={webcamRef}
                                            screenshotFormat="image/jpeg"
                                            className="w-full h-full object-cover"
                                            videoConstraints={{ facingMode: "environment" }}
                                        />
                                        <button
                                            onClick={capture}
                                            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-indigo-600 p-4 rounded-full shadow-xl hover:scale-110 transition-transform"
                                        >
                                            <Camera className="w-6 h-6" />
                                        </button>
                                    </div>
                                ) : preview ? (
                                    <div className="w-full h-full relative">
                                        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => { setPreview(null); setFile(null) }}
                                            className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center p-6">
                                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 mx-auto">
                                            <Upload className="w-8 h-8 text-indigo-500" />
                                        </div>
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Sube una foto o archivo</p>
                                        <p className="text-[10px] text-gray-300 mt-1 uppercase">PNG, JPG o PDF</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <label className="flex-1 bg-white border-2 border-indigo-100 text-indigo-600 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-center cursor-pointer hover:bg-indigo-50 transition-colors flex items-center justify-center">
                                    <ImageIcon className="w-4 h-4 mr-2" /> Archivo
                                    <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                                </label>
                                <button
                                    onClick={() => setIsCameraActive(!isCameraActive)}
                                    className={`flex-1 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center
                                        ${isCameraActive ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50'}`}
                                >
                                    <Camera className="w-4 h-4 mr-2" /> Cámara
                                </button>
                            </div>
                        </div>

                        {/* Details Section */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Título del Trabajo</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej. Mapa Mental del Porfiriato"
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 py-4 font-bold text-gray-900 outline-none transition-all text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Categoría</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategory(cat.id)}
                                            className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col gap-1
                                                ${category === cat.id
                                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                    : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'}`}
                                        >
                                            <cat.icon className={`w-4 h-4 ${category === cat.id ? 'text-indigo-600' : 'text-gray-300'}`} />
                                            <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-1">{cat.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Observaciones</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Detalles adicionales sobre el trabajo..."
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 py-4 font-medium text-gray-900 outline-none transition-all text-sm resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-10">
                        <button
                            onClick={handleUpload}
                            disabled={uploading || !file || !title}
                            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-30 disabled:scale-100 hover:-translate-y-1 active:scale-95 flex items-center justify-center"
                        >
                            {uploading ? (
                                <>Subiendo...</>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Confirmar y Guardar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
