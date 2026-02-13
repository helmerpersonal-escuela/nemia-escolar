
import { AlertCircle, ArrowRight, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface NoPlanningAlertProps {
    groupId: string
    subjectId: string
    subjectName?: string
}

export const NoPlanningAlert = ({ groupId, subjectId, subjectName }: NoPlanningAlertProps) => {
    const navigate = useNavigate()

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 mb-6">
            <div className="flex items-start space-x-4 mb-4 md:mb-0">
                <div className="bg-amber-100 p-3 rounded-full">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">
                        Falta la Planeación Didáctica {subjectName ? `de ${subjectName}` : ''}
                    </h3>
                    <p className="text-gray-600 max-w-xl mt-1">
                        Para poder evaluar y crear actividades con Inteligencia Artificial, primero necesitas definir tu planeación didáctica para este grupo y materia.
                    </p>
                </div>
            </div>

            <button
                onClick={() => navigate(`/planning?groupId=${groupId}&subjectId=${subjectId}`)}
                className="group flex items-center px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-200 transition-all whitespace-nowrap"
            >
                <FileText className="w-5 h-5 mr-2" />
                Crear Planeación
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
    )
}
