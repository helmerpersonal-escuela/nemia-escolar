import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import {
    FileText,
    Plus,
    Search,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    ArrowRight,
    Printer,
    User,
    Users
} from 'lucide-react'
import { DocumentGenerator } from '../../../../features/documents/DocumentGenerator'
import { TrackingEntryModal } from './TrackingEntryModal'

export const TrackingPage = () => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [trackingItems, setTrackingItems] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('ALL') // ALL, ENTREVISTA, CANALIZACION, BITACORA

    // Document Generation State
    const [showDocumentModal, setShowDocumentModal] = useState(false)
    const [selectedDocumentType, setSelectedDocumentType] = useState<any>(null)
    const [selectedStudentForDoc, setSelectedStudentForDoc] = useState<any>(null)

    // Entry Modal
    const [showEntryModal, setShowEntryModal] = useState(false)

    useEffect(() => {
        if (!tenant) return
        fetchTrackingItems()
    }, [tenant, filterType])

    const fetchTrackingItems = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('student_tracking')
                .select(`
                    *,
                    students (
                        id,
                        first_name,
                        last_name_paternal,
                        groups (grade, section)
                    )
                `)
                .eq('tenant_id', tenant?.id)
                .order('created_at', { ascending: false })

            if (filterType !== 'ALL') {
                query = query.eq('type', filterType)
            }

            const { data, error } = await query
            if (error) throw error
            setTrackingItems(data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateDocument = (type: string, student: any) => {
        setSelectedDocumentType(type)
        setSelectedStudentForDoc({
            studentName: `${student.first_name} ${student.last_name_paternal}`,
            group: `${student.groups?.grade}° ${student.groups?.section}`,
            parentName: 'Nombre del Tutor (Pendiente)', // In real app, fetch parent
            staffName: 'Personal de Apoyo', // Current user name
            folio: Math.floor(Math.random() * 10000).toString().padStart(5, '0'),
            // Mock data for preview, in real app we'd fetch specific data
            antecedents: 'El alumno ha presentado incidencias reiteradas en conducta...',
            count: 3 // Example count for absences
        })
        setShowDocumentModal(true)
    }

    const filteredItems = trackingItems.filter(item =>
        item.students?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.students?.last_name_paternal.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Seguimiento de Casos</h1>
                    <p className="text-slate-500 text-sm">Entrevistas con Padres, Canalizaciones y Bitácora</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowEntryModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Nueva Entrada
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre de alumno..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-100"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    {['ALL', 'ENTREVISTA', 'CANALIZACION', 'SEGUIMIENTO', 'BITACORA'].map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${filterType === type
                                ? 'bg-slate-800 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            {type === 'ALL' ? 'Todos' : type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="text-center py-12 text-slate-400">Cargando registros...</div>
            ) : filteredItems.length > 0 ? (
                <div className="grid gap-4">
                    {filteredItems.map(item => (
                        <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-100 transition-all group">
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="flex gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.type === 'ENTREVISTA' ? 'bg-purple-50 text-purple-600' :
                                        item.type === 'CANALIZACION' ? 'bg-amber-50 text-amber-600' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                        {item.type === 'ENTREVISTA' ? <Users className="w-6 h-6" /> :
                                            item.type === 'CANALIZACION' ? <ArrowRight className="w-6 h-6" /> :
                                                <FileText className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-800">{item.students?.first_name} {item.students?.last_name_paternal}</h3>
                                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-500">
                                                {item.students?.groups?.grade}° "{item.students?.groups?.section}"
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black text-white uppercase ${item.severity === 'ALTA' ? 'bg-red-500' :
                                                item.severity === 'MEDIA' ? 'bg-amber-400' : 'bg-blue-400'
                                                }`}>
                                                {item.severity}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-600 mb-2">{item.title}</p>
                                        <div className="flex items-center gap-4 text-xs text-slate-400">
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(item.created_at).toLocaleDateString()}</span>
                                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> Registrado por Personal</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.status === 'EN_PROCESO' ? 'bg-blue-50 text-blue-600' :
                                        item.status === 'CERRADO' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {item.status.replace('_', ' ')}
                                    </span>

                                    {/* Action Buttons for Document Generation (Demo) */}
                                    <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleGenerateDocument('COMPROMISO_CONDUCTA', item.students)}
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 tooltip"
                                            title="Generar Compromiso"
                                        >
                                            <Printer className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 px-4 bg-white rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="font-bold text-slate-800">No se encontraron registros</h3>
                    <p className="text-sm text-slate-500">Intenta ajustar los filtros o crea una nueva entrada.</p>
                </div>
            )}

            {/* Document PDF Modal */}
            {showDocumentModal && selectedStudentForDoc && (
                <DocumentGenerator
                    type={selectedDocumentType}
                    data={selectedStudentForDoc}
                    onClose={() => setShowDocumentModal(false)}
                />
            )}

            {/* Entry Creation Modal */}
            {showEntryModal && (
                <TrackingEntryModal
                    onClose={() => setShowEntryModal(false)}
                    onSuccess={() => {
                        fetchTrackingItems()
                        setShowEntryModal(false)
                    }}
                />
            )}
        </div>
    )
}
