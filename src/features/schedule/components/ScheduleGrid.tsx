import { useState, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'

type ScheduleEntry = {
    id: string
    group_id: string
    day_of_week: string
    start_time: string
    end_time: string
    subject_id?: string
    custom_subject?: string
    subject?: {
        name: string
        color?: string
    }
    group?: {
        id: string
        grade: string
        section: string
    }
}

type Break = {
    name: string
    start_time: string
    end_time: string
    start?: string // Robustness for wizard data
    end?: string   // Robustness for wizard data
}

type ScheduleSettings = {
    start_time: string
    end_time: string
    module_duration: number
    breaks: Break[]
}

type ScheduleGridProps = {
    entries: ScheduleEntry[]
    settings: ScheduleSettings
    onSlotClick: (day: string, startTime: string, endTime: string) => void
    onEntryClick: (entry: ScheduleEntry) => void
    groups: any[]
}

const DAYS = [
    { key: 'MONDAY', label: 'Lunes' },
    { key: 'TUESDAY', label: 'Martes' },
    { key: 'WEDNESDAY', label: 'Miércoles' },
    { key: 'THURSDAY', label: 'Jueves' },
    { key: 'FRIDAY', label: 'Viernes' },
]

export const ScheduleGrid = ({ entries, settings, onSlotClick, onEntryClick, groups }: ScheduleGridProps) => {

    const getGroupColor = (groupId: string) => {
        const colors = [
            'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-orange-600',
            'bg-rose-600', 'bg-cyan-600', 'bg-amber-600', 'bg-indigo-600',
            'bg-lime-600', 'bg-fuchsia-600'
        ]
        const index = groups.findIndex(g => g.id === groupId)
        return index !== -1 ? colors[index % colors.length] : 'bg-emerald-600'
    }

    // Helper to convert time to minutes
    const toMinutes = (timeStr: string) => {
        if (!timeStr) return 0
        const [h, m] = timeStr.split(':').map(Number)
        return h * 60 + m
    }

    // Generate Rows (Modules + Breaks)
    const rows = useMemo(() => {
        const generatedRows: {
            type: 'MODULE' | 'BREAK',
            timeLabel: string,
            start: string,
            end: string,
            name?: string
        }[] = []

        if (!settings) return []


        // Helper to convert minutes to HH:MM
        const toTimeStr = (totalMinutes: number) => {
            const h = Math.floor(totalMinutes / 60)
            const m = totalMinutes % 60
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        }

        let currentMinutes = toMinutes(settings.start_time)
        const endMinutes = toMinutes(settings.end_time)

        // Sort breaks by start time
        const sortedBreaks = [...(settings.breaks || [])].sort((a, b) => {
            const startA = toMinutes(a.start_time || a.start || '')
            const startB = toMinutes(b.start_time || b.start || '')
            return startA - startB
        })

        while (currentMinutes < endMinutes) {
            // Check if there is a break starting at currentMinutes
            const breakAtCurrent = sortedBreaks.find(b => toMinutes(b.start_time || b.start || '') === currentMinutes)

            if (breakAtCurrent) {
                const bStart = breakAtCurrent.start_time || breakAtCurrent.start || ''
                const bEnd = breakAtCurrent.end_time || breakAtCurrent.end || ''
                const breakEnd = toMinutes(bEnd)
                generatedRows.push({
                    type: 'BREAK',
                    timeLabel: `${bStart} - ${bEnd}`,
                    start: bStart,
                    end: bEnd,
                    name: breakAtCurrent.name
                })
                currentMinutes = breakEnd
                continue
            }

            // Create Module
            const nextEnd = currentMinutes + settings.module_duration
            // Don't go past end time significantly (allow small buffer?)
            if (currentMinutes >= endMinutes) break

            // Check if a break interrupts this module
            const nextBreak = sortedBreaks.find(b => {
                const bStart = toMinutes(b.start_time || b.start || '')
                return bStart > currentMinutes && bStart < nextEnd
            })

            let actualEnd = nextEnd
            if (nextBreak) {
                actualEnd = toMinutes(nextBreak.start_time || nextBreak.start || '')
            }
            // Clamp to day end
            if (actualEnd > endMinutes) actualEnd = endMinutes

            const startStr = toTimeStr(currentMinutes)
            const endStr = toTimeStr(actualEnd)

            generatedRows.push({
                type: 'MODULE',
                timeLabel: `${startStr} - ${endStr}`,
                start: startStr,
                end: endStr
            })

            currentMinutes = actualEnd // Next iteration starts where we ended
        }
        return generatedRows

    }, [settings])

    const getEntriesForSlot = (day: string, start: string) => {
        // Find entries that overlap/match this slot
        const slotStart = toMinutes(start)
        return entries.filter(entry => {
            const entryStart = toMinutes(entry.start_time)
            return entry.day_of_week === day && Math.abs(entryStart - slotStart) < 5 // 5 min tolerance
        })
    }

    const [selectedMobileDay, setSelectedMobileDay] = useState('MONDAY')

    // Find current day index
    const currentDayIndex = DAYS.findIndex(d => d.key === selectedMobileDay)

    // Helper to get previous/next day
    const handlePrevDay = () => {
        const prevIndex = (currentDayIndex - 1 + DAYS.length) % DAYS.length
        setSelectedMobileDay(DAYS[prevIndex].key)
    }

    const handleNextDay = () => {
        const nextIndex = (currentDayIndex + 1) % DAYS.length
        setSelectedMobileDay(DAYS[nextIndex].key)
    }

    if (!settings) return <div className="p-4 text-center text-gray-500">Cargando configuración...</div>

    return (
        <div className="space-y-4">
            {/* Mobile Day Selector */}
            <div className="md:hidden bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                <button
                    onClick={handlePrevDay}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Viendo</span>
                    <span className="text-lg font-black text-gray-900">{DAYS[currentDayIndex].label}</span>
                </div>
                <button
                    onClick={handleNextDay}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-6 border-b border-gray-200 bg-gray-50">
                    <div className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider text-center border-r">
                        Horario
                    </div>
                    {DAYS.map(day => (
                        <div key={day.key} className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider text-center border-r last:border-r-0">
                            {day.label}
                        </div>
                    ))}
                </div>

                {/* Mobile Header (Just Time and Day) */}
                <div className="md:hidden grid grid-cols-4 border-b border-gray-200 bg-gray-50">
                    <div className="col-span-1 py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center border-r">
                        Hora
                    </div>
                    <div className="col-span-3 py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                        Clase
                    </div>
                </div>

                <div className="divide-y divide-gray-200">
                    {rows.map((row, index) => (
                        <div key={index} className="grid grid-cols-4 md:grid-cols-6 min-h-[70px] md:min-h-[60px]">
                            {/* Time Label Column */}
                            <div className={`col-span-1 py-2 px-2 text-xs text-gray-500 text-center border-r flex flex-col items-center justify-center ${row.type === 'BREAK' ? 'bg-orange-50' : 'bg-gray-50/50'}`}>
                                {row.type === 'BREAK' ? (
                                    <>
                                        <span className="hidden md:inline font-bold text-orange-600 mb-1">{row.name}</span>
                                        <span>{row.timeLabel}</span>
                                    </>
                                ) : (
                                    <span className="font-mono">{row.timeLabel}</span>
                                )}
                            </div>

                            {row.type === 'BREAK' ? (
                                /* Break Row */
                                <div className="col-span-3 md:col-span-5 bg-orange-50 flex items-center justify-center text-xs md:text-sm text-orange-600 font-medium tracking-wide p-2">
                                    <span className="md:hidden mr-2 font-bold">{row.name}:</span> {row.timeLabel}
                                </div>
                            ) : (
                                /* Content Columns */
                                <>
                                    {/* Desktop: All Days */}
                                    {DAYS.map(day => {
                                        const slotEntries = getEntriesForSlot(day.key, row.start)
                                        return (
                                            <div
                                                key={`desktop-${day.key}-${row.start}`}
                                                className="hidden md:block border-r last:border-r-0 relative p-1 transition-colors hover:bg-gray-50 group"
                                                onClick={() => onSlotClick(day.key, row.start, row.end)}
                                            >
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                                                    <Plus className="w-4 h-4 text-gray-300" />
                                                </div>
                                                {slotEntries.map(entry => (
                                                    <div
                                                        key={entry.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onEntryClick(entry)
                                                        }}
                                                        className={`absolute inset-1 ${getGroupColor(entry.group_id)} text-white text-[10px] rounded-lg p-1.5 cursor-pointer hover:brightness-110 transition-all overflow-hidden shadow-md z-10 flex flex-col justify-center items-center text-center`}
                                                    >
                                                        <div className="font-extrabold leading-tight uppercase text-[9px] lg:text-[10px]">
                                                            {entry.group ? `${entry.group.grade}° ${entry.group.section}` : 'N/A'}
                                                        </div>
                                                        <div className="truncate w-full font-medium opacity-90 mt-0.5 text-[8px] lg:text-[10px]">
                                                            {entry.subject?.name || entry.custom_subject}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    })}

                                    {/* Mobile: Selected Day Only */}
                                    {(() => {
                                        const day = DAYS[currentDayIndex]
                                        const slotEntries = getEntriesForSlot(day.key, row.start)
                                        return (
                                            <div
                                                key={`mobile-${day.key}-${row.start}`}
                                                className="md:hidden col-span-3 relative p-1 transition-colors hover:bg-gray-50"
                                                onClick={() => onSlotClick(day.key, row.start, row.end)}
                                            >
                                                {slotEntries.length === 0 && (
                                                    <div className="flex items-center justify-center h-full opacity-20">
                                                        <Plus className="w-4 h-4" />
                                                    </div>
                                                )}
                                                {slotEntries.map(entry => (
                                                    <div
                                                        key={entry.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onEntryClick(entry)
                                                        }}
                                                        className={`absolute inset-1 ${getGroupColor(entry.group_id)} text-white rounded-lg p-2 cursor-pointer shadow-md z-10 flex items-center justify-between px-4`}
                                                    >
                                                        <div className="font-black text-lg">
                                                            {entry.group ? `${entry.group.grade}° ${entry.group.section}` : 'N/A'}
                                                        </div>
                                                        <div className="font-bold text-sm text-right leading-tight">
                                                            {entry.subject?.name || entry.custom_subject}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    })()}
                                </>
                            )}
                        </div>
                    ))}

                    {rows.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No se ha configurado el horario.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
