import { useRef } from 'react'
import { Printer } from 'lucide-react'

interface DocumentProps {
    type: 'COMPROMISO_CONDUCTA' | 'INASISTENCIAS' | 'RETARDOS' | 'INCIDENCIAS_LEVES'
    data: any
    onClose: () => void
}

export const DocumentGenerator = ({ type, data, onClose }: DocumentProps) => {
    const printRef = useRef<HTMLDivElement>(null)

    const handlePrint = () => {
        if (!printRef.current) return
        const printContent = printRef.current.innerHTML
        const originalContent = document.body.innerHTML
        document.body.innerHTML = printContent
        window.print()
        document.body.innerHTML = originalContent
        window.location.reload() // Restore React app state
    }

    const currentDate = new Date().toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    const Header = () => (
        <div className="flex items-center justify-between mb-8 border-b-2 border-black pb-4">
            <div className="w-20">
                {/* Logo Placeholder */}
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-xs text-center font-bold">
                    LOGO
                </div>
            </div>
            <div className="text-center flex-1">
                <h2 className="text-xl font-bold uppercase">Escuela Secundaria Técnica No. 123</h2>
                <h3 className="text-sm font-medium uppercase">Clave: 1234567890</h3>
                <p className="text-xs">Departamento de Apoyo Educativo</p>
            </div>
            <div className="w-20 text-right text-xs">
                <p>{currentDate}</p>
                <p>Folio: {data.folio || 'S/N'}</p>
            </div>
        </div>
    )

    const Signatures = () => (
        <div className="mt-16 grid grid-cols-3 gap-8 text-center text-xs">
            <div className="border-t border-black pt-2">
                <p className="font-bold">{data.studentName}</p>
                <p>Alumno(a)</p>
            </div>
            <div className="border-t border-black pt-2">
                <p className="font-bold">{data.parentName}</p>
                <p>Padre o Tutor</p>
            </div>
            <div className="border-t border-black pt-2">
                <p className="font-bold">{data.staffName}</p>
                <p>Apoyo Educativo / Trabajo Social</p>
            </div>
        </div>
    )

    const renderContent = () => {
        switch (type) {
            case 'COMPROMISO_CONDUCTA':
                return (
                    <div className="space-y-6 text-justify">
                        <h1 className="text-center text-lg font-bold uppercase mb-6">Carta Compromiso de Conducta</h1>

                        <p>
                            Por medio de la presente, yo <strong>{data.studentName}</strong>, alumno(a) del grupo <strong>{data.group}</strong>,
                            en presencia de mi padre/tutor <strong>{data.parentName}</strong>, establezco el siguiente compromiso con la institución educativa
                            debido a los siguientes antecedentes:
                        </p>

                        <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg text-sm">
                            <strong>Antecedentes:</strong>
                            <p className="mt-1 whitespace-pre-wrap">{data.antecedents || 'Sin antecedentes registrados.'}</p>
                        </div>

                        <div className="my-4">
                            <h3 className="font-bold mb-2">Me comprometo a:</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                {data.agreements ? (
                                    data.agreements.split('\n').map((a: string, i: number) => <li key={i}>{a}</li>)
                                ) : (
                                    <>
                                        <li>Cumplir con el Reglamento Escolar vigente.</li>
                                        <li>Mejorar mi conducta dentro y fuera del aula.</li>
                                        <li>Asistir puntualmente a todas mis clases.</li>
                                        <li>Respetar a mis compañeros y personal docente.</li>
                                    </>
                                )}
                            </ul>
                        </div>

                        <div className="bg-red-50 p-4 border border-red-100 rounded-lg text-sm text-red-800">
                            <strong>Consecuencias de incumplimiento:</strong>
                            <p className="mt-1">
                                El incumplimiento de este compromiso derivará en las sanciones establecidas en el Reglamento Escolar,
                                que pueden incluir suspensión temporal o condicionamiento de la permanencia en la institución.
                            </p>
                        </div>
                    </div>
                )

            case 'INASISTENCIAS':
                return (
                    <div className="space-y-6 text-justify">
                        <h1 className="text-center text-lg font-bold uppercase mb-6">Reporte de Inasistencias</h1>
                        <p>
                            Se hace constar que el alumno(a) <strong>{data.studentName}</strong> del grupo <strong>{data.group}</strong>,
                            ha acumulado un total de <strong>{data.count}</strong> faltas {data.justified ? 'justificadas' : 'injustificadas'}
                            durante el periodo actual.
                        </p>
                        <div className="border border-gray-300 rounded p-4">
                            <h3 className="font-bold mb-2 text-sm text-center">Detalle de Fechas</h3>
                            <div className="grid grid-cols-4 gap-2 text-xs text-center">
                                {data.dates?.map((d: string) => <span key={d} className="bg-gray-100 p-1">{d}</span>)}
                            </div>
                        </div>
                        <p>
                            Se solicita al padre o tutor justificar estas ausencias o tomar las medidas necesarias para garantizar
                            la asistencia regular del alumno.
                        </p>
                    </div>
                )

            case 'RETARDOS':
                return (
                    <div className="space-y-6 text-justify">
                        <h1 className="text-center text-lg font-bold uppercase mb-6">Aviso de Retardos Acumulados</h1>
                        <p>
                            Se informa que el alumno(a) <strong>{data.studentName}</strong> presenta una incidencia recurrente de
                            llegadas tardías a la institución/clases.
                        </p>
                        <div className="flex justify-center my-6">
                            <div className="text-center p-4 border-2 border-dashed border-gray-300 rounded-xl">
                                <span className="block text-4xl font-black">{data.count}</span>
                                <span className="text-sm uppercase font-bold">Retardos Acumulados</span>
                            </div>
                        </div>
                        <p>
                            La puntualidad es un hábito formativo fundamental. Solicitamos su apoyo para corregir esta situación.
                        </p>
                    </div>
                )

            case 'INCIDENCIAS_LEVES':
                return (
                    <div className="space-y-6 text-justify">
                        <h1 className="text-center text-lg font-bold uppercase mb-6">Reporte de Incidencias Leves</h1>
                        <p>
                            Reporte de conductas que, aunque leves, afectan el desarrollo armónico de las actividades escolares
                            por parte del alumno(a) <strong>{data.studentName}</strong>.
                        </p>
                        <table className="w-full border-collapse border border-gray-300 text-sm mt-4">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-300 p-2">Fecha</th>
                                    <th className="border border-gray-300 p-2">Incidencia (Uniforme, Material, etc.)</th>
                                    <th className="border border-gray-300 p-2">Observaciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.incidents?.map((inc: any, idx: number) => (
                                    <tr key={idx}>
                                        <td className="border border-gray-300 p-2 text-center">{inc.date}</td>
                                        <td className="border border-gray-300 p-2">{inc.type}</td>
                                        <td className="border border-gray-300 p-2">{inc.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )

            default:
                return <p>Documento no disponible.</p>
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white">
            <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col print:shadow-none print:w-full print:h-full print:max-w-none print:max-h-none print:rounded-none">

                {/* Visual Header (No Print) */}
                <div className="p-4 border-b flex justify-between items-center print:hidden bg-slate-50 sticky top-0 z-10">
                    <h3 className="font-bold text-slate-700">Vista Previa de Documento</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700">
                            <Printer className="w-4 h-4" /> Imprimir
                        </button>
                        <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-sm">
                            Cerrar
                        </button>
                    </div>
                </div>

                {/* Printable Area */}
                <div ref={printRef} className="p-12 print:p-8 text-black bg-white min-h-[800px]">
                    <Header />
                    {renderContent()}
                    <Signatures />

                    {/* Footer */}
                    <div className="mt-12 pt-4 border-t border-gray-200 text-[10px] text-center text-gray-400 print:fixed print:bottom-8 print:left-0 print:right-0">
                        Documento generado por Vunlek - {currentDate}
                    </div>
                </div>
            </div>
        </div>
    )
}
