
import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, Upload, RefreshCw, BookOpen, X, ArrowRight, Trash2, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { supabase } from '../../../lib/supabase'
import { parseIcsContent } from '../../../utils/icsParser'
import { useRef } from 'react'

export const AgendaPage = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const userRole = (tenant as any)?.role || profile?.role
    const isIndependent = (tenant as any)?.type === 'INDEPENDENT'
    const [currentDate, setCurrentDate] = useState(new Date())
    const [events, setEvents] = useState<any[]>([])
    const [importing, setImporting] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<any>(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [focusedDate, setFocusedDate] = useState<Date | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)


    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    useEffect(() => {
        const fetchEvents = async () => {
            if (!tenant?.id) return

            try {
                // Calculate start/end of view range
                const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
                const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

                console.log('[Agenda] Fetching events for:', monthNames[currentDate.getMonth()], currentDate.getFullYear())

                // 1. Fetch SEP and Direction Events
                const { data: sepEvents, error: sepError } = await supabase
                    .from('calendar_events')
                    .select('*')
                    .or(`tenant_id.eq.${tenant.id},is_official_sep.eq.true`)
                    .gte('start_date', startOfMonth.toISOString())
                    .lte('end_date', endOfMonth.toISOString())

                if (sepError) console.error('[Agenda] Error fetching SEP events:', sepError)

                // 2. Fetch Assignments (as events)
                const bufferStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), -7)
                const bufferEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 7)

                const { data: assignments, error: assError } = await supabase
                    .from('assignments')
                    .select('id, title, due_date, subject:subject_catalog(name), group:groups(grade, section)')
                    .eq('tenant_id', tenant.id)
                    .gte('due_date', bufferStart.toISOString())
                    .lte('due_date', bufferEnd.toISOString())

                if (assError) console.error('[Agenda] Error fetching assignments:', assError)
                else console.log('[Agenda] Assignments loaded:', assignments?.length)

                // 3. Fetch Personal Teacher Events
                const { data: { user } } = await supabase.auth.getUser()
                let teacherEvents: any[] = []
                if (user) {
                    const { data, error: teacherError } = await supabase
                        .from('teacher_events')
                        .select('*')
                        .eq('teacher_id', user.id)
                        .gte('start_time', startOfMonth.toISOString())
                        .lte('end_time', endOfMonth.toISOString())

                    if (teacherError) console.error('[Agenda] Error fetching teacher events:', teacherError)
                    teacherEvents = data || []
                }

                // 4. Fetch Lesson Plans (Planning)
                const { data: plans, error: plansError } = await supabase
                    .from('lesson_plans')
                    .select('id, title, activities_sequence, groups(grade, section), subject_catalog(name), temporality')
                    .eq('tenant_id', tenant.id)
                    .lte('start_date', endOfMonth.toISOString())
                    .gte('end_date', startOfMonth.toISOString())

                if (plansError) console.error('[Agenda] Error fetching lesson plans:', plansError)

                const planningEvents: any[] = []
                if (plans) {
                    plans.forEach((plan: any) => {
                        if (Array.isArray(plan.activities_sequence)) {
                            plan.activities_sequence.forEach((session: any, index: number) => {
                                const sessDate = new Date(session.date)
                                const endOfDay = new Date(endOfMonth)
                                endOfDay.setHours(23, 59, 59, 999)

                                if (sessDate >= startOfMonth && sessDate <= endOfDay) {
                                    planningEvents.push({
                                        id: `${plan.id}_${index}`,
                                        original_plan_id: plan.id,
                                        title: plan.title || 'Sesión de Clase',
                                        date: session.date,
                                        type: 'PLANNING',
                                        color: 'bg-violet-100 text-violet-800 border-violet-200',
                                        details: {
                                            ...session,
                                            group: plan.groups,
                                            subject: plan.subject_catalog,
                                            planTitle: plan.title
                                        }
                                    })
                                }
                            })
                        }
                    })
                }

                // Normalize Events
                const normalizedEvents = [
                    ...(sepEvents || []).map((e: any) => ({
                        id: e.id,
                        title: e.title,
                        date: e.start_date,
                        type: e.type?.toUpperCase() === 'DIRECTION' || e.is_direction ? 'DIRECTION' : 'SEP',
                        color: 'bg-cyan-100 text-cyan-800 border-cyan-200'
                    })),
                    ...(assignments || []).map((a: any) => ({
                        id: a.id,
                        title: `Entrega: ${a.title}`,
                        date: a.due_date.split('T')[0],
                        type: 'ASSIGNMENT',
                        subtitle: `${Array.isArray(a.subject) ? a.subject[0]?.name : a.subject?.name} (${Array.isArray(a.group) ? a.group[0]?.grade : a.group?.grade}° ${Array.isArray(a.group) ? a.group[0]?.section : a.group?.section})`,
                        color: 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    })),
                    ...(teacherEvents || []).map((e: any) => {
                        const timeStr = new Date(e.start_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
                        return {
                            id: e.id,
                            title: e.title,
                            date: e.start_time.split('T')[0],
                            start_time: e.start_time,
                            displayTime: timeStr,
                            type: 'PERSONAL',
                            color: 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        }
                    }),
                    ...planningEvents
                ]

                setEvents(normalizedEvents)
            } catch (err) {
                console.error('[Agenda] Fatal error in fetchEvents:', err)
            }
        }
        fetchEvents()
    }, [tenant?.id, currentDate])

    const handleAddPersonalEvent = async (date: Date) => {
        const title = window.prompt('Título de mi actividad personal:')
        if (!title) return

        const time = window.prompt('Hora (HH:MM) - Opcional:', '09:00')
        const timeValue = time || '09:00'
        const dateStr = date.toISOString().split('T')[0]

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('teacher_events').insert({
            title,
            start_time: `${dateStr}T${timeValue}:00`,
            end_time: `${dateStr}T${timeValue}:00`,
            teacher_id: user.id,
            tenant_id: tenant?.id
        })

        if (error) {
            alert('Error al guardar: ' + error.message)
        } else {
            setCurrentDate(new Date(currentDate)) // Refresh
        }
    }

    const handleAddSchoolEvent = async (date: Date) => {
        const title = window.prompt('Título del evento escolar:')
        if (!title) return
        const isGlobal = window.confirm('¿Es un evento global de la DIRECCIÓN?')
        const dateStr = date.toISOString().split('T')[0]

        await supabase.from('calendar_events').insert({
            title,
            start_date: dateStr,
            end_date: dateStr,
            tenant_id: tenant?.id,
            type: isGlobal ? 'direction' : 'generic'
        })
        setCurrentDate(new Date(currentDate)) // Refresh
    }

    const handleIcsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !tenant?.id) return

        setImporting(true)
        try {
            const content = await file.text()
            const parsedEvents = parseIcsContent(content)

            if (parsedEvents.length === 0) {
                alert('No se encontraron eventos válidos en el archivo .ics')
                return
            }

            if (!window.confirm(`Se encontraron ${parsedEvents.length} eventos. ¿Deseas importarlos a tu agenda?`)) return

            const isGlobal = window.confirm('¿Deseas marcar estos eventos como "Globales de Dirección" para que todo el personal los visualice?')

            const eventsToInsert = parsedEvents.map(event => ({
                title: event.title,
                description: event.description,
                start_date: event.startDate,
                end_date: event.endDate,
                tenant_id: tenant.id,
                is_official_sep: false,
                type: isGlobal ? 'direction' : 'generic'
            }))

            const { error } = await supabase
                .from('calendar_events')
                .insert(eventsToInsert)

            if (error) throw error

            alert('¡Calendario importado con éxito!')
            // Refresh events
            setCurrentDate(new Date(currentDate)) // trigger useEffect
        } catch (error: any) {
            console.error('Import error details:', error)
            const errorMsg = error.message || error.error_description || (typeof error === 'string' ? error : 'Error desconocido')
            alert('Error al importar el archivo: ' + errorMsg)
        } finally {
            setImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleDeleteEvent = async (event: any) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este evento?')) return

        try {
            const table = ['SEP', 'DIRECTION'].includes(event.type) ? 'calendar_events' : 'teacher_events'
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', event.id)

            if (error) throw error

            setEvents(prev => prev.filter(e => e.id !== event.id))
            setIsDetailModalOpen(false)
            setSelectedEvent(null)
            alert('Evento eliminado correctamente.')
        } catch (error: any) {
            console.error('Delete error:', error)
            alert('Error al eliminar el evento: ' + error.message)
        }
    }

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const getDaysInMonth = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDay = firstDay.getDay() // 0 = Sunday

        const days = []
        // Empty slots for previous month
        for (let i = 0; i < startingDay; i++) {
            days.push(null)
        }
        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i))
        }
        return days
    }

    const getDailyEvents = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0]
        return events.filter(e => e.date === dateStr)
            .sort((a, b) => {
                if (a.start_time && b.start_time) return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                return 0
            })
    }

    return (
        <div className="space-y-4 md:space-y-6 pb-24 md:pb-12 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-4 md:p-8 shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-50" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center tracking-tight">
                            <span className="p-2 bg-blue-600 rounded-xl mr-3 shadow-lg shadow-blue-200">
                                <CalendarIcon className="h-5 w-5 md:h-6 md:w-6 text-white" />
                            </span>
                            Agenda Escolar
                        </h1>
                        <p className="mt-1 md:mt-2 text-sm md:text-gray-600 font-medium ml-1">
                            Gestiona tus eventos SEP, entregas y actividades escolares.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-row gap-4 items-center">
                        <div className="flex items-center bg-white rounded-xl p-1 border border-gray-200 shadow-sm w-full sm:w-auto justify-between">
                            <button
                                onClick={prevMonth}
                                className="p-2 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="font-bold text-gray-900 min-w-0 px-2 sm:min-w-[160px] text-center capitalize text-sm md:text-lg truncate">
                                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </span>
                            <button
                                onClick={nextMonth}
                                className="p-2 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="hidden sm:flex items-center space-x-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleIcsImport}
                                accept=".ics"
                                className="hidden"
                            />
                            {(['DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER'].includes(userRole || '') || isIndependent) && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={importing}
                                    className="inline-flex justify-center items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-all disabled:opacity-50"
                                >
                                    {importing ? (
                                        <RefreshCw className="-ml-1 mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Upload className="-ml-1 mr-2 h-4 w-4" />
                                    )}
                                    Importar
                                </button>
                            )}
                            {(['DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER'].includes(userRole || '') || isIndependent) && (
                                <button
                                    onClick={async () => {
                                        const title = window.prompt('Título del evento escolar:')
                                        if (!title) return
                                        const date = window.prompt('Fecha (YYYY-MM-DD):', new Date().toISOString().split('T')[0])
                                        if (!date) return
                                        const isGlobal = window.confirm('¿Es un evento global de la DIRECCIÓN?')

                                        await supabase.from('calendar_events').insert({
                                            title,
                                            start_date: date,
                                            end_date: date,
                                            tenant_id: tenant?.id,
                                            type: isGlobal ? 'direction' : 'generic'
                                        })
                                        setCurrentDate(new Date(currentDate))
                                    }}
                                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-lg shadow-blue-200 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-all font-sans"
                                >
                                    <Plus className="-ml-1 mr-2 h-4 w-4" />
                                    Evento Escolar
                                </button>
                            )}
                            <button
                                onClick={async () => {
                                    const title = window.prompt('Título de mi actividad personal:')
                                    if (!title) return
                                    const date = window.prompt('Fecha (YYYY-MM-DD):', new Date().toISOString().split('T')[0])
                                    if (!date) return

                                    const time = window.prompt('Hora (HH:MM) - Opcional:', '09:00')
                                    const timeValue = time || '09:00'

                                    const { data: { user } } = await supabase.auth.getUser()
                                    if (!user) return

                                    const { error } = await supabase.from('teacher_events').insert({
                                        title,
                                        start_time: `${date}T${timeValue}:00`,
                                        end_time: `${date}T${timeValue}:00`,
                                        teacher_id: user.id,
                                        tenant_id: tenant?.id
                                    })

                                    if (error) {
                                        alert('Error al guardar: ' + error.message)
                                    } else {
                                        setCurrentDate(new Date(currentDate))
                                    }
                                }}
                                className="inline-flex justify-center items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-all"
                            >
                                <Plus className="-ml-1 mr-2 h-4 w-4 text-gray-400" />
                                Mi Evento
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Header Days (Desktop Only) */}
                <div className="hidden md:grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                        <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-1 md:grid-cols-7 auto-rows-fr bg-gray-200 gap-px border-gray-200">
                    {getDaysInMonth().map((date, idx) => {
                        // Hide empty slots on mobile
                        if (!date) return <div key={`empty-${idx}`} className="hidden md:block bg-gray-50 min-h-[120px]" />

                        const dayEvents = getDailyEvents(date)
                        const isToday = date.toDateString() === new Date().toDateString()
                        const dayName = date.toLocaleDateString('es-MX', { weekday: 'long' })

                        return (
                            <div
                                key={date.toISOString()}
                                onClick={() => setFocusedDate(date)}
                                className={`bg-white min-h-[100px] md:min-h-[140px] p-3 md:p-2 relative group hover:bg-gray-50 transition-colors cursor-pointer ${isToday ? 'bg-blue-50/50' : ''}`}
                            >
                                <div className="flex md:block items-center justify-between mb-2 md:mb-0">
                                    <div className="md:hidden text-xs font-bold text-gray-400 uppercase mr-2">{dayName}</div>
                                    <span className={`text-sm font-bold ${isToday ? 'text-white bg-blue-600 w-7 h-7 rounded-lg shadow-md flex items-center justify-center' : 'text-gray-700'}`}>
                                        {date.getDate()}
                                    </span>
                                </div>

                                <div className="mt-2 space-y-1.5">
                                    {dayEvents.map((event, eventIdx) => (
                                        <div
                                            key={`${event.id}-${eventIdx}`}
                                            className={`text-xs p-2 rounded-lg border ${event.color} cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all`}
                                            title={`${event.title} ${event.subtitle || ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setSelectedEvent(event)
                                                setIsDetailModalOpen(true)
                                            }}
                                        >
                                            <div className="font-bold truncate text-gray-900 flex items-center">
                                                {event.displayTime && (
                                                    <span className="mr-1.5 opacity-70 font-mono text-[9px] bg-white/50 px-1 rounded">
                                                        {event.displayTime}
                                                    </span>
                                                )}
                                                <span className="truncate">{event.title}</span>
                                            </div>
                                            {event.subtitle && <div className="text-[10px] opacity-75 truncate font-medium mt-0.5">{event.subtitle}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })
                    }
                </div>
            </div>

            {/* FOCUSED DATE DETAILS MODAL */}
            {
                focusedDate && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]">
                            <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900">
                                        {focusedDate.getDate()} de {monthNames[focusedDate.getMonth()]}
                                    </h3>
                                    <p className="text-sm font-medium text-gray-500 capitalize">
                                        {focusedDate.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setFocusedDate(null)}
                                    className="p-2 bg-white hover:bg-gray-200 rounded-full transition-colors shadow-sm"
                                >
                                    <X className="w-5 h-5 text-gray-900" />
                                </button>
                            </div>

                            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                                {getDailyEvents(focusedDate).length === 0 ? (
                                    <div className="text-center py-8 opacity-50">
                                        <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm font-medium text-gray-400">Sin eventos este día</p>
                                    </div>
                                ) : (
                                    getDailyEvents(focusedDate).map((event, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                setSelectedEvent(event)
                                                setIsDetailModalOpen(true)
                                            }}
                                            className={`p-3 rounded-xl border ${event.color} cursor-pointer hover:shadow-md transition-all flex items-start gap-3`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {event.displayTime && <span className="text-[10px] font-mono font-bold bg-white/50 px-1.5 py-0.5 rounded text-gray-700">{event.displayTime}</span>}
                                                    <h4 className="font-bold text-sm truncate">{event.title}</h4>
                                                </div>
                                                {event.subtitle && <p className="text-xs opacity-80 mt-1 truncate">{event.subtitle}</p>}
                                                <p className="text-[10px] uppercase font-black tracking-widest opacity-60 mt-2">
                                                    {event.type === 'PLANNING' ? 'Planeación' : event.type === 'PERSONAL' ? 'Personal' : 'Institucional'}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 opacity-50 self-center" />
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        handleAddPersonalEvent(focusedDate)
                                        setFocusedDate(null)
                                    }}
                                    className="w-full flex items-center justify-center px-4 py-3 bg-white border border-gray-200 shadow-sm rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all hover:border-blue-300 group"
                                >
                                    <Plus className="w-4 h-4 mr-2 text-blue-500 group-hover:scale-110 transition-transform" />
                                    Agregar Evento Personal
                                </button>

                                {(['DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER'].includes(userRole || '') || isIndependent) && (
                                    <button
                                        onClick={() => {
                                            handleAddSchoolEvent(focusedDate)
                                            setFocusedDate(null)
                                        }}
                                        className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 shadow-lg shadow-blue-200 rounded-xl font-bold text-sm text-white hover:bg-blue-700 transition-all hover:scale-[1.02]"
                                    >
                                        <Shield className="w-4 h-4 mr-2" />
                                        Agregar Evento Escolar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Event Detail Modal */}
            {
                isDetailModalOpen && selectedEvent && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
                            <div className={`p-6 ${selectedEvent.color.split(' ')[0]} flex justify-between items-start shrink-0`}>
                                <div>
                                    <div className="flex items-center space-x-2 mb-2 opacity-80">
                                        {selectedEvent.type === 'PLANNING' && <BookOpen className="w-4 h-4" />}
                                        {selectedEvent.type === 'SEP' && <CalendarIcon className="w-4 h-4" />}
                                        {selectedEvent.type === 'DIRECTION' && <Shield className="w-4 h-4" />}
                                        {selectedEvent.type === 'PERSONAL' && <Clock className="w-4 h-4" />}
                                        <span className="text-[10px] uppercase font-black tracking-widest">
                                            {selectedEvent.type === 'PLANNING' ? 'Planeación Didáctica' : selectedEvent.type === 'SEP' ? 'Evento Oficial' : selectedEvent.type === 'DIRECTION' ? 'Evento de Dirección' : 'Evento Personal'}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900 leading-tight">
                                        {selectedEvent.title}
                                    </h3>
                                    {selectedEvent.details?.group && (
                                        <p className="text-sm font-medium mt-1 opacity-75">
                                            {selectedEvent.details.subject?.name} • {selectedEvent.details.group.grade}° {selectedEvent.details.group.section}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors backdrop-blur-sm"
                                >
                                    <X className="w-5 h-5 text-gray-900" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 bg-white flex-1">
                                {selectedEvent.type === 'PLANNING' && selectedEvent.details?.activities ? (
                                    <>
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[10px] font-black uppercase text-indigo-500 mb-2 tracking-wider">Apertura</h4>
                                                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                    {selectedEvent.details.activities.apertura || 'Sin actividad registrada'}
                                                </p>
                                            </div>
                                            <div>
                                                <h4 className="text-[10px] font-black uppercase text-indigo-500 mb-2 tracking-wider">Desarrollo</h4>
                                                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                    {selectedEvent.details.activities.desarrollo || 'Sin actividad registrada'}
                                                </p>
                                            </div>
                                            <div>
                                                <h4 className="text-[10px] font-black uppercase text-indigo-500 mb-2 tracking-wider">Cierre</h4>
                                                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                    {selectedEvent.details.activities.cierre || 'Sin actividad registrada'}
                                                </p>
                                            </div>
                                            {selectedEvent.details.resources && (
                                                <div>
                                                    <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2">Recursos</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(Array.isArray(selectedEvent.details.resources)
                                                            ? selectedEvent.details.resources
                                                            : [selectedEvent.details.resources]
                                                        ).map((res: string, idx: number) => (
                                                            <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium">
                                                                {res}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-gray-500 italic text-center py-8">
                                        No hay detalles adicionales disponibles para este evento.
                                    </p>
                                )}
                            </div>

                            <div className="p-3 md:p-4 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-3 shrink-0">
                                <div className="w-full md:w-auto flex justify-center md:justify-start">
                                    {(selectedEvent.type === 'PERSONAL' || (['SEP', 'DIRECTION'].includes(selectedEvent.type) && (['DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER'].includes(userRole || '') || isIndependent))) && (
                                        <button
                                            onClick={() => handleDeleteEvent(selectedEvent)}
                                            className="flex items-center px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Eliminar Evento
                                        </button>
                                    )}
                                </div>
                                {selectedEvent.type === 'PLANNING' && (
                                    <Link
                                        to={`/planning/${selectedEvent.original_plan_id}`}
                                        className="w-full md:w-auto flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 hover:scale-105 transition-all"
                                    >
                                        Ir a la Planeación <ArrowRight className="w-4 h-4 ml-2" />
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Mobile FAB */}
            <div className="fixed bottom-24 right-6 sm:hidden z-50">
                <button
                    onClick={async () => {
                        const title = window.prompt('Título de mi actividad personal:')
                        if (!title) return
                        const date = window.prompt('Fecha (YYYY-MM-DD):', new Date().toISOString().split('T')[0])
                        if (!date) return

                        const time = window.prompt('Hora (HH:MM) - Opcional:', '09:00')
                        const timeValue = time || '09:00'

                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) return

                        const { error } = await supabase.from('teacher_events').insert({
                            title,
                            start_time: `${date}T${timeValue}:00`,
                            end_time: `${date}T${timeValue}:00`,
                            teacher_id: user.id,
                            tenant_id: tenant?.id
                        })

                        if (error) {
                            alert('Error al guardar: ' + error.message)
                        } else {
                            setCurrentDate(new Date(currentDate))
                        }
                    }}
                    className="flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 active:scale-95 transition-all outline-none"
                    title="Crear actividad personalizada"
                >
                    <Plus className="w-8 h-8" />
                </button>
            </div>
        </div>
    )
}
