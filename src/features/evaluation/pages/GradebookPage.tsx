
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
    AlertTriangle,
    Clock,
    ShieldCheck,
    GraduationCap,
    FileWarning
} from 'lucide-react'
import { CreateAssignmentModal } from '../components/CreateAssignmentModal'
import { GradingModal } from '../components/GradingModal'
import { ClosePeriodModal } from '../components/ClosePeriodModal'
import { CloseAcademicYearModal } from '../components/CloseAcademicYearModal'
import { NoPlanningAlert } from '../components/NoPlanningAlert'
import { ConductReportsTab } from '../components/ConductReportsTab'
import { ActivitiesManagerModal } from '../components/ActivitiesManagerModal'
import { DictationModeModal } from '../components/DictationModeModal'
import { QRScanner } from '../components/QRScanner'
import { BiometricScannerMock } from '../components/BiometricScannerMock'
import { Mic } from 'lucide-react'
import { GeminiService } from '../../../lib/gemini'
import { useMemo } from 'react'

export const GradebookPage = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const { isOnline, addToQueue, pendingCount } = useOfflineSync()

    const groupId = searchParams.get('groupId')
    const subjectId = searchParams.get('subjectId')

    const aiService = useMemo(() => new GeminiService(
        tenant?.aiConfig?.geminiKey || '',
        tenant?.aiConfig?.apiKey || '',
        tenant?.aiConfig?.openaiKey || ''
    ), [tenant?.aiConfig?.geminiKey, tenant?.aiConfig?.apiKey, tenant?.aiConfig?.openaiKey])

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
    const [isActivitiesManagerOpen, setIsActivitiesManagerOpen] = useState(false)
    const [activeAssignmentForDictation, setActiveAssignmentForDictation] = useState<any>(null)
    const [isGlobalDictationModeOpen, setIsGlobalDictationModeOpen] = useState(false)
    const [isScanningActive, setIsScanningActive] = useState(false)

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

            if (subjectId) {
                // 1. Try EXACT MATCH by subject_id + group_id + period_id
                let planningQuery = supabase
                    .from('lesson_plans')
                    .select('id, title, campo_formativo, period_id, subject_id')
                    .eq('group_id', groupId)
                    .eq('subject_id', subjectId)

                if (currentPeriodId) {
                    planningQuery = planningQuery.eq('period_id', currentPeriodId)
                }

                const { data: exactPlanning, error: planningError } = await planningQuery
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (planningError) console.error('Planning Query Error:', planningError)

                let finalPlanning = exactPlanning

                // 2. FALLBACK: Match by Campo Formativo if custom subject mismatch
                if (!finalPlanning) {
                    const currentSubject = formattedSubjects.find(s => s.id === subjectId)

                    // We try to find ANY plan for this group and period that might be the one
                    let fallbackQuery = supabase
                        .from('lesson_plans')
                        .select('id, title, campo_formativo, period_id, subject_id')
                        .eq('group_id', groupId)

                    if (currentPeriodId) {
                        fallbackQuery = fallbackQuery.eq('period_id', currentPeriodId)
                    }

                    const { data: groupPlans } = await fallbackQuery.order('created_at', { ascending: false })

                    if (groupPlans && groupPlans.length > 0) {
                        // Priority 1: Semantic match with subject name
                        const semanticMatch = groupPlans.find(p =>
                            p.title?.toLowerCase().includes(currentSubject?.name?.toLowerCase() || '') ||
                            currentSubject?.name?.toLowerCase().includes(p.campo_formativo?.toLowerCase() || '')
                        )

                        if (semanticMatch) {
                            finalPlanning = semanticMatch
                        } else {
                            // Priority 2: Just take the most recent one
                            finalPlanning = groupPlans[0]
                        }
                    }

                    if (!finalPlanning) {
                        const { data: anyPeriodPlans } = await supabase
                            .from('lesson_plans')
                            .select('id, title, campo_formativo, period_id, subject_id')
                            .eq('group_id', groupId)
                            .eq('subject_id', subjectId)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle()

                        if (anyPeriodPlans) {
                            finalPlanning = anyPeriodPlans
                        }
                    }
                }

                setHasLessonPlan(!!finalPlanning)
                setActiveLessonPlanId(finalPlanning?.id || null)
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
    }, [tenant?.id, groupId, subjectId, selectedPeriodId])

    useEffect(() => {
        if (activeTab === 'ATTENDANCE' && students.length > 0 && !loading) {
            const hasExisting = attendance.some(a => a.date === attendanceDate && (subjectId ? a.subject_id === subjectId : !a.subject_id))
            if (!hasExisting && Object.keys(pendingAttendance).length === 0) {
                handleMarkAllPresent()
            }
        }
    }, [activeTab, attendance, attendanceDate, students, loading])

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
                    periodId={selectedPeriodId || ''}
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
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-105 transition-all btn-tactile"
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
                                className="group squishy-card p-8 text-left flex flex-col items-center justify-center space-y-4 relative overflow-hidden"
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
        <div className="space-y-8">
            {/* Main Header Card - Tactile Maximalism */}
            <div className="squishy-card p-6 md:p-8 border-none bg-gradient-to-br from-white to-slate-50/50 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Context & Title */}
                    <div className="flex items-start space-x-5">
                        <button
                            onClick={() => navigate('/groups', { replace: true })}
                            className="mt-1 p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm hover:scale-110 active:scale-90 group/back"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600 group-hover/back:text-indigo-600" />
                        </button>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                                    Libreta: {group?.grade}° "{group?.section}"
                                </h1>
                                <div className="flex bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                                    En Línea
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Subject Pill */}
                                <div className="flex items-center bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
                                    <BookOpen className="w-3.5 h-3.5 text-indigo-500 mr-2" />
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                                        {groupSubjects.find(s => s.id === subjectId)?.name || 'Todas las Materias'}
                                    </span>
                                </div>

                                {/* Period Pill */}
                                <div className="flex items-center bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
                                    <Calendar className="w-3.5 h-3.5 text-amber-500 mr-2" />
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                                        {periods.find(p => p.id === selectedPeriodId)?.name || 'Periodo Actual'}
                                    </span>
                                </div>

                                {/* Date Pill (Attendance only) */}
                                {activeTab === 'ATTENDANCE' && (
                                    <div className="flex items-center bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 shadow-sm group/date relative cursor-pointer overflow-hidden">
                                        <Clock className="w-3.5 h-3.5 text-indigo-600 mr-2" />
                                        <span className="text-xs font-black text-indigo-700 uppercase tracking-tight">
                                            {new Date(attendanceDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                        </span>
                                        <input
                                            type="date"
                                            value={attendanceDate}
                                            onChange={(e) => setAttendanceDate(e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions Hub */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Primary Action */}
                        {activeTab === 'EVALUATION' && (
                            !periods.find(p => p.id === selectedPeriodId)?.is_closed && (
                                <button
                                    onClick={() => setIsAssignmentModalOpen(true)}
                                    className="flex-1 md:flex-none flex items-center px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all font-black uppercase text-xs tracking-widest btn-tactile group/add"
                                >
                                    <Plus className="w-5 h-5 mr-2 group-hover/add:rotate-90 transition-transform" />
                                    Añadir Calificable
                                </button>
                            )
                        )}

                        <div className="flex items-center bg-slate-100/50 p-1.5 rounded-[2rem] border border-slate-200 gap-1 mt-2 md:mt-0">
                            <button
                                onClick={() => navigate(`/evaluation/setup?groupId=${groupId}${subjectId ? `&subjectId=${subjectId}` : ''}&periodId=${selectedPeriodId || ''}`)}
                                className="p-3 bg-white text-indigo-600 rounded-2xl hover:bg-white transition-all shadow-sm hover:scale-110 active:scale-95 border border-slate-200"
                                title="Configurar Criterios"
                            >
                                <Settings className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => navigate(`/groups/${groupId}`)}
                                className="p-3 bg-white text-slate-600 rounded-2xl hover:bg-white transition-all shadow-sm hover:scale-110 active:scale-95 border border-slate-200"
                                title="Administración del Grupo"
                            >
                                <Users className="w-5 h-5" />
                            </button>

                            {activeTab === 'EVALUATION' && selectedPeriodId && (() => {
                                const currentPeriod = periods.find(p => p.id === selectedPeriodId)
                                if (!currentPeriod) return null

                                if (currentPeriod.is_closed) {
                                    return (
                                        <button
                                            onClick={async () => {
                                                if (!confirm('¿Estás seguro de reabrir este periodo? Podrás editar calificaciones nuevamente.')) return
                                                const { error } = await supabase.from('evaluation_periods').update({ is_closed: false }).eq('id', currentPeriod.id)
                                                if (!error) loadData()
                                            }}
                                            className="p-3 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-100 transition-all shadow-sm border border-amber-200"
                                            title={`Reabrir ${currentPeriod.name}`}
                                        >
                                            <Unlock className="w-5 h-5" />
                                        </button>
                                    )
                                }

                                return (
                                    <button
                                        onClick={() => setIsClosePeriodModalOpen(true)}
                                        className="p-3 bg-white text-rose-600 rounded-2xl hover:bg-rose-50 transition-all shadow-sm border border-slate-200 group/lock"
                                        title={`Cerrar ${currentPeriod.name}`}
                                    >
                                        <Lock className="w-5 h-5 group-hover/lock:scale-110" />
                                    </button>
                                )
                            })()}

                            <button className="p-3 bg-white text-slate-600 rounded-2xl hover:bg-white transition-all shadow-sm hover:scale-110 active:scale-95 border border-slate-200">
                                <Download className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs - Tactile Minimalist */}
            <div className="flex bg-slate-100/50 p-2 rounded-[2rem] border border-slate-200 w-full sm:w-fit self-center">
                {[
                    { id: 'ATTENDANCE', label: 'Asistencia', icon: ShieldCheck },
                    { id: 'EVALUATION', label: 'Evaluación', icon: GraduationCap },
                    { id: 'REPORTS', label: 'Incidencias', icon: FileWarning }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                            ? 'bg-white text-indigo-600 shadow-md scale-100'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                            }`}
                    >
                        <tab.icon className={`w-4 h-4 mr-2 ${activeTab === tab.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                        {tab.label}
                    </button>
                ))}
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
                                    onClick={() => {
                                        setAttendanceMethod(method.id as any)
                                        setIsScanningActive(false)
                                    }}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <div className="squishy-card p-6 flex items-center bg-white border-none shadow-lg shadow-slate-100 group/metric">
                            <div className="bg-indigo-100 p-4 rounded-3xl mr-4 shrink-0 group-hover/metric:scale-110 transition-transform">
                                <Users className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Alumnos</p>
                                <h3 className="text-3xl font-black text-slate-900">{students.length}</h3>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsActivitiesManagerOpen(true)}
                            className="squishy-card p-6 flex items-center bg-white border-none shadow-lg shadow-slate-100 group/metric hover:bg-amber-50/50 transition-all text-left"
                        >
                            <div className="bg-amber-100 p-4 rounded-3xl mr-4 shrink-0 group-hover/metric:scale-110 transition-transform">
                                <CheckSquare className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                                    Actividades
                                    <span className="p-1 bg-amber-500 rounded-lg text-[8px] text-white animate-pulse">GESTIONAR</span>
                                </p>
                                <h3 className="text-3xl font-black text-slate-900">{assignments.length}</h3>
                            </div>
                        </button>
                        <div className="squishy-card p-6 flex items-center bg-indigo-600 border-none shadow-xl shadow-indigo-100 group/metric transition-all hover:bg-indigo-700">
                            <div className="bg-white/20 backdrop-blur-md p-4 rounded-3xl mr-4 shrink-0 group-hover/metric:rotate-12 transition-transform">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-indigo-200 font-black uppercase tracking-widest">Promedio Grupal</p>
                                <h3 className="text-3xl font-black text-white">
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
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <div className="squishy-card p-6 bg-white border-none shadow-lg shadow-emerald-50 group/metric">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Presentes Hoy</p>
                            <h3 className="text-3xl font-black text-slate-900">{attendance.filter(a => a.date === attendanceDate && a.status === 'PRESENT').length}</h3>
                        </div>
                        <div className="squishy-card p-6 bg-white border-none shadow-lg shadow-amber-50 group/metric">
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Retardos Hoy</p>
                            <h3 className="text-3xl font-black text-slate-900">{attendance.filter(a => a.date === attendanceDate && a.status === 'LATE').length}</h3>
                        </div>
                        <div className="squishy-card p-6 bg-white border-none shadow-lg shadow-rose-50 group/metric">
                            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Faltas Hoy</p>
                            <h3 className="text-3xl font-black text-slate-900">{attendance.filter(a => a.date === attendanceDate && a.status === 'ABSENT').length}</h3>
                        </div>
                        <div className="squishy-card p-6 bg-white border-none shadow-lg shadow-indigo-50 group/metric">
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Permisos Hoy</p>
                            <h3 className="text-3xl font-black text-slate-900">{attendance.filter(a => a.date === attendanceDate && a.status === 'EXCUSED').length}</h3>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'ATTENDANCE' && attendanceMethod !== 'MANUAL' && (
                    <div className="squishy-card p-8 text-center flex flex-col items-center justify-center space-y-4">
                        {isScanningActive ? (
                            <div className="w-full">
                                {attendanceMethod === 'QR' ? (
                                    <QRScanner
                                        onScanSuccess={(decodedText) => {
                                            // Handle scanned ID
                                            const studentExists = students.find(s => s.id === decodedText || s.curp === decodedText)
                                            if (studentExists) {
                                                handleAttendanceChange(studentExists.id, 'PRESENT')
                                            } else {
                                                console.warn("Student not found:", decodedText)
                                            }
                                        }}
                                        onClose={() => setIsScanningActive(false)}
                                    />
                                ) : (
                                    <BiometricScannerMock
                                        students={students}
                                        onScanSuccess={(studentId) => {
                                            handleAttendanceChange(studentId, 'PRESENT')
                                        }}
                                        onClose={() => setIsScanningActive(false)}
                                    />
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="bg-blue-50 p-6 rounded-full">
                                    {attendanceMethod === 'QR' ? <QrCode className="w-12 h-12 text-blue-600 animate-pulse" /> : <Activity className="w-12 h-12 text-blue-600 animate-pulse" />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900">
                                        {attendanceMethod === 'QR' ? 'Escaneo de Código QR Listo' : 'Lectura Biométrica en Espera'}
                                    </h3>
                                    <p className="text-gray-500 mt-1 max-w-sm">
                                        {attendanceMethod === 'QR'
                                            ? 'Los alumnos pueden escanear su credencial digital para registrar asistencia automáticamente.'
                                            : 'Coloque el sensor para iniciar la identificación de alumnos por huella digital.'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsScanningActive(true)}
                                    className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg btn-tactile"
                                >
                                    {attendanceMethod === 'QR' ? 'Encender Cámara' : 'Sincronizar Lector'}
                                </button>
                            </>
                        )}
                    </div>
                )
            }

            {activeTab !== 'REPORTS' && (
                <div className={`squishy-card border-none bg-white shadow-2xl shadow-slate-200/50 overflow-hidden ${activeTab === 'ATTENDANCE' && attendanceMethod !== 'MANUAL' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                            <h3 className="font-black text-slate-900 uppercase tracking-[0.1em]">
                                {activeTab === 'EVALUATION' ? 'Listado Académico' : 'Reporte de Asistencia'}
                            </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {activeTab === 'ATTENDANCE' && (
                                <button
                                    onClick={profile?.is_demo ? undefined : saveAttendance}
                                    disabled={isSavingAttendance || Object.keys(pendingAttendance).length === 0 || profile?.is_demo}
                                    className={`px-6 py-2.5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest flex items-center shadow-lg btn-tactile ${isSavingAttendance || Object.keys(pendingAttendance).length === 0 || profile?.is_demo
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-100'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 active:scale-95 shadow-emerald-100'
                                        }`}
                                    title={profile?.is_demo ? "No disponible en modo demo" : ""}
                                >
                                    {isSavingAttendance ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    {isSavingAttendance ? 'Sincronizando...' : 'Publicar Pase'}
                                </button>
                            )}
                            <div className="relative flex-1 md:flex-none">
                                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="BUSCAR ALUMNO..."
                                    className="input-squishy pl-11 pr-6 py-2.5 text-[10px] font-black w-full md:w-64 placeholder:text-slate-300"
                                />
                            </div>
                            <button className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors shadow-sm">
                                <Filter className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-indigo-50/50">
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
                                                        <th key={c.id} className={`px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center relative group/th ${c.id === 'uncategorized' ? 'bg-amber-50/30' : ''}`}>
                                                            <div className="flex flex-col items-center justify-center">
                                                                <span className="flex items-center gap-1 group-hover/th:text-indigo-600 transition-colors">
                                                                    {c.name}
                                                                    {pendingCount > 0 && (
                                                                        <div className="group/tooltip relative">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                                                                {pendingCount} pendientes
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </span>
                                                                <div className="mt-1 h-1 w-8 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className={`h-full transition-all duration-1000 ${c.id === 'uncategorized' ? 'bg-amber-400 w-0' : 'bg-indigo-500'}`} style={{ width: c.id === 'uncategorized' ? '0%' : '100%' }}></div>
                                                                </div>
                                                                {c.id !== 'uncategorized' && <span className="mt-1 block text-[9px] font-black text-indigo-400 lowercase opacity-60">{c.weight || c.percentage}%</span>}
                                                                {c.id === 'uncategorized' && <span className="mt-1 block text-[9px] font-black text-amber-500 lowercase opacity-60">Sin Peso</span>}
                                                            </div>
                                                        </th>
                                                    )
                                                })
                                            })()}
                                            <th className="px-8 py-6 text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] text-right bg-indigo-50/30 border-l border-indigo-50">Total</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Asistencia ({attendanceDate})</th>
                                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Acumulado</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50 transition-colors group/row">
                                        <td className="px-8 py-6 sticky left-0 bg-white group-hover/row:bg-slate-50 transition-colors z-10 border-r border-slate-100 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center">
                                                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 border-4 border-white flex items-center justify-center text-white font-black text-sm mr-4 shadow-lg group-hover/row:scale-110 transition-transform">
                                                    {student.first_name[0]}{student.last_name_paternal[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 leading-none mb-1">{student.last_name_paternal} {student.last_name_maternal}</p>
                                                    <p className="text-sm font-bold text-slate-500 leading-none">{student.first_name}</p>
                                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">{student.curp || 'SIN CURP'}</p>
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
                                                            <td key={c.id} className="p-0 border-r border-slate-50 last:border-r-0">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedStudentForGrading(student)
                                                                        setSelectedCriterionForGrading(c)
                                                                    }}
                                                                    className={`w-full h-full px-8 py-6 flex flex-col items-center justify-center transition-all group/cell ${c.id === 'uncategorized' ? 'bg-amber-50/10 hover:bg-amber-50/30' : 'hover:bg-indigo-50/50'
                                                                        }`}
                                                                >
                                                                    <div className="flex flex-col items-center group-hover/cell:scale-125 transition-transform duration-300">
                                                                        <span className={`text-base font-black transition-colors ${c.id === 'uncategorized' ? 'text-amber-600' : 'text-slate-700 group-hover/cell:text-indigo-600'
                                                                            }`}>
                                                                            {gradedCount > 0 ? (studentGrades.reduce((acc, curr) => acc + (curr.score || 0), 0) / gradedCount).toFixed(1) : '-'}
                                                                        </span>
                                                                        <div className="flex items-center gap-1 mt-0.5">
                                                                            <div className="w-1 h-1 rounded-full bg-slate-300 group-hover/cell:bg-indigo-400"></div>
                                                                            <span className={`text-[9px] font-black uppercase tracking-tight transition-colors ${c.id === 'uncategorized' ? 'text-amber-400' : 'text-slate-400 group-hover/cell:text-indigo-400'
                                                                                }`}>
                                                                                {gradedCount}/{cAssignments.length}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            </td>
                                                        )
                                                    })
                                                })()}
                                                <td className="px-8 py-6 text-right bg-indigo-50/20">
                                                    <div className="flex flex-col items-end group/total">
                                                        <span className="text-2xl font-black text-indigo-600 group-hover/total:scale-110 transition-transform">
                                                            {calculateProgress(student.id)}
                                                        </span>
                                                        <div className="flex items-center gap-1 mt-0.5 opacity-40">
                                                            <GraduationCap className="w-3 h-3 text-indigo-500" />
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">Final</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-8 py-6 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {[
                                                            { status: 'PRESENT', label: 'A', title: 'Asistencia', activeColor: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-50', textColor: 'text-emerald-600' },
                                                            { status: 'LATE', label: 'R', title: 'Retardo', activeColor: 'bg-amber-500', hoverColor: 'hover:bg-amber-50', textColor: 'text-amber-600' },
                                                            { status: 'ABSENT', label: 'F', title: 'Falta', activeColor: 'bg-rose-500', hoverColor: 'hover:bg-rose-50', textColor: 'text-rose-600' },
                                                            { status: 'EXCUSED', label: 'P', title: 'Permiso', activeColor: 'bg-indigo-500', hoverColor: 'hover:bg-indigo-50', textColor: 'text-indigo-600' }
                                                        ].map(item => {
                                                            const record = attendance.find(a =>
                                                                a.student_id === student.id &&
                                                                a.date === attendanceDate &&
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
                                                                    className={`w-10 h-10 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center border-2 ${isActive
                                                                        ? `${item.activeColor} text-white border-white shadow-lg scale-110 z-10`
                                                                        : `bg-slate-50 border-slate-50 ${item.textColor} ${item.hoverColor} hover:scale-110`
                                                                        } ${isPending ? 'ring-2 ring-indigo-400 ring-offset-2 animate-pulse' : ''} ${profile?.is_demo ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    {item.label}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <button
                                                        onClick={() => setSelectedStudentForHistory(student)}
                                                        className="flex items-center justify-end gap-5 hover:bg-slate-100/50 p-4 rounded-3xl transition-all group/history w-full border border-transparent hover:border-slate-100"
                                                        title="Ver historial detallado"
                                                    >
                                                        {(() => {
                                                            const summary = getAttendanceSummary(student.id)
                                                            return (
                                                                <>
                                                                    <div className="text-center group-hover/history:scale-110 transition-transform">
                                                                        <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest leading-none mb-1">AS</p>
                                                                        <p className="text-base font-black text-slate-700">{summary.present}</p>
                                                                    </div>
                                                                    <div className="text-center group-hover/history:scale-110 transition-transform delay-75">
                                                                        <p className="text-[9px] text-amber-600 font-black uppercase tracking-widest leading-none mb-1">RT</p>
                                                                        <p className="text-base font-black text-slate-700">{summary.late}</p>
                                                                    </div>
                                                                    <div className="text-center group-hover/history:scale-110 transition-transform delay-100">
                                                                        <p className="text-[9px] text-rose-600 font-black uppercase tracking-widest leading-none mb-1">FT</p>
                                                                        <p className="text-base font-black text-slate-700">{summary.absent}</p>
                                                                    </div>
                                                                    <div className="text-center group-hover/history:scale-110 transition-transform delay-150">
                                                                        <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest leading-none mb-1">PM</p>
                                                                        <p className="text-base font-black text-slate-700">{summary.excused}</p>
                                                                    </div>
                                                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover/history:bg-indigo-600 group-hover/history:text-white transition-all shadow-inner">
                                                                        <ArrowRight className="w-5 h-5" />
                                                                    </div>
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
                            setEditingAssignment(null)
                        }}
                        onSuccess={() => {
                            loadData()
                            setIsAssignmentModalOpen(false)
                            setEditingAssignment(null)
                        }}
                        groupId={groupId}
                        periodId={selectedPeriodId || undefined}
                        subjectId={subjectId || undefined}
                        defaultSubjectName={subjectId ? groupSubjects.find(s => s.id === subjectId)?.name : 'Actividad General'}
                        lessonPlanId={activeLessonPlanId || undefined}
                        initialData={editingAssignment}
                        assignmentId={editingAssignment?.id}
                    />
                )
            }

            <ActivitiesManagerModal
                isOpen={isActivitiesManagerOpen}
                onClose={() => setIsActivitiesManagerOpen(false)}
                assignments={assignments}
                onEdit={(asm) => {
                    setEditingAssignment(asm)
                    setIsAssignmentModalOpen(true)
                }}
                onDelete={async (id) => {
                    const { error } = await supabase.from('assignments').delete().eq('id', id)
                    if (error) alert('Error al eliminar: ' + error.message)
                    else loadData()
                }}
                onDictate={(asm) => {
                    setActiveAssignmentForDictation(asm)
                    setIsGlobalDictationModeOpen(true)
                }}
                onEnrich={async (assignment) => {
                    if (!aiService) return
                    const enriched = await aiService.enrichAssignmentDescription({
                        title: assignment.title,
                        description: assignment.description || '',
                        subject: groupSubjects.find(s => s.id === (subjectId || assignment.subject_id))?.name
                    })

                    if (enriched) {
                        const { error } = await supabase
                            .from('assignments')
                            .update({ description: enriched })
                            .eq('id', assignment.id)

                        if (error) alert('Error al guardar refuerzo: ' + error.message)
                        else loadData()
                    }
                }}
            />

            {activeAssignmentForDictation && (
                <DictationModeModal
                    isOpen={isGlobalDictationModeOpen}
                    onClose={() => {
                        setIsGlobalDictationModeOpen(false)
                        setActiveAssignmentForDictation(null)
                    }}
                    title={activeAssignmentForDictation.title}
                    content={activeAssignmentForDictation.description}
                />
            )}

            {group && periods.find(p => p.id === selectedPeriodId) && (
                <ClosePeriodModal
                    isOpen={isClosePeriodModalOpen}
                    onClose={() => setIsClosePeriodModalOpen(false)}
                    onSuccess={() => {
                        setIsClosePeriodModalOpen(false)
                        loadData()
                    }}
                    period={periods.find(p => p.id === selectedPeriodId)!}
                    group={group}
                    students={students}
                    assignments={assignments}
                    grades={grades}
                    criteria={criteria}
                    attendance={attendance}
                    subjectId={subjectId || undefined}
                />
            )}

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
        </div >
    )
}
