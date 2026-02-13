import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, CreditCard, Edit, Trash2, BookOpen, UserPlus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { AddStudentModal } from '../components/AddStudentModal'
import { StudentCredential } from '../components/StudentCredential'
import { CriteriaManager } from '../../evaluation/components/CriteriaManager'

import { EditGroupModal } from '../components/EditGroupModal'
import { useTenant } from '../../../hooks/useTenant'

export const GroupDetailsPage = () => {
    const { groupId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { data: tenant } = useTenant()

    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
    const [selectedStudent, setSelectedStudent] = useState<any>(null)
    const [showCredential, setShowCredential] = useState(false)
    const [activeTab, setActiveTab] = useState<'students' | 'evaluation'>('students')
    const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)

    useEffect(() => {
        if (location.state?.openAddStudent) {
            setIsAddModalOpen(true)
            // clear state so it doesn't reopen on refresh? 
            // window.history.replaceState({}, document.title) 
            // React Router specific cleaning is cleaner but checking state existence is enough for now
        }
    }, [location.state])

    // 1. Fetch Group Info
    const { data: group, isLoading: loadingGroup } = useQuery({
        queryKey: ['group', groupId],
        enabled: !!groupId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('groups')
                .select('*')
                .eq('id', groupId)
                .single()
            if (error) throw error
            return data
        }
    })

    // 2. Fetch Students
    const { data: students, isLoading: loadingStudents, refetch } = useQuery({
        queryKey: ['students', groupId],
        enabled: !!groupId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('group_id', groupId)
                .order('last_name_paternal', { ascending: true })
            if (error) throw error
            return data
        }
    })

    // 3. Fetch Evaluation Periods
    const { data: periods } = useQuery({
        queryKey: ['periods', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('evaluation_periods')
                .select('*')
                .eq('tenant_id', tenant?.id)
                .order('start_date', { ascending: true })
            if (error) throw error

            if (data && data.length > 0 && !selectedPeriodId) {
                setSelectedPeriodId(data[0].id)
            }
            return data
        }
    })

    const handleDeleteStudent = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este alumno?')) return
        await supabase.from('students').delete().eq('id', id)
        refetch()
    }

    const handleDeleteGroup = async () => {
        const confirmMessage = `¿ESTÁS SEGURO? 
        
Se eliminará el grupo ${group.grade}° "${group.section}" y TODOS sus alumnos.
        
Esta acción NO se puede deshacer.`

        if (!confirm(confirmMessage)) return

        const { error } = await supabase.from('groups').delete().eq('id', groupId)

        if (error) {
            alert('Error al eliminar grupo: ' + error.message)
        } else {
            navigate('/groups')
        }
    }

    if (loadingGroup || loadingStudents) return <div className="p-8 text-center">Cargando...</div>
    if (!group) return <div className="p-8 text-center text-red-600">Grupo no encontrado</div>

    if (!group) return <div className="p-8 text-center text-red-600">Grupo no encontrado</div>

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-50" />
                <div className="relative z-10 font-sans">
                    <button onClick={() => navigate('/groups')} className="text-gray-500 hover:text-blue-600 flex items-center mb-4 transition-colors font-medium">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver a Grupos
                    </button>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
                                Grupo {group.grade}° "{group.section}"
                            </h1>
                            <p className="text-lg text-gray-600 font-medium">
                                Administración de Alumnos y Criterios de Evaluación
                            </p>
                            <div className="flex items-center space-x-2 mt-4">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-white border border-gray-200 text-gray-600 shadow-sm">
                                    {group.shift === 'MORNING' ? 'Matutino' : group.shift === 'AFTERNOON' ? 'Vespertino' : 'Tiempo Completo'}
                                </span>
                                <span className="text-gray-300">|</span>
                                <span className="text-sm text-gray-500 font-bold">{students?.length || 0} Alumnos Inscritos</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => navigate(`/gradebook?groupId=${groupId}`)}
                                className="flex items-center px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 font-bold shadow-sm transition-all"
                            >
                                <BookOpen className="h-5 w-5 mr-2" />
                                Ir a Libreta
                            </button>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 hover:scale-105 transition-all"
                            >
                                <UserPlus className="h-5 w-5 mr-2" />
                                Agregar Alumno
                            </button>
                            <div className="flex bg-gray-100 rounded-xl p-1">
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm"
                                    title="Editar Grupo"
                                >
                                    <Edit className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={handleDeleteGroup}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-white rounded-lg transition-all shadow-sm"
                                    title="Eliminar Grupo"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('students')}
                        className={`${activeTab === 'students'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Alumnos
                    </button>
                    <button
                        onClick={() => setActiveTab('evaluation')}
                        className={`${activeTab === 'evaluation'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Criterios de Evaluación
                    </button>
                </nav>
            </div>

            {/* Students List */}
            {activeTab === 'students' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-700">Lista de Alumnos ({students?.length || 0})</h3>
                        {/* <span className="text-xs text-gray-500">Máximo 50</span> */}
                    </div>

                    {students?.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No hay alumnos registrados en este grupo.
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Foto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre Completo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CURP</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {students?.map((student: any) => (
                                    <tr key={student.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {student.photo_url ? (
                                                <img src={student.photo_url} alt="" className="h-10 w-10 rounded-full object-cover border" />
                                            ) : (
                                                <img
                                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.curp || student.first_name}&gender=${student.gender === 'MUJER' ? 'female' : 'male'}`}
                                                    alt=""
                                                    className="h-10 w-10 rounded-full object-cover border bg-gray-100"
                                                />
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {student.last_name_paternal} {student.last_name_maternal} {student.first_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {student.curp || '---'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => { setSelectedStudent(student); setShowCredential(true); }}
                                                    className="text-blue-600 hover:text-blue-900 p-1 bg-blue-50 rounded" title="Generar Credencial"
                                                >
                                                    <CreditCard className="h-4 w-4" />
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setEditingStudentId(student.id);
                                                        setIsAddModalOpen(true);
                                                    }}
                                                    className="text-gray-600 hover:text-gray-900 p-1 hover:bg-gray-100 rounded" title="Editar"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteStudent(student.id)}
                                                    className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded" title="Eliminar"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )
            }

            {/* Evaluation Criteria Tab */}
            {activeTab === 'evaluation' && (
                <div className="space-y-4">
                    {/* Period Selector */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center space-x-4">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Trimestre:</span>
                        <div className="flex flex-wrap gap-2">
                            {periods?.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPeriodId(p.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedPeriodId === p.id
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {p.name}
                                </button>
                            ))}
                            {(!periods || periods.length === 0) && (
                                <span className="text-sm text-gray-400 italic">No hay trimestres configurados</span>
                            )}
                        </div>
                    </div>

                    {/* Criteria Manager */}
                    <div className="h-[600px]">
                        {selectedPeriodId ? (
                            <CriteriaManager
                                periodId={selectedPeriodId}
                                groupId={groupId!}
                            />
                        ) : (
                            <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 h-full flex flex-col items-center justify-center text-center p-8">
                                <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
                                <h3 className="font-bold text-gray-500 mb-2">Selecciona un trimestre</h3>
                                <p className="text-sm text-gray-400 max-w-xs">Configura las fechas de los trimestres en el menú de Evaluación para empezar.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            {
                tenant?.id && (
                    <AddStudentModal
                        isOpen={isAddModalOpen}
                        onClose={() => {
                            setIsAddModalOpen(false)
                            setEditingStudentId(null)
                        }}
                        groupId={groupId!}
                        tenantId={tenant.id}
                        onSuccess={() => {
                            refetch()
                            setEditingStudentId(null)
                        }}
                        studentId={editingStudentId}
                    />
                )
            }

            {/* Credential Modal Preview */}
            {
                showCredential && selectedStudent && tenant && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
                        <div className="bg-white p-6 rounded-lg max-w-lg w-full">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">Vista Previa de Credencial</h3>
                                <button onClick={() => setShowCredential(false)}><XIcon /></button>
                            </div>

                            <div className="flex justify-center p-4 border rounded bg-gray-100 mb-4 print:p-0 print:border-none print:bg-white">
                                <StudentCredential
                                    student={{ ...selectedStudent, group: { grade: group.grade, section: group.section } }}
                                    school={{
                                        name: tenant.name || 'Escuela',
                                        educational_level: tenant.educationalLevel || 'Secundaria',
                                        cct: tenant.cct || 'SC',
                                        logo_url: '/logo-placeholder.png'
                                    }}
                                />
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button onClick={() => setShowCredential(false)} className="px-4 py-2 text-gray-600">Cerrar</button>
                                <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                    Imprimir
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Group Modal */}
            {group && (
                <EditGroupModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSuccess={() => {
                        window.location.reload()
                    }}
                    group={group}
                />
            )}
        </div>
    )
}

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
)
