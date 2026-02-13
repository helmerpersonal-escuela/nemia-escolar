import { useState, useEffect } from 'react'
import { Bell, CheckSquare, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { useTenant } from '../../hooks/useTenant'

export const NotificationsMenu = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<any[]>([])
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPendingGrading = async () => {
            if (!tenant?.id) return

            // Only Teachers and Directors usually care about grading notifications
            const role = (tenant as any)?.role
            const allowedRoles = ['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']

            if (!allowedRoles.includes(role)) {
                setLoading(false)
                return
            }

            try {
                // 1. Get recent assignments (last 30 days)
                const thirtyDaysAgo = new Date()
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

                const { data: assignments } = await supabase
                    .from('assignments')
                    .select(`
                        id, 
                        title, 
                        due_date, 
                        group_id,
                        groups (grade, section),
                        subject_catalog (name)
                    `)
                    .eq('tenant_id', tenant.id)
                    .gte('due_date', thirtyDaysAgo.toISOString())

                if (!assignments) {
                    setLoading(false)
                    return
                }

                // 2. For each assignment, check grading status
                // This is a bit expensive, in a real app we'd use a view or RPC
                // Optimization: Just check if *any* grades are missing? 
                // Or simplified: Just notify about assignments whose due_date passed recently?

                // Let's try a smarter approach:
                // "Activities to grade" = Assignments that are due but likely not fully graded.
                // We will fetch simple stats.

                const { data: grades } = await supabase
                    .from('grades')
                    .select('assignment_id')
                    .in('assignment_id', assignments.map(a => a.id))

                const { data: students } = await supabase
                    .from('students')
                    .select('id, group_id')
                    .eq('tenant_id', tenant.id)
                    .eq('status', 'ACTIVE')

                const pending = assignments.map(assignment => {
                    const groupStudents = students?.filter(s => s.group_id === assignment.group_id) || []
                    const totalStudents = groupStudents.length
                    const gradedCount = grades?.filter(g => g.assignment_id === assignment.id).length || 0

                    // EXPIRED CHECK (Rule: 5 hours after due_date)
                    const dueDate = new Date(assignment.due_date)
                    dueDate.setHours(23, 59, 59, 999)
                    const expirationDate = new Date(dueDate.getTime() + (5 * 60 * 60 * 1000))

                    if (new Date() > expirationDate) return null

                    // If fully graded and has students, don't show
                    if (totalStudents > 0 && gradedCount >= totalStudents) return null

                    const isOverdue = new Date() > dueDate
                    const groupName = (assignment as any).groups?.grade
                        ? `${(assignment as any).groups.grade}°${(assignment as any).groups.section}`
                        : (assignment as any).groups?.[0]?.grade
                            ? `${(assignment as any).groups[0].grade}°${(assignment as any).groups[0].section}`
                            : 'Grupo'

                    return {
                        id: assignment.id,
                        type: isOverdue ? 'GRADING_PENDING' : 'NEW_ACTIVITY',
                        title: isOverdue ? 'Actividad por Calificar' : 'Nueva Actividad',
                        message: `${assignment.title} - ${groupName}`,
                        link: `/gradebook?groupId=${assignment.group_id}`,
                        date: assignment.due_date,
                        pendingCount: totalStudents > 0 ? totalStudents - gradedCount : 0,
                        totalStudents
                    }
                }).filter(Boolean)

                console.log('[Notifications] Pending:', pending.length)
                setNotifications(pending)
            } catch (error) {
                console.error('Error fetching notifications:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchPendingGrading()

        // Poll every minute
        const interval = setInterval(fetchPendingGrading, 60000)
        return () => clearInterval(interval)
    }, [tenant?.id])

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full hover:bg-gray-100 relative transition-colors"
                title="Notificaciones"
            >
                <Bell className={`w-5 h-5 ${notifications.length > 0 ? 'text-gray-600' : 'text-gray-400'}`} />
                {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                        <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-900 text-sm">Notificaciones</h3>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                {notifications.length} Nuevas
                            </span>
                        </div>

                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="p-8 text-center text-gray-400 text-xs">Cargando...</div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs font-medium">No tienes notificaciones pendientes</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {notifications.map((notif: any) => (
                                        <Link
                                            key={notif.id}
                                            to={notif.link}
                                            onClick={() => setIsOpen(false)}
                                            className="block p-4 hover:bg-gray-50 transition-colors group relative"
                                        >
                                            <div className="flex items-start">
                                                <div className={`p-2 rounded-lg mr-3 mt-0.5 group-hover:scale-110 transition-transform ${notif.type === 'NEW_ACTIVITY' ? 'bg-blue-100' : 'bg-amber-100'
                                                    }`}>
                                                    {notif.type === 'NEW_ACTIVITY' ? (
                                                        <Bell className="w-4 h-4 text-blue-600" />
                                                    ) : (
                                                        <CheckSquare className="w-4 h-4 text-amber-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                        {notif.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5 font-medium">
                                                        {notif.message}
                                                    </p>
                                                    {notif.totalStudents > 0 ? (
                                                        <p className={`text-[10px] mt-1 font-semibold flex items-center ${notif.type === 'NEW_ACTIVITY' ? 'text-blue-600' : 'text-amber-600'
                                                            }`}>
                                                            <AlertCircle className="w-3 h-3 mr-1" />
                                                            {notif.pendingCount} alumnos sin calificar
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] text-gray-400 mt-1 font-medium italic flex items-center">
                                                            <AlertCircle className="w-3 h-3 mr-1" />
                                                            Sin alumnos asignados
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
