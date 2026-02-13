import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, Plus, Clock, Trash2, ChevronLeft, ChevronRight, BookOpen, FileText, GraduationCap } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useNavigate } from 'react-router-dom'

export const QuickCalendar = () => {
    const { data: tenant } = useTenant()
    const navigate = useNavigate()
    const [events, setEvents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [newEvent, setNewEvent] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [selectedDate, setSelectedDate] = useState(new Date())

    useEffect(() => {
        if (tenant?.id) {
            fetchEvents(selectedDate)
        }
    }, [tenant?.id, selectedDate])

    const handlePrevDay = () => {
        const prev = new Date(selectedDate)
        prev.setDate(prev.getDate() - 1)
        setSelectedDate(prev)
    }

    const handleNextDay = () => {
        const next = new Date(selectedDate)
        next.setDate(next.getDate() + 1)
        setSelectedDate(next)
    }

    const fetchEvents = async (date: Date) => {
        setLoading(true)
        const dateStr = date.toISOString().split('T')[0]
        const { data: { user } } = await supabase.auth.getUser()

        if (!user || !tenant) return

        // 1. Teacher Events
        const { data: teacherEvents } = await supabase
            .from('teacher_events')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('teacher_id', user.id)
            .gte('start_time', `${dateStr}T00:00:00`)
            .lte('start_time', `${dateStr}T23:59:59`)
            .order('start_time', { ascending: true })

        // 2. Assignments
        const { data: assignments } = await supabase
            .from('assignments')
            .select('id, title, due_date, subject:subject_catalog(name), group:groups(grade, section)')
            .eq('tenant_id', tenant.id)
            .gte('due_date', `${dateStr}T00:00:00`)
            .lte('due_date', `${dateStr}T23:59:59`)

        // 3. Lesson Plans (Check sequence)
        const { data: plans } = await supabase
            .from('lesson_plans')
            .select('id, title, activities_sequence, groups(grade, section), subject_catalog(name)')
            .eq('tenant_id', tenant.id)
            .lte('start_date', dateStr)
            .gte('end_date', dateStr)

        const planningEvents: any[] = []
        if (plans) {
            plans.forEach((plan: any) => {
                if (Array.isArray(plan.activities_sequence)) {
                    plan.activities_sequence.forEach((session: any) => {
                        if (session.date === dateStr) {
                            planningEvents.push({
                                id: `plan-${plan.id}-${session.date}`,
                                title: `Planeación: ${plan.title}`,
                                start_time: `${dateStr}T08:00:00`, // Default morning
                                type: 'PLANNING',
                                details: {
                                    group: plan.groups,
                                    subject: plan.subject_catalog
                                }
                            })
                        }
                    })
                }
            })
        }

        // 4. Class Schedule (Recurring)
        const daysMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
        const currentDayKey = daysMap[date.getDay()]

        // 4a. Get Teacher Subjects to filter schedule
        const { data: teacherSubjects } = await supabase
            .from('profile_subjects')
            .select('subject_catalog_id, custom_detail')
            .eq('profile_id', user.id)

        const teacherSubjectIds = teacherSubjects?.map((s: any) => s.subject_catalog_id).filter(Boolean) || []
        const teacherCustomSubjects = teacherSubjects?.map((s: any) => s.custom_detail).filter(Boolean) || []

        // 4b. Get Schedule for today
        const { data: scheduleClasses } = await supabase
            .from('schedules')
            .select('id, start_time, end_time, subject_id, custom_subject, subject:subject_catalog(id, name), group:groups(grade, section)')
            .eq('tenant_id', tenant.id)
            .eq('day_of_week', currentDayKey)

        // 4c. Filter & Map
        const myClasses = (scheduleClasses || [])
            .filter((cls: any) => {
                if (cls.subject_id) return teacherSubjectIds.includes(cls.subject_id)
                if (cls.custom_subject) return teacherCustomSubjects.includes(cls.custom_subject)
                return false
            })
            .map((c: any) => ({
                id: `class-${c.id}-${dateStr}`,
                title: `Clase: ${c.subject?.name || c.custom_subject}`,
                start_time: `${dateStr}T${c.start_time}`,
                type: 'CLASS',
                details: {
                    group: c.group,
                    subject: c.subject
                }
            }))

        // Normalize & Combine
        const combinedEvents = [
            ...(teacherEvents || []).map((e: any) => ({ ...e, type: 'PERSONAL' })),
            ...(assignments || []).map((a: any) => ({
                id: `assign-${a.id}`,
                title: `Entrega: ${a.title}`,
                start_time: a.due_date,
                type: 'ASSIGNMENT',
                details: {
                    group: a.group,
                    subject: a.subject
                }
            })),
            ...planningEvents,
            ...myClasses
        ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

        setEvents(combinedEvents)
        setLoading(false)
    }

    const handleAddEvent = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newEvent.trim() || !tenant) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const now = new Date()

        const { error } = await supabase
            .from('teacher_events')
            .insert({
                title: newEvent,
                teacher_id: user.id,
                tenant_id: tenant.id,
                start_time: now.toISOString(),
                end_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString() // Default 1 hour
            })

        if (!error) {
            setNewEvent('')
            setIsAdding(false)
            fetchEvents(selectedDate)
        }
    }

    const handleDeleteEvent = async (id: string) => {
        const { error } = await supabase
            .from('teacher_events')
            .delete()
            .eq('id', id)

        if (!error) {
            setEvents(events.filter(e => e.id !== id))
        }
    }

    return (
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 opacity-50" />

            <div className="relative z-10 flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-black text-gray-900 text-lg leading-tight">Agenda</h3>
                        <div className="flex items-center space-x-1 mt-0.5">
                            <button onClick={handlePrevDay} className="p-1 hover:bg-white hover:shadow-sm rounded-full text-gray-500 transition-all">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide min-w-[120px] text-center bg-white/50 py-0.5 px-2 rounded-lg backdrop-blur-sm">
                                {selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                            <button onClick={handleNextDay} className="p-1 hover:bg-white hover:shadow-sm rounded-full text-gray-500 transition-all">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => navigate('/agenda')}
                        className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors hidden sm:block"
                    >
                        Ver todo
                    </button>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
                        title="Agregar recordatorio"
                    >
                        <Plus className={`w-5 h-5 transition-transform duration-300 ${isAdding ? 'rotate-135' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {isAdding && (
                    <form onSubmit={handleAddEvent} className="mb-4 bg-white p-4 rounded-xl shadow-md border border-indigo-100 animate-in slide-in-from-top-2">
                        <input
                            type="text"
                            autoFocus
                            placeholder="¿Qué tienes pendiente, Profe?"
                            value={newEvent}
                            onChange={(e) => setNewEvent(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                        <div className="flex justify-end mt-2">
                            <span className="text-[10px] uppercase font-bold text-indigo-400">Enter para guardar</span>
                        </div>
                    </form>
                )}

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />)}
                    </div>
                ) : events.length > 0 ? (
                    events.map((event) => (
                        <div key={event.id} className={`group relative border p-4 rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 cursor-default
                            ${event.type === 'ASSIGNMENT' ? 'bg-amber-50/80 border-amber-100 hover:border-amber-200' :
                                event.type === 'PLANNING' ? 'bg-violet-50/80 border-violet-100 hover:border-violet-200' :
                                    event.type === 'CLASS' ? 'bg-blue-50/80 border-blue-100 hover:border-blue-200' :
                                        'bg-white border-gray-100 hover:border-indigo-100'
                            }
                        `}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center space-x-2 mb-1">
                                        {event.type === 'ASSIGNMENT' && <FileText className="w-3.5 h-3.5 text-amber-600" />}
                                        {event.type === 'PLANNING' && <BookOpen className="w-3.5 h-3.5 text-violet-600" />}
                                        {event.type === 'CLASS' && <GraduationCap className="w-3.5 h-3.5 text-blue-600" />}
                                        <h4 className={`font-bold text-sm leading-tight ${event.type === 'ASSIGNMENT' ? 'text-amber-900' :
                                                event.type === 'PLANNING' ? 'text-violet-900' :
                                                    event.type === 'CLASS' ? 'text-blue-900' :
                                                        'text-gray-800'
                                            }`}>{event.title}</h4>
                                    </div>
                                    <div className="flex items-center text-xs font-medium text-gray-500 mt-1">
                                        <Clock className="w-3 h-3 mr-1.5 opacity-70" />
                                        {new Date(event.start_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        {event.details && (
                                            <>
                                                <span className="mx-1.5 opacity-30">|</span>
                                                <span className="opacity-75">
                                                    {event.details.subject?.name}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {event.type === 'PERSONAL' && (
                                <button
                                    onClick={() => handleDeleteEvent(event.id)}
                                    className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                    title="Eliminar evento"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <CalendarIcon className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-gray-900 font-bold">Todo despejado</p>
                        <p className="text-gray-500 text-xs mt-1 max-w-[150px]">No tienes eventos ni clases registradas para este día.</p>
                        <button onClick={() => setIsAdding(true)} className="mt-4 text-indigo-600 text-xs font-bold hover:underline">
                            + Agregar recordatorio
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
