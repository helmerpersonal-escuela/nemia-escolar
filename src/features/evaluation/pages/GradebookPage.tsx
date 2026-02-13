
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { useOfflineSync } from '../../../hooks/useOfflineSync'
import {
    ArrowLeft,
    Plus,
    Search,
    Filter,
    Download,
    TrendingUp,
    BookOpen,
    Users,
    Calendar,
    CheckSquare,
    X,
    ArrowRight,
    Activity,
    Settings,
    QrCode,
    Lock,
    Unlock,
    Award,
    ChevronDown,
    Save,
    AlertTriangle
} from 'lucide-react'
import { CreateAssignmentModal } from '../components/CreateAssignmentModal'
import { GradingModal } from '../components/GradingModal'
import { ClosePeriodModal } from '../components/ClosePeriodModal'
import { CloseAcademicYearModal } from '../components/CloseAcademicYearModal'
import { NoPlanningAlert } from '../components/NoPlanningAlert'
import { ConductReportsTab } from '../components/ConductReportsTab'

export const GradebookPage = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const { isOnline, addToQueue, pendingCount } = useOfflineSync()

    const groupId = searchParams.get('groupId')
    const subjectId = searchParams.get('subjectId')

    const [loading, setLoading] = useState(true)
    const [group, setGroup] = useState<any>(null)
    const [students, setStudents] = useState<any[]>([])
    const [criteria, setCriteria] = useState<any[]>([])
    const [assignments, setAssignments] = useState<any[]>([])
    const [grades, setGrades] = useState<any[]>([])
    const [groupSubjects, setGroupSubjects] = useState<any[]>([])

    // Planning Check State
    const [hasCheckedPlanning, setHasCheckedPlanning] = useState(false)
    const [hasLessonPlan, setHasLessonPlan] = useState(true) // Default to true to prevent flash

    const [activeTab, setActiveTab] = useState<'EVALUATION' | 'ATTENDANCE' | 'REPORTS'>((searchParams.get('tab') as any) || 'ATTENDANCE')
    const [incidents, setIncidents] = useState<any[]>([])
    const [periods, setPeriods] = useState<any[]>([])
    const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(searchParams.get('periodId'))
    const [attendance, setAttendance] = useState<any[]>([])
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])
    const [attendanceMethod, setAttendanceMethod] = useState<'MANUAL' | 'QR' | 'BIOMETRIC'>('MANUAL')
    const [pendingAttendance, setPendingAttendance] = useState<Record<string, string>>({})
    const [isSavingAttendance, setIsSavingAttendance] = useState(false)
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false)
    const [isClosePeriodModalOpen, setIsClosePeriodModalOpen] = useState(false)
    const [isCloseYearModalOpen, setIsCloseYearModalOpen] = useState(false)
    const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<any>(null)
    const [selectedStudentForGrading, setSelectedStudentForGrading] = useState<any>(null)
    const [selectedCriterionForGrading, setSelectedCriterionForGrading] = useState<any>(null)
    const [editingAssignment, setEditingAssignment] = useState<any>(null)
    const [activeLessonPlanId, setActiveLessonPlanId] = useState<string | null>(null)

    // State for Group Selector fallback
    const [availableGroups, setAvailableGroups] = useState<any[]>([])

    const loadData = async () => {
        if (!tenant?.id) return

        // ... (lines omitted for brevity, keeping existing logic)
        if (!tenant?.id) return

        // If no groupId, fetch available groups to let user select
        if (!groupId) {
            setLoading(true)
            const { data: groupsData } = await supabase
                .from('groups')
                .select('*, academic_years(name)')
                .eq('tenant_id', tenant.id)
                .order('grade')
                .order('section')

            setAvailableGroups(groupsData || [])
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            // Fetch Periods
            const { data: periodsData } = await supabase
                .from('evaluation_periods')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('start_date')

            setPeriods(periodsData || [])

            // Set default period based on DATE
            let currentPeriodId = selectedPeriodId
            if (!currentPeriodId && periodsData && periodsData.length > 0) {
                const today = new Date().toISOString().split('T')[0]
                const active = periodsData.find(p => today >= p.start_date && today <= p.end_date) || periodsData[0]
                currentPeriodId = active.id
                setSelectedPeriodId(active.id)
            }

            const { data: groupData } = await supabase.from('groups').select('*').eq('id', groupId).single()
            const { data: studentsData } = await supabase.from('students').select('*').eq('group_id', groupId).order('last_name_paternal')

            if (!studentsData) return

            // Fetch Criteria for this group and period
            let criteriaQuery = supabase
                .from('evaluation_criteria')
                .select('*')
                .eq('group_id', groupId)

            if (currentPeriodId) {
                criteriaQuery = criteriaQuery.eq('period_id', currentPeriodId)
            }

            const { data: criteriaData } = await criteriaQuery

            // Fetch Assignments for this group and period
            const assignmentQuery = supabase
                .from('assignments')
                .select('*')
                .eq('group_id', groupId)

            // Period filtering is handled by filtering assignments by criterion_id (assignments -> criteria -> period)
            // assignments table does not have period_id column directly.

            if (subjectId) {
                assignmentQuery.eq('subject_id', subjectId)
            }
            const { data: assignmentsData } = await assignmentQuery

            const { data: gradesData } = await supabase
                .from('grades')
                .select('*')
                .in('student_id', studentsData.map(s => s.id))

            const { data: attendanceData } = await supabase
                .from('attendance')
                .select('id, student_id, date, status, subject_id')
                .eq('group_id', groupId)

            // Fetch Subjects for this group
            const { data: subjectsData } = await supabase
                .from('group_subjects')
                .select(`
                    id, 
                    subject_catalog_id, 
                    custom_name,
                    subject_catalog(name)
                `)
                .eq('group_id', groupId)

            const formattedSubjects = subjectsData?.map((gs: any) => ({
                id: gs.subject_catalog_id || gs.id,
                name: gs.subject_catalog?.name || gs.custom_name
            })) || []

            setGroupSubjects(formattedSubjects)

            // Fetch Incidents
            const { data: incidentsData } = await supabase
                .from('student_incidents')
                .select('*')
                .in('student_id', studentsData.map(s => s.id))
                .order('created_at', { ascending: false })

            setIncidents(incidentsData || [])

            // Auto-select subject if only one exists and none selected
            if (!subjectId && formattedSubjects.length === 1) {
                navigate(`/gradebook?groupId=${groupId}&subjectId=${formattedSubjects[0].id}${currentPeriodId ? `&periodId=${currentPeriodId}` : ''}`, { replace: true })
                return // Stop execution to let navigation happen
            }

            // If subjectId is in URL but not in the formattedSubjects (maybe it was deleted), clear it
            if (subjectId && !formattedSubjects.some(s => s.id === subjectId)) {
                navigate(`/gradebook?groupId=${groupId}${currentPeriodId ? `&periodId=${currentPeriodId}` : ''}`, { replace: true })
            }

            // CHECK PLANNING EXISTENCE
            if (subjectId) {
                let planningQuery = supabase
                    .from('lesson_plans')
                    .select('id')
                    .eq('group_id', groupId)
                    .eq('subject_id', subjectId)

                if (currentPeriodId) {
                    planningQuery = planningQuery.eq('period_id', currentPeriodId)
                }

                const { data: planningData } = await planningQuery
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                setHasLessonPlan(!!planningData)
                setActiveLessonPlanId(planningData?.id || null)
                setHasCheckedPlanning(true)
            } else {
                setHasCheckedPlanning(false)
            }

            setGroup(groupData)
            setStudents(studentsData || [])
            setCriteria(criteriaData || [])
            setAssignments(assignmentsData || [])
            setGrades(gradesData || [])
            setAttendance(attendanceData || [])
        } catch (err) {
            console.error('Error loading gradebook:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [tenant?.id, groupId, subjectId])

    useEffect(() => {
        const tab = searchParams.get('tab')
        if (tab && (tab === 'EVALUATION' || tab === 'ATTENDANCE' || tab === 'REPORTS')) {
            setActiveTab(tab as any)
        }
    }, [searchParams])

    const handleEditAssignment = (assignment: any) => {
        setEditingAssignment(assignment)
        setIsAssignmentModalOpen(true)
    }

    const handleDeleteAssignment = async (assignmentId: string) => {
        if (profile?.is_demo) {
            alert('Modo Demo: No puedes eliminar actividades en este perfil de prueba.')
            return
        }
        try {
            const { error } = await supabase
                .from('assignments')
                .delete()
                .eq('id', assignmentId)

            if (error) throw error

            // Update local state
            setAssignments(prev => prev.filter(a => a.id !== assignmentId))
            setGrades(prev => prev.filter(g => g.assignment_id !== assignmentId))
        } catch (error) {
            console.error('Error deleting assignment:', error)
            alert('Error al eliminar la actividad')
        }
    }

    const calculateProgress = (studentId: string) => {
        let totalWeightedScore = 0

        criteria.forEach(criterion => {
            const criterionAssignments = assignments.filter(a => a.criterion_id === criterion.id)
            if (criterionAssignments.length === 0) return

            let criterionTotal = 0
            let gradedCount = 0

            criterionAssignments.forEach(asm => {
                const grade = grades.find(g => g.assignment_id === asm.id && g.student_id === studentId)
                if (grade?.is_graded) {
                    criterionTotal += (grade.score || 0)
                    gradedCount++
                }
            })

            if (gradedCount > 0) {
                const average = criterionTotal / gradedCount
                // Support both 'weight' and 'percentage' field names for robustness
                const weight = criterion.weight || criterion.percentage || 0
                totalWeightedScore += (average * (weight / 100))
            }
        })

        return totalWeightedScore.toFixed(1)
    }

    const handleAttendanceChange = (studentId: string, status: string) => {
        setPendingAttendance(prev => ({
            ...prev,
            [studentId]: status
        }))
    }

    const saveAttendance = async () => {
        if (profile?.is_demo) {
            alert('Modo Demo: El guardado de asistencias está deshabilitado.')
            return
        }
        if (!tenant?.id || !groupId || Object.keys(pendingAttendance).length === 0) return

        setIsSavingAttendance(true)

        if (!isOnline) {
            // OFFLINE LOGIC: Queue each attendance change
            try {
                for (const [studentId, status] of Object.entries(pendingAttendance)) {
                    addToQueue({
                        table: 'attendance',
                        action: 'UPSERT',
                        data: {
                            tenant_id: tenant.id,
                            group_id: groupId,
                            student_id: studentId,
                            date: attendanceDate,
                            status,
                            subject_id: subjectId || null
                        }
                    })
                }

                // Update local student records immediately for UI feel
                setAttendance(prev => {
                    const newAttendance = [...prev]
                    Object.entries(pendingAttendance).forEach(([studentId, status]) => {
                        const idx = newAttendance.findIndex(a => a.student_id === studentId && a.date === attendanceDate && (subjectId ? a.subject_id === subjectId : !a.subject_id))
                        if (idx >= 0) {
                            newAttendance[idx] = { ...newAttendance[idx], status }
                        } else {
                            newAttendance.push({
                                student_id: studentId,
                                date: attendanceDate,
                                status,
                                subject_id: subjectId || null
                            })
                        }
                    })
                    return newAttendance
                })

                setPendingAttendance({})
                alert('Modo Offline: Cambios guardados localmente. Se sincronizarán al recuperar internet.')
            } catch (err) {
                console.error('Offline queue error:', err)
                alert('Error al guardar localmente')
            } finally {
                setIsSavingAttendance(false)
            }
            return
        }

        try {
            // Manual Upsert Logic to avoid constraint name issues
            const updates = Object.entries(pendingAttendance).map(async ([studentId, status]) => {
                // Check if exists
                let query = supabase
                    .from('attendance')
                    .select('id')
                    .eq('student_id', studentId)
                    .eq('group_id', groupId)
                    .eq('date', attendanceDate)

                if (subjectId) {
                    query = query.eq('subject_id', subjectId)
                } else {
                    query = query.is('subject_id', null)
                }

                const { data: existing } = await query.maybeSingle()

                if (existing) {
                    return supabase
                        .from('attendance')
                        .update({ status })
                        .eq('id', existing.id)
                } else {
                    return supabase
                        .from('attendance')
                        .insert({
                            tenant_id: tenant.id,
                            group_id: groupId,
                            student_id: studentId,
                            date: attendanceDate,
                            status,
                            subject_id: subjectId || null
                        })
                }
            })

            await Promise.all(updates)

            const { data } = await supabase
                .from('attendance')
                .select('*')
                .eq('group_id', groupId)
            setAttendance(data || [])
            setPendingAttendance({})
            alert('Pase de lista guardado correctamente')

        } catch (err: any) {
            console.error('Error saving attendance:', err)
            if (err.message?.includes('duplicate key') || err.code === '23505') {
                alert('Ya existe un registro de asistencia para hoy. Por favor recarga la página para ver los datos actualizados e intenta de nuevo.')
            } else {
                alert('Error al guardar: ' + err.message)
            }
        } finally {
            setIsSavingAttendance(false)
        }
    }

    const handleMarkAllPresent = () => {
        const updates: Record<string, string> = {}
        students.forEach(student => {
            updates[student.id] = 'PRESENT'
        })
        setPendingAttendance(prev => ({ ...prev, ...updates }))
    }

    const getAttendanceSummary = (studentId: string) => {
        const studentRecords = attendance.filter(a =>
            a.student_id === studentId &&
            // Filter by subject if strictly selected, or include all if general view?
            // Usually we want summary per subject in Gradebook context
            (subjectId ? a.subject_id === subjectId : true)
        )
        return {
            present: studentRecords.filter(r => r.status === 'PRESENT').length,
            absent: studentRecords.filter(r => r.status === 'ABSENT').length,
            late: studentRecords.filter(r => r.status === 'LATE').length,
            excused: studentRecords.filter(r => r.status === 'EXCUSED').length,
        }
    }


    if (loading) return <div className="p-8 text-center">Cargando libreta...</div>

    // Check for Missing Planning (Only if specific subject selected)
    // We need state for this, adding it below to avoid full file rewrite issues
    // For now assuming we check it in loadData and store in a state variable `hasLessonPlan`
    if (groupId && subjectId && hasCheckedPlanning && !hasLessonPlan) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <button onClick={() => navigate('/groups', { replace: true })} className="text-gray-500 hover:text-gray-700 flex items-center">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver a Grupos
                    </button>
                </div>
                <NoPlanningAlert
                    groupId={groupId}
                    subjectId={subjectId}
                    subjectName={groupSubjects.find(s => s.id === subjectId)?.name}
                />
            </div>
        )
    }

    // FALLBACK: Group Selection
    if (!groupId) {
        return (
            <div className="max-w-5xl mx-auto p-8 animate-in fade-in duration-500">
                <div className="text-center mb-12">
                    <span className="p-3 bg-blue-100 rounded-full inline-block mb-4 shadow-sm">
                        <BookOpen className="w-8 h-8 text-blue-600" />
                    </span>
                    <h1 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">Libreta de Calificaciones</h1>
                    <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                        Selecciona un grupo para gestionar evaluaciones, asistencias y reportes de conducta.
                    </p>
                </div>

                {availableGroups.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-300 shadow-sm max-w-2xl mx-auto">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No hay grupos disponibles</h3>
                        <p className="text-gray-500 mb-6">Primero debes crear tus grupos en la sección correspondiente.</p>
                        <button
                            onClick={() => navigate('/groups')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-105 transition-all"
                        >
                            Ir a Mis Grupos
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {availableGroups.map(group => (
                            <button
                                key={group.id}
                                onClick={() => navigate(`/gradebook?groupId=${group.id}`, { replace: true })}
                                className="group bg-white p-8 rounded-3xl border border-gray-100 shadow-lg shadow-gray-100 hover:shadow-xl hover:scale-[1.02] hover:border-blue-200 transition-all text-left flex flex-col items-center justify-center space-y-4 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity">
                                    <BookOpen className="w-24 h-24 text-blue-600 transform -rotate-12" />
                                </div>

                                <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-inner">
                                    <span className="text-2xl font-black">{group.grade}°</span>
                                </div>

                                <div className="text-center relative z-10">
                                    <h3 className="text-2xl font-black text-gray-900 group-hover:text-blue-700 transition-colors">
                                        Grupo "{group.section}"
                                    </h3>
                                    <span className="inline-flex mt-2 items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-50 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                        {group.shift === 'MORNING' ? 'Matutino' : group.shift === 'AFTERNOON' ? 'Vespertino' : 'Tiempo Completo'}
                                    </span>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-50 w-full text-center">
                                    <span className="text-sm font-bold text-gray-400 group-hover:text-blue-500 flex items-center justify-center transition-colors">
                                        Abrir Libreta <ArrowRight className="w-4 h-4 ml-1" />
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate('/groups', { replace: true })} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate max-w-[200px] md:max-w-none">
                            Libreta: {group?.grade}° "{group?.section}"
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500 flex items-center mt-1">
                            <BookOpen className="w-3 h-3 md:w-4 md:h-4 mr-1 transition-colors shrink-0" />
                            <span className="truncate">
                                {activeTab === 'EVALUATION' ? 'Evaluación Académica' : 'Control de Asistencias'}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0 w-full md:w-auto">
                    {/* Subject Display - Read Only / Auto-Pulled */}
                    <div className="relative flex-1 md:flex-none flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 shadow-sm min-w-[140px] group/subject">
                        <BookOpen className="w-3 h-3 md:w-4 md:h-4 text-gray-500 mr-2 shrink-0" />
                        <span className="text-xs md:text-sm font-black text-gray-900 uppercase tracking-tight truncate max-w-[100px] md:max-w-none">
                            {groupSubjects.find(s => s.id === subjectId)?.name || 'Todas'}
                        </span>

                        {/* Only allow switching if NO subject is selected OR if multiple subjects exist and we want to allow it (though user requested to block it) */}
                        {groupSubjects.length > 1 && !subjectId && (
                            <>
                                <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-gray-400 ml-auto md:ml-2 group-hover/subject:text-gray-600" />
                                <select
                                    value={subjectId || ''}
                                    onChange={(e) => {
                                        navigate(`/gradebook?groupId=${groupId}${e.target.value ? `&subjectId=${e.target.value}` : ''}${selectedPeriodId ? `&periodId=${selectedPeriodId}` : ''}`, { replace: true })
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                >
                                    <option value="">Todas las Materias</option>
                                    {groupSubjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </>
                        )}
                    </div>

                    {/* Period Display - Auto-Pulled (No Edit) */}
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                        <Calendar className="w-3 h-3 md:w-4 md:h-4 text-gray-500 mr-2 shrink-0" />
                        <span className="text-xs md:text-sm font-black text-gray-900 uppercase tracking-tight">
                            {periods.find(p => p.id === selectedPeriodId)?.name?.split(' ')[0] || 'Actual'}
                        </span>
                    </div>

                    {activeTab === 'EVALUATION' ? (
                        !periods.find(p => p.id === selectedPeriodId)?.is_closed && (
                            <button
                                onClick={() => setIsAssignmentModalOpen(true)}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm transition-all font-medium"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Añadir Calificable
                            </button>
                        )
                    ) : (
                        <div className="flex items-center space-x-2">
                            <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
                                <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                                <input
                                    type="date"
                                    value={attendanceDate}
                                    onChange={(e) => setAttendanceDate(e.target.value)}
                                    className="border-none p-0 focus:ring-0 text-sm font-medium text-gray-700 bg-transparent"
                                />
                            </div>
                            {!periods.find(p => p.id === selectedPeriodId)?.is_closed && (
                                <div className="flex flex-col items-end">
                                    <div className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest">
                                        {Object.keys(pendingAttendance).length > 0 ? 'Cambios pendientes' : 'Sincronizado'}
                                    </div>
                                    {pendingCount > 0 && (
                                        <div className="text-[9px] text-blue-500 font-black animate-pulse uppercase">
                                            {pendingCount} por sincronizar...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => navigate(`/evaluation/setup?groupId=${groupId}${subjectId ? `&subjectId=${subjectId}` : ''}&periodId=${selectedPeriodId || ''}`)}
                        className="p-2 border border-indigo-200 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-2 shadow-sm"
                        title="Configurar Criterios de Evaluación"
                    >
                        <Settings className="w-5 h-5" />
                        <span className="hidden md:inline text-xs font-bold uppercase tracking-tight">Criterios</span>
                    </button>
                    <button
                        onClick={() => navigate(`/groups/${groupId}`)}
                        className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        title="Administración del Grupo"
                    >
                        <Users className="w-5 h-5 text-gray-600" />
                    </button>
                    {activeTab === 'EVALUATION' && selectedPeriodId && (() => {
                        const currentPeriod = periods.find(p => p.id === selectedPeriodId)
                        if (!currentPeriod) return null

                        if (currentPeriod.is_closed) {
                            const allPeriodsClosed = periods.length > 0 && periods.every(p => p.is_closed)

                            return (
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center px-3 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shadow-sm" title="Periodo Cerrado - Solo Lectura">
                                        <Lock className="w-4 h-4 mr-2" />
                                        <span className="text-sm font-bold">Cerrado</span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!confirm('¿Estás seguro de reabrir este periodo? Podrás editar calificaciones nuevamente.')) return
                                            const { error } = await supabase.from('evaluation_periods').update({ is_closed: false }).eq('id', currentPeriod.id)
                                            if (!error) loadData()
                                        }}
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Reabrir Periodo (Editar)"
                                    >
                                        <Unlock className="w-4 h-4" />
                                    </button>
                                    {allPeriodsClosed && (
                                        <button
                                            onClick={() => setIsCloseYearModalOpen(true)}
                                            className="flex items-center px-3 py-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-200 shadow-sm hover:bg-purple-100 transition-colors"
                                            title="Cerrar Ciclo Escolar"
                                        >
                                            <Award className="w-4 h-4 mr-2" />
                                            <span className="text-sm font-bold">Cierre Anual</span>
                                        </button>
                                    )}
                                </div>
                            )
                        }

                        return (
                            <button
                                onClick={() => setIsClosePeriodModalOpen(true)}
                                className="p-2 border border-blue-100 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                                title="Cerrar Trimestre"
                            >
                                <Lock className="w-5 h-5" />
                            </button>
                        )
                    })()}
                    <button className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                        <Download className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                <button
                    onClick={() => setActiveTab('ATTENDANCE')}
                    className={`px-4 md:px-6 py-3 text-sm font-bold transition-colors relative whitespace-nowrap ${activeTab === 'ATTENDANCE' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Asistencia
                    {activeTab === 'ATTENDANCE' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('EVALUATION')}
                    className={`px-4 md:px-6 py-3 text-sm font-bold transition-colors relative whitespace-nowrap ${activeTab === 'EVALUATION' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Evaluación y Tareas
                    {activeTab === 'EVALUATION' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('REPORTS')}
                    className={`px-4 md:px-6 py-3 text-sm font-bold transition-colors relative whitespace-nowrap ${activeTab === 'REPORTS' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Reportes
                    {activeTab === 'REPORTS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                </button>
            </div>

            {
                activeTab === 'REPORTS' && (
                    <ConductReportsTab
                        groupId={groupId!}
                        students={students}
                        incidents={incidents}
                        onRefresh={loadData}
                        tenantId={tenant?.id || ''}
                        userProfile={{ id: (supabase.auth.getUser() as any).data?.user?.id }}
                    />
                )
            }

            {
                activeTab === 'ATTENDANCE' && (
                    <div className="flex items-center space-x-4 bg-gray-50 p-3 rounded-2xl border border-gray-200 w-fit">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Método:</p>
                        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                            {[
                                { id: 'MANUAL', label: 'Manual', icon: Users },
                                { id: 'QR', label: 'Lector QR', icon: QrCode },
                                { id: 'BIOMETRIC', label: 'Biométrico', icon: Activity }
                            ].map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => setAttendanceMethod(method.id as any)}
                                    className={`flex items-center px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${attendanceMethod === method.id
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    <method.icon className="w-3.5 h-3.5 mr-2" />
                                    {method.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'EVALUATION' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center">
                            <div className="bg-purple-100 p-2 md:p-3 rounded-xl mr-3 md:mr-4 shrink-0">
                                <Users className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs md:text-sm text-gray-500 font-medium">Alumnos</p>
                                <h3 className="text-xl md:text-2xl font-bold text-gray-900">{students.length}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center">
                            <div className="bg-amber-100 p-2 md:p-3 rounded-xl mr-3 md:mr-4 shrink-0">
                                <CheckSquare className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs md:text-sm text-gray-500 font-medium">Actividades</p>
                                <h3 className="text-xl md:text-2xl font-bold text-gray-900">{assignments.length}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm bg-gradient-to-br from-blue-50 to-white flex items-center border-l-4 border-l-blue-500">
                            <div className="bg-blue-100 p-2 md:p-3 rounded-xl mr-3 md:mr-4 shrink-0">
                                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs md:text-sm text-gray-500 font-medium">Promedio Grupal</p>
                                <h3 className="text-xl md:text-2xl font-bold text-gray-900">
                                    {(() => {
                                        const studentAverages = students
                                            .map(s => parseFloat(calculateProgress(s.id)))
                                            .filter(avg => !isNaN(avg))

                                        if (studentAverages.length === 0) return '-'
                                        const groupAvg = studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length
                                        return groupAvg.toFixed(1)
                                    })()}
                                </h3>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'ATTENDANCE' && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase">Presentes hoy</p>
                            <h3 className="text-lg md:text-xl font-bold text-gray-900">{attendance.filter(a => a.date === attendanceDate && a.status === 'PRESENT').length}</h3>
                        </div>
                        <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-[10px] md:text-xs font-bold text-amber-600 uppercase">Retardos hoy</p>
                            <h3 className="text-lg md:text-xl font-bold text-gray-900">{attendance.filter(a => a.date === attendanceDate && a.status === 'LATE').length}</h3>
                        </div>
                        <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-[10px] md:text-xs font-bold text-red-600 uppercase">Faltas hoy</p>
                            <h3 className="text-lg md:text-xl font-bold text-gray-900">{attendance.filter(a => a.date === attendanceDate && a.status === 'ABSENT').length}</h3>
                        </div>
                        <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-[10px] md:text-xs font-bold text-blue-600 uppercase">Permisos hoy</p>
                            <h3 className="text-lg md:text-xl font-bold text-gray-900">{attendance.filter(a => a.date === attendanceDate && a.status === 'EXCUSED').length}</h3>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'ATTENDANCE' && attendanceMethod !== 'MANUAL' && (
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
                        <div className="bg-blue-50 p-6 rounded-full">
                            {attendanceMethod === 'QR' ? <QrCode className="w-12 h-12 text-blue-600 animate-pulse" /> : <Activity className="w-12 h-12 text-blue-600 animate-pulse" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900">
                                {attendanceMethod === 'QR' ? 'Escaneo de Código QR Activo' : 'Lectura Biométrica en Espera'}
                            </h3>
                            <p className="text-gray-500 mt-1 max-w-sm">
                                {attendanceMethod === 'QR'
                                    ? 'Los alumnos pueden escanear su credencial digital para registrar asistencia automáticamente.'
                                    : 'Coloque el sensor para iniciar la identificación de alumnos por huella digital.'}
                            </p>
                        </div>
                        <button className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg">
                            {attendanceMethod === 'QR' ? 'Encender Cámara' : 'Sincronizar Lector'}
                        </button>
                    </div>
                )
            }

            {activeTab !== 'REPORTS' && (
                <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${activeTab === 'ATTENDANCE' && attendanceMethod !== 'MANUAL' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center group">
                        <h3 className="font-bold text-gray-900">
                            {activeTab === 'EVALUATION' ? 'Listado de Calificaciones' : 'Registro de Asistencia'}
                        </h3>
                        <div className="flex items-center space-x-2">
                            {activeTab === 'ATTENDANCE' && (
                                <button
                                    onClick={profile?.is_demo ? undefined : handleMarkAllPresent}
                                    className={`px-4 py-2 rounded-xl transition-all font-bold text-sm mr-2 flex items-center ${profile?.is_demo
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        }`}
                                    title={profile?.is_demo ? "No disponible en modo demo" : ""}
                                >
                                    <Users className="w-4 h-4 mr-2" />
                                    Marcar Todos Presentes
                                </button>
                            )}
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400 font-medium group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar alumno..."
                                    className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all w-64"
                                />
                            </div>
                            <button className="p-2 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100">
                                <Filter className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50/90 backdrop-blur-sm z-20 border-r border-gray-200">Alumno</th>
                                    {activeTab === 'EVALUATION' ? (
                                        <>
                                            {(() => {
                                                const unassigned = assignments.filter(a => !a.criterion_id)
                                                const displayCriteria = [...criteria]
                                                if (unassigned.length > 0) {
                                                    displayCriteria.push({ id: 'uncategorized', name: 'Sin Criterio', percentage: 0, weight: 0 })
                                                }
                                                return displayCriteria.map(c => {
                                                    const cAssignments = c.id === 'uncategorized'
                                                        ? unassigned
                                                        : assignments.filter(a => a.criterion_id === c.id)

                                                    // Calculate pending grades
                                                    let pendingCount = 0
                                                    if (cAssignments.length > 0 && students.length > 0) {
                                                        const totalExpected = cAssignments.length * students.length
                                                        const totalGraded = grades.filter(g =>
                                                            cAssignments.some(a => a.id === g.assignment_id) && g.is_graded
                                                        ).length
                                                        pendingCount = totalExpected - totalGraded
                                                    }

                                                    return (
                                                        <th key={c.id} className={`px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center relative group/th ${c.id === 'uncategorized' ? 'bg-amber-50/50 text-amber-600' : ''}`}>
                                                            <div className="flex flex-col items-center justify-center">
                                                                <span className="flex items-center gap-1">
                                                                    {c.name}
                                                                    {pendingCount > 0 && (
                                                                        <div className="group/tooltip relative">
                                                                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                                                                                {pendingCount} calificaciones pendientes
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </span>
                                                                {c.id !== 'uncategorized' && <span className="block text-[10px] text-blue-500 normal-case">{c.weight || c.percentage}%</span>}
                                                                {c.id === 'uncategorized' && <span className="block text-[10px] text-amber-500 normal-case">Sin Valor</span>}
                                                            </div>
                                                        </th>
                                                    )
                                                })
                                            })()}
                                            <th className="px-6 py-4 text-xs font-bold text-gray-900 uppercase tracking-wider text-right bg-blue-50/30">Total</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Pase de Lista ({attendanceDate})</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Resumen del Periodo</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.map(student => (
                                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group/row">
                                        <td className="px-6 py-4 sticky left-0 bg-white group-hover/row:bg-gray-50 transition-colors z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center">
                                                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border border-white flex items-center justify-center text-blue-700 font-bold text-xs mr-3 shadow-sm">
                                                    {student.first_name[0]}{student.last_name_paternal[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{student.last_name_paternal} {student.last_name_maternal} {student.first_name}</p>
                                                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">{student.curp || 'SIN CURP'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {activeTab === 'EVALUATION' ? (
                                            <>
                                                {(() => {
                                                    // Include a "Sin Criterio" column if there are assignments without criteria
                                                    const unassigned = assignments.filter(a => !a.criterion_id)
                                                    const displayCriteria = [...criteria]
                                                    if (unassigned.length > 0) {
                                                        displayCriteria.push({ id: 'uncategorized', name: 'Sin Criterio', percentage: 0, weight: 0 })
                                                    }

                                                    return displayCriteria.map(c => {
                                                        const cAssignments = c.id === 'uncategorized'
                                                            ? unassigned
                                                            : assignments.filter(a => a.criterion_id === c.id)

                                                        // Skip if it's the uncategorized column but empty (safety check)
                                                        if (c.id === 'uncategorized' && cAssignments.length === 0) return null

                                                        const studentGrades = grades.filter(g => g.student_id === student.id && cAssignments.some(a => a.id === g.assignment_id))
                                                        const gradedCount = studentGrades.filter(g => g.is_graded).length

                                                        return (
                                                            <td key={c.id} className="p-0">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedStudentForGrading(student)
                                                                        setSelectedCriterionForGrading(c)
                                                                    }}
                                                                    className={`w-full h-full px-6 py-4 flex flex-col items-center justify-center transition-colors group/cell ${c.id === 'uncategorized' ? 'bg-amber-50/30 hover:bg-amber-100/50' : 'hover:bg-blue-50'
                                                                        }`}
                                                                >
                                                                    <div className="flex flex-col items-center">
                                                                        <span className={`text-sm font-bold transition-colors ${c.id === 'uncategorized' ? 'text-amber-700' : 'text-gray-700 group-hover/cell:text-blue-700'
                                                                            }`}>
                                                                            {gradedCount > 0 ? (studentGrades.reduce((acc, curr) => acc + (curr.score || 0), 0) / gradedCount).toFixed(1) : '-'}
                                                                        </span>
                                                                        <span className={`text-[10px] transition-colors ${c.id === 'uncategorized' ? 'text-amber-500' : 'text-gray-400 group-hover/cell:text-blue-400'
                                                                            }`}>
                                                                            {gradedCount}/{cAssignments.length}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            </td>
                                                        )
                                                    })
                                                })()}
                                                <td className="px-6 py-4 text-right bg-blue-50/10">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-lg font-black text-blue-600">
                                                            {calculateProgress(student.id)}
                                                        </span>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        {[
                                                            { status: 'PRESENT', label: 'A', title: 'Asistencia', color: 'emerald' },
                                                            { status: 'LATE', label: 'R', title: 'Retardo', color: 'amber' },
                                                            { status: 'ABSENT', label: 'F', title: 'Falta', color: 'red' },
                                                            { status: 'EXCUSED', label: 'P', title: 'Permiso', color: 'blue' }
                                                        ].map(item => {
                                                            const record = attendance.find(a =>
                                                                a.student_id === student.id &&
                                                                a.date === attendanceDate &&
                                                                // Match subject specific or general
                                                                (a.subject_id === (subjectId || null))
                                                            )
                                                            const currentStatus = pendingAttendance[student.id] || record?.status
                                                            const isActive = currentStatus === item.status
                                                            const isPending = !!pendingAttendance[student.id] && pendingAttendance[student.id] === item.status

                                                            return (
                                                                <button
                                                                    key={item.status}
                                                                    onClick={() => handleAttendanceChange(student.id, item.status)}
                                                                    title={item.title}
                                                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${isActive
                                                                        ? `bg-${item.color}-500 text-white shadow-md scale-110`
                                                                        : `bg-gray-50 text-${item.color}-600 hover:bg-${item.color}-50`
                                                                        } ${isPending ? 'ring-2 ring-white ring-offset-2' : ''} ${profile?.is_demo ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    {item.label}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setSelectedStudentForHistory(student)}
                                                        className="flex items-center justify-end space-x-4 hover:bg-gray-100 p-2 rounded-lg transition-colors group/history w-full"
                                                        title="Ver historial detallado"
                                                    >
                                                        {(() => {
                                                            const summary = getAttendanceSummary(student.id)
                                                            return (
                                                                <>
                                                                    <div className="text-center">
                                                                        <p className="text-[10px] text-emerald-600 font-bold">AS</p>
                                                                        <p className="text-sm font-bold text-gray-700">{summary.present}</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="text-[10px] text-amber-600 font-bold">RT</p>
                                                                        <p className="text-sm font-bold text-gray-700">{summary.late}</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="text-[10px] text-red-600 font-bold">FT</p>
                                                                        <p className="text-sm font-bold text-gray-700">{summary.absent}</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="text-[10px] text-blue-600 font-bold">PM</p>
                                                                        <p className="text-sm font-bold text-gray-700">{summary.excused}</p>
                                                                    </div>
                                                                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover/history:text-blue-500 transition-colors ml-2" />
                                                                </>
                                                            )
                                                        })()}
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals */}
            {
                groupId && (
                    <CreateAssignmentModal
                        isOpen={isAssignmentModalOpen}
                        onClose={() => {
                            setIsAssignmentModalOpen(false)
                        }}
                        onSuccess={loadData}
                        groupId={groupId}
                        periodId={selectedPeriodId || undefined}
                        subjectId={subjectId || undefined}
                        defaultSubjectName={subjectId ? groupSubjects.find(s => s.id === subjectId)?.name : 'Actividad General'}
                        lessonPlanId={activeLessonPlanId || undefined}
                    />
                )
            }


            {group && (
                <CloseAcademicYearModal
                    isOpen={isCloseYearModalOpen}
                    onClose={() => setIsCloseYearModalOpen(false)}
                    onSuccess={() => {
                        setIsCloseYearModalOpen(false)
                        loadData()
                    }}
                    group={group}
                    students={students}
                />
            )}

            {/* Attendance History Modal */}
            {
                selectedStudentForHistory && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold mr-3 shadow-inner">
                                        {selectedStudentForHistory.first_name[0]}{selectedStudentForHistory.last_name_paternal[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 leading-tight">Historial de Asistencia</h3>
                                        <p className="text-sm text-gray-500">{selectedStudentForHistory.first_name} {selectedStudentForHistory.last_name_paternal}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedStudentForHistory(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto p-4">
                                {attendance.filter(a => a.student_id === selectedStudentForHistory.id).length === 0 ? (
                                    <div className="py-12 text-center text-gray-400">Sin registros de asistencia</div>
                                ) : (
                                    <div className="space-y-2">
                                        {attendance
                                            .filter(a => a.student_id === selectedStudentForHistory.id)
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map(record => (
                                                <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                    <div className="flex items-center">
                                                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {new Date(record.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                        </span>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${record.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                                                        record.status === 'LATE' ? 'bg-amber-100 text-amber-700' :
                                                            record.status === 'ABSENT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {record.status === 'PRESENT' ? 'Asistencia' :
                                                            record.status === 'LATE' ? 'Retardo' :
                                                                record.status === 'ABSENT' ? 'Falta' : 'Permiso'}
                                                    </span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                            <div className="p-6 bg-gray-50 flex justify-end">
                                <button onClick={() => setSelectedStudentForHistory(null)} className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-colors">
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Grading Modal */}
            {
                selectedStudentForGrading && selectedCriterionForGrading && (
                    <GradingModal
                        isOpen={true}
                        onClose={() => {
                            setSelectedStudentForGrading(null)
                            setSelectedCriterionForGrading(null)
                        }}
                        onSuccess={loadData}
                        student={selectedStudentForGrading}
                        criterion={selectedCriterionForGrading}
                        assignments={(() => {
                            const cAssignments = selectedCriterionForGrading.id === 'uncategorized'
                                ? assignments.filter(a => !a.criterion_id)
                                : assignments.filter(a => a.criterion_id === selectedCriterionForGrading.id)
                            return cAssignments
                        })()}
                        currentGrades={grades.filter(g => g.student_id === selectedStudentForGrading.id)}
                        groupId={groupId!}
                        onEdit={handleEditAssignment}
                        onDelete={handleDeleteAssignment}
                    />
                )
            }
            {/* Floating Save Button for Attendance */}
            {activeTab === 'ATTENDANCE' && !periods.find(p => p.id === selectedPeriodId)?.is_closed && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 duration-500">
                    <button
                        onClick={profile?.is_demo ? undefined : saveAttendance}
                        disabled={isSavingAttendance || Object.keys(pendingAttendance).length === 0 || profile?.is_demo}
                        className={`flex items-center px-6 py-4 rounded-full shadow-2xl transition-all font-bold text-lg disabled:opacity-50 disabled:scale-100 disabled:shadow-none ring-4 ring-white/50 ${profile?.is_demo ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-800 hover:scale-105'
                            }`}
                        title={profile?.is_demo ? "Guardado deshabilitado en modo demo" : ""}
                    >
                        {isSavingAttendance ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                        ) : (
                            <Save className="w-5 h-5 mr-2" />
                        )}
                        {isSavingAttendance ? 'Guardando...' : 'Guardar Pase de Lista'}
                    </button>
                </div>
            )}
        </div >
    )
}
