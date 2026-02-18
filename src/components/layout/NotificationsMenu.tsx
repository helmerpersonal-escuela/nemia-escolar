import { useState, useEffect } from 'react'
import { Bell, CheckSquare, AlertCircle, X, MessageSquare, Calendar as CalendarIcon, Flag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { useTenant } from '../../hooks/useTenant'

export const NotificationsMenu = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<any[]>([])
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('vunlek_dismissed_notifications')
        return saved ? JSON.parse(saved) : []
    })

    const dismissNotification = (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const newDismissed = [...dismissedIds, id]
        setDismissedIds(newDismissed)
        localStorage.setItem('vunlek_dismissed_notifications', JSON.stringify(newDismissed))
        setNotifications(prev => prev.filter(n => n.id !== id))
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'MENS_UNREAD': return <MessageSquare className="w-4 h-4 text-blue-600" />
            case 'AGENDA_EVENT': return <CalendarIcon className="w-4 h-4 text-purple-600" />
            case 'NEW_ACTIVITY': return <Bell className="w-4 h-4 text-indigo-600" />
            case 'GRADING_PENDING': return <CheckSquare className="w-4 h-4 text-amber-600" />
            default: return <Flag className="w-4 h-4 text-slate-600" />
        }
    }

    const getBgColor = (type: string) => {
        switch (type) {
            case 'MENS_UNREAD': return 'bg-blue-100'
            case 'AGENDA_EVENT': return 'bg-purple-100'
            case 'NEW_ACTIVITY': return 'bg-indigo-100'
            case 'GRADING_PENDING': return 'bg-amber-100'
            default: return 'bg-slate-100'
        }
    }

    useEffect(() => {
        const fetchAllNotifications = async () => {
            if (!tenant?.id) return
            setLoading(true)

            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const allPending: any[] = []

                // --- 1. GRADING NOTIFICATIONS ---
                const role = (tenant as any)?.role
                const allowedRoles = ['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']

                if (allowedRoles.includes(role)) {
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

                    if (assignments) {
                        const assignmentIds = assignments.map(a => a.id)
                        const { data: grades } = await supabase
                            .from('grades')
                            .select('assignment_id')
                            .in('assignment_id', assignmentIds)

                        const { data: students } = await supabase
                            .from('students')
                            .select('id, group_id')
                            .eq('tenant_id', tenant.id)
                            .eq('status', 'ACTIVE')

                        assignments.forEach(assignment => {
                            const groupStudents = students?.filter(s => s.group_id === assignment.group_id) || []
                            const totalStudents = groupStudents.length
                            const gradedCount = grades?.filter(g => g.assignment_id === assignment.id).length || 0

                            // 24H FULFILLMENT CHECK
                            if (totalStudents > 0 && gradedCount >= totalStudents) {
                                const dueDate = new Date(assignment.due_date)
                                const twentyFourHoursAfterDue = new Date(dueDate.getTime() + (24 * 60 * 60 * 1000))
                                if (new Date() > twentyFourHoursAfterDue) return
                            }

                            // DISMISSED CHECK
                            if (dismissedIds.includes(assignment.id)) return

                            const dueDate = new Date(assignment.due_date)
                            const isOverdue = new Date() > dueDate
                            const groupNameArr = (assignment as any).groups
                            let groupName = 'Grupo'
                            if (groupNameArr) {
                                if (Array.isArray(groupNameArr)) {
                                    groupName = groupNameArr[0] ? `${groupNameArr[0].grade}°${groupNameArr[0].section}` : 'Grupo'
                                } else {
                                    groupName = `${groupNameArr.grade}°${groupNameArr.section}`
                                }
                            }

                            allPending.push({
                                id: assignment.id,
                                type: isOverdue ? 'GRADING_PENDING' : 'NEW_ACTIVITY',
                                title: isOverdue ? 'Actividad por Calificar' : 'Nueva Actividad',
                                message: `${assignment.title} - ${groupName}`,
                                link: `/gradebook?groupId=${assignment.group_id}`,
                                date: assignment.due_date,
                                pendingCount: totalStudents > 0 ? totalStudents - gradedCount : 0,
                                totalStudents,
                                priority: isOverdue ? 2 : 3
                            })
                        })
                    }
                }

                // --- 2. MESSENGER NOTIFICATIONS (UNREAD) ---
                const { data: unreadRooms } = await supabase
                    .from('chat_participants')
                    .select('room_id, last_read_at, chat_rooms!inner(name, type)')
                    .eq('profile_id', user.id)

                if (unreadRooms) {
                    const roomIds = unreadRooms.map(r => r.room_id)
                    const { data: lastMessages } = await supabase
                        .from('chat_messages')
                        .select('room_id, created_at, content')
                        .in('room_id', roomIds)
                        .order('created_at', { ascending: false })

                    unreadRooms.forEach(roomInfo => {
                        const lastMsg = lastMessages?.find(m => m.room_id === roomInfo.room_id)
                        if (lastMsg && new Date(lastMsg.created_at) > new Date(roomInfo.last_read_at)) {
                            const rId = `chat_${roomInfo.room_id}`
                            if (dismissedIds.includes(rId)) return

                            allPending.push({
                                id: rId,
                                type: 'MENS_UNREAD',
                                title: 'Mensaje sin leer',
                                message: (roomInfo.chat_rooms as any).name || 'Conversación Directa',
                                link: `/messages/${roomInfo.room_id}`,
                                date: lastMsg.created_at,
                                priority: 1
                            })
                        }
                    })
                }

                // --- 3. AGENDA NOTIFICATIONS (TODAY) ---
                const today = new Date().toISOString().split('T')[0]
                const { data: calEvents } = await supabase
                    .from('calendar_events')
                    .select('id, title, type')
                    .eq('tenant_id', tenant.id)
                    .eq('start_date', today)

                const { data: teacherEvents } = await supabase
                    .from('teacher_events')
                    .select('id, title')
                    .eq('teacher_id', user.id)
                    .gte('start_time', `${today}T00:00:00Z`)
                    .lte('start_time', `${today}T23:59:59Z`)

                calEvents?.forEach(e => {
                    const eId = `event_${e.id}`
                    if (dismissedIds.includes(eId)) return
                    allPending.push({
                        id: eId,
                        type: 'AGENDA_EVENT',
                        title: 'Evento de Hoy',
                        message: e.title,
                        link: '/agenda',
                        date: today,
                        priority: 4
                    })
                })

                teacherEvents?.forEach(e => {
                    const eId = `tevent_${e.id}`
                    if (dismissedIds.includes(eId)) return
                    allPending.push({
                        id: eId,
                        type: 'AGENDA_EVENT',
                        title: 'Recordatorio Personal',
                        message: e.title,
                        link: '/agenda',
                        date: today,
                        priority: 5
                    })
                })

                setNotifications(allPending.sort((a, b) => (a.priority || 99) - (b.priority || 99)))
            } catch (error) {
                console.error('Error fetching all notifications:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchAllNotifications()
        const interval = setInterval(fetchAllNotifications, 60000)
        return () => clearInterval(interval)
    }, [tenant?.id, dismissedIds])

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
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
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
                                            className="block p-4 hover:bg-gray-50 transition-all group relative"
                                        >
                                            <div className="flex items-start">
                                                <div className={`p-2 rounded-lg mr-3 mt-0.5 group-hover:scale-110 transition-transform ${getBgColor(notif.type)}`}>
                                                    {getIcon(notif.type)}
                                                </div>
                                                <div className="flex-1 pr-6">
                                                    <p className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                        {notif.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5 font-medium leading-tight">
                                                        {notif.message}
                                                    </p>
                                                    {(notif.type === 'NEW_ACTIVITY' || notif.type === 'GRADING_PENDING') && (
                                                        <p className={`text-[10px] mt-1 font-semibold flex items-center ${notif.type === 'NEW_ACTIVITY' ? 'text-indigo-600' : 'text-amber-600'}`}>
                                                            <AlertCircle className="w-3 h-3 mr-1" />
                                                            {notif.pendingCount === 0 ? '¡Completado!' : `${notif.pendingCount} alumnos sin calificar`}
                                                        </p>
                                                    )}
                                                    {notif.type === 'AGENDA_EVENT' && (
                                                        <p className="text-[10px] text-purple-600 mt-1 font-bold uppercase tracking-widest">
                                                            Sucediendo hoy
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => dismissNotification(notif.id, e)}
                                                    className="absolute top-4 right-4 p-1 rounded-md text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Eliminar notificación"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
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
