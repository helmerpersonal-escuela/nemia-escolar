import { useEffect, useState } from 'react'
import { FileText, ChevronDown, Download, Award, BookOpen } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'

export const StudentGradesPage = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const [loading, setLoading] = useState(true)
    const [children, setChildren] = useState<any[]>([])
    const [selectedChild, setSelectedChild] = useState<any>(null)
    const [groupsSubjects, setGroupsSubjects] = useState<any[]>([])
    const [grades, setGrades] = useState<Record<string, number>>({})

    const isTutor = profile?.role === 'TUTOR'

    useEffect(() => {
        const loadIdentity = async () => {
            if (!tenant || !profile) return
            setLoading(true)

            try {
                if (isTutor) {
                    // Fetch Children
                    const { data: guardianship } = await supabase
                        .from('guardians')
                        .select('student_id, student:students(id, first_name, last_name_paternal, group_id, group:groups(grade, section))')
                        .eq('user_id', profile.id)

                    const studs = guardianship?.map((g: any) => g.student) || []
                    setChildren(studs)
                    if (studs.length > 0) setSelectedChild(studs[0])
                } else {
                    // Fetch Self
                    const { data: student } = await supabase
                        .from('students')
                        .select('id, first_name, last_name_paternal, group_id, group:groups(grade, section)')
                        .eq('user_id', profile.id)
                        .single()

                    if (student) setSelectedChild(student)
                }
            } catch (error) {
                console.error('Error loading identity:', error)
            } finally {
                setLoading(false)
            }
        }
        loadIdentity()
    }, [tenant, profile])

    useEffect(() => {
        const loadAcademicData = async () => {
            if (!selectedChild || !tenant) return
            setLoading(true)

            try {
                // 1. Get Subjects for Group
                // Needs group_subjects logic or subject_catalog linked?
                // Assuming group_subjects table exists or we query all subjects?
                // Let's use assignments to discovery subjects for now if group_subjects is tricky, 
                // BUT better to find subjects linked to the group.
                // We'll use `group_subjects` if available (from previous context). 
                // Fallback: Query assignments linked to this group/student.

                // Optimized: Query Assignments & Grades together
                const { data: assignments } = await supabase
                    .from('assignments')
                    .select(`
                        id, title, subject:subject_catalog(name),
                        grades(score, student_id)
                    `)
                    .eq('tenant_id', tenant.id)
                    .eq('group_id', selectedChild.group_id)

                // Process Data
                const subjects: Record<string, any[]> = {}
                assignments?.forEach((a: any) => {
                    const subName = a.subject?.name || 'General'
                    if (!subjects[subName]) subjects[subName] = []

                    const myGrade = a.grades?.find((g: any) => g.student_id === selectedChild.id)
                    subjects[subName].push({
                        assignment: a.title,
                        score: myGrade?.score || 0,
                        graded: !!myGrade
                    })
                })

                setGroupsSubjects(Object.entries(subjects).map(([name, items]) => ({ name, items })))

            } catch (error) {
                console.error('Error loading grades:', error)
            } finally {
                setLoading(false)
            }
        }

        if (selectedChild) loadAcademicData()
    }, [selectedChild, tenant])

    if (loading && !selectedChild) return <div className="p-8 text-center">Cargando boleta...</div>

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <Award className="w-8 h-8 text-yellow-500" />
                        Boleta de Calificaciones
                    </h1>
                    <p className="text-gray-500 font-medium ml-11">Consulta de evaluación continua.</p>
                </div>

                {isTutor && children.length > 1 && (
                    <div className="relative">
                        <select
                            value={selectedChild?.id || ''}
                            onChange={(e) => {
                                const child = children.find(c => c.id === e.target.value)
                                setSelectedChild(child)
                            }}
                            className="bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl font-bold shadow-sm"
                        >
                            {children.map(child => (
                                <option key={child.id} value={child.id}>
                                    {child.first_name} {child.last_name_paternal}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                )}
            </div>

            {selectedChild && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedChild.first_name} {selectedChild.last_name_paternal}</h2>
                        <p className="text-sm text-gray-500 font-medium">
                            Grupo {selectedChild.group?.grade}° {selectedChild.group?.section}
                        </p>
                    </div>
                    {/* Placeholder for Print */}
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors">
                        <Download className="w-4 h-4" /> Descargar PDF
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {groupsSubjects.map((subject, idx) => (
                    <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-gray-400" />
                                {subject.name}
                            </h3>
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">
                                Promedio: {(subject.items.reduce((acc: number, i: any) => acc + i.score, 0) / (subject.items.length || 1)).toFixed(1)}
                            </span>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {subject.items.map((item: any, i: number) => (
                                <div key={i} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                                    <span className="text-sm font-medium text-gray-600">{item.assignment}</span>
                                    <span className={`font-bold ${item.score >= 6 ? 'text-gray-900' : 'text-red-500'}`}>
                                        {item.score}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {groupsSubjects.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>No hay calificaciones registradas aún.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
