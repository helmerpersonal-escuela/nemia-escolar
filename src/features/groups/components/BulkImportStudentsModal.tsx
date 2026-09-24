import { useState, useRef } from 'react'
import { X, Upload, FileDown, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface Props {
    isOpen: boolean
    onClose: () => void
    groupId: string
    tenantId: string
    onSuccess: () => void
}

export const BulkImportStudentsModal = ({ isOpen, onClose, groupId, tenantId, onSuccess }: Props) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successCount, setSuccessCount] = useState<number | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const downloadTemplate = () => {
        const headers = [
            'Nombre_Alumno',
            'Apellido_Paterno_Alumno',
            'Apellido_Materno_Alumno',
            'Sexo_Alumno',
            'Nombre_Tutor',
            'Apellido_Paterno_Tutor',
            'Apellido_Materno_Tutor',
            'Correo_Acceso_Tutor',
            'Telefono_Tutor'
        ].join(',')

        const exampleRow = [
            'JUAN PABLO',
            'PEREZ',
            'LOPEZ',
            'HOMBRE',
            'MARIA',
            'LOPEZ',
            'GARCIA',
            'maria@ejemplo.com',
            '5551234567'
        ].join(',')

        const csvContent = "data:text/csv;charset=utf-8," + headers + "\\n" + exampleRow
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", "Plantilla_Alumnos.csv")
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const parseCSV = (text: string) => {
        const lines = text.split(/\\r?\\n/)
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

        const results = []
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue
            const currentline = lines[i].split(',')
            const obj: any = {}
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentline[j] ? currentline[j].trim() : ''
            }
            results.push(obj)
        }
        return results
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        setError(null)
        setSuccessCount(null)

        try {
            const text = await file.text()
            const records = parseCSV(text)

            if (records.length === 0) {
                throw new Error("El archivo está vacío o no tiene el formato correcto.")
            }

            let inserted = 0

            for (const row of records) {
                // Determine mandatory fields for student
                const studentFirstName = row['nombre_alumno'] || row['nombre alumno'] || row['nombre']
                const studentPaternal = row['apellido_paterno_alumno'] || row['apellido paterno alumno'] || row['apellido paterno']
                const studentMaternal = row['apellido_materno_alumno'] || row['apellido materno alumno'] || row['apellido materno'] || ''
                const studentGender = (row['sexo_alumno'] || row['sexo alumno'] || row['sexo']).toUpperCase()

                if (!studentFirstName || !studentPaternal) continue // Skip invalid rows

                const gender = studentGender.includes('MUJER') || studentGender === 'F' ? 'MUJER' : 'HOMBRE'

                // 1. Insert Student
                const studentPayload = {
                    tenant_id: tenantId,
                    group_id: groupId,
                    first_name: studentFirstName.toUpperCase(),
                    last_name_paternal: studentPaternal.toUpperCase(),
                    last_name_maternal: studentMaternal.toUpperCase(),
                    gender: gender,
                    condition: 'Ninguna'
                }

                const { data: studentData, error: studentError } = await supabase
                    .from('students')
                    .insert(studentPayload)
                    .select()
                    .single()

                if (studentError) {
                    console.error("Error inserting student", studentPayload, studentError)
                    continue
                }

                inserted++

                // 2. Insert Tutor if provided
                const tutorFirstName = row['nombre_tutor'] || row['nombre tutor']
                const tutorPaternal = row['apellido_paterno_tutor'] || row['apellido paterno tutor']
                const tutorMaternal = row['apellido_materno_tutor'] || row['apellido materno tutor'] || ''
                const tutorEmail = row['correo_acceso_tutor'] || row['correo acceso tutor'] || row['correo tutor'] || null
                const tutorPhone = row['telefono_tutor'] || row['telefono tutor'] || null

                if (tutorFirstName && tutorPaternal) {
                    const tutorPayload = {
                        student_id: studentData.id,
                        tenant_id: tenantId,
                        first_name: tutorFirstName.toUpperCase(),
                        last_name_paternal: tutorPaternal.toUpperCase(),
                        last_name_maternal: tutorMaternal.toUpperCase(),
                        relationship: 'TUTOR LEGAL', // Default
                        email: tutorEmail,
                        phone: tutorPhone
                    }

                    await supabase.from('guardians').insert(tutorPayload)
                }
            }

            setSuccessCount(inserted)
            onSuccess()
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (err: any) {
            console.error(err)
            setError(err.message || 'Error al procesar el archivo CSV.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="squishy-card max-w-lg w-full p-6 relative">
                <button aria-label="Cerrar" onClick={onClose} className="absolute right-4 top-4 text-gray-500 hover:text-gray-600">
                    <X className="h-6 w-6" />
                </button>

                <div className="mb-6">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Upload className="h-6 w-6 text-indigo-600" />
                        Importación Masiva
                    </h2>
                    <p className="text-slate-500 font-medium mt-1">
                        Sube un archivo CSV usando nuestra plantilla para registrar múltiples alumnos y sus tutores simultáneamente.
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <span className="text-sm font-bold">{error}</span>
                    </div>
                )}

                {successCount !== null && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700 animate-in fade-in zoom-in">
                        <CheckCircle2 className="h-6 w-6 flex-shrink-0" />
                        <div>
                            <p className="font-black text-lg">¡Importación Exitosa!</p>
                            <p className="text-sm font-medium">Se registraron {successCount} alumnos correctamente.</p>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Step 1: Download Template */}
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black flex-shrink-0">1</div>
                            <div>
                                <h3 className="font-bold text-slate-800 mb-1">Descarga la plantilla</h3>
                                <p className="text-sm text-slate-500 mb-3">
                                    Abre el archivo en Excel o Google Sheets, llena los datos sin modificar los encabezados, y guárdalo como CSV.
                                </p>
                                <button
                                    onClick={downloadTemplate}
                                    className="flex items-center text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                    <FileDown className="h-4 w-4 mr-1" />
                                    Descargar Plantilla_Alumnos.csv
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Upload CSV */}
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black flex-shrink-0">2</div>
                            <div className="w-full">
                                <h3 className="font-bold text-slate-800 mb-1">Sube el archivo lleno</h3>
                                <p className="text-sm text-slate-500 mb-3">
                                    Asegúrate de que el formato sea .csv y no excel regular (.xlsx).
                                </p>

                                <div className="mt-2">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        id="csvUpload"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={loading}
                                        ref={fileInputRef}
                                    />
                                    <label
                                        htmlFor="csvUpload"
                                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 cursor-pointer transition-colors shadow-sm disabled:opacity-50 btn-tactile"
                                    >
                                        {loading ? (
                                            <><Loader2 className="h-5 w-5 animate-spin" /> Procesando filas...</>
                                        ) : (
                                            <><Upload className="h-5 w-5" /> Seleccionar Archivo CSV</>
                                        )}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        {successCount !== null ? 'Cerrar' : 'Cancelar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
