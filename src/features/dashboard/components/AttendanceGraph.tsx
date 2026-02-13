import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { BarChart3 } from 'lucide-react'

export const AttendanceGraph = () => {
    const { data: tenant } = useTenant()
    const [stats, setStats] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (tenant) {
            fetchAttendance()
        }
    }, [tenant])

    const fetchAttendance = async () => {
        // Get last 5 days
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - 4)

        const startStr = startDate.toISOString().split('T')[0]
        const endStr = endDate.toISOString().split('T')[0]

        // Fetch attendance records
        const { data: attendanceData } = await supabase
            .from('attendance')
            .select('date, status')
            .eq('tenant_id', tenant?.id)
            .gte('date', startStr)
            .lte('date', endStr)

        // Process data
        const daysMap = new Map()

        // Initialize days
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0]
            const dayName = d.toLocaleDateString('es-MX', { weekday: 'short' })
            daysMap.set(dateStr, { day: dayName, present: 0, total: 0, percentage: 0 })
        }

        if (attendanceData) {
            attendanceData.forEach((record: any) => {
                const dateStr = record.date
                if (daysMap.has(dateStr)) {
                    const dayStats = daysMap.get(dateStr)
                    dayStats.total += 1
                    if (record.status === 'PRESENT') {
                        dayStats.present += 1
                    }
                }
            })
        }

        // Calculate percentages
        daysMap.forEach((value) => {
            if (value.total > 0) {
                value.percentage = Math.round((value.present / value.total) * 100)
            }
        })

        setStats(Array.from(daysMap.values()))
        setLoading(false)
    }

    if (loading) return <div className="h-64 bg-gray-50 rounded-2xl animate-pulse" />

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-64">
            <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900">Asistencia Semanal</h3>
            </div>

            <div className="flex-1 flex items-end justify-between space-x-4 px-2">
                {stats.map((stat, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1 group relative">
                        {/* Tooltip */}
                        <div className="absolute -top-8 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {stat.percentage}% Asistencia
                        </div>

                        <div className="w-full bg-gray-100 rounded-t-lg relative h-32 overflow-hidden">
                            <div
                                className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-lg transition-all duration-1000 ease-out group-hover:bg-emerald-400"
                                style={{ height: `${stat.percentage}%` }}
                            />
                        </div>
                        <span className="text-xs font-bold text-gray-400 mt-2 capitalize">{stat.day}</span>
                    </div>
                ))}
                {stats.length === 0 && (
                    <div className="w-full text-center text-gray-400 text-sm">
                        No hay datos de asistencia recientes.
                    </div>
                )}
            </div>
        </div>
    )
}
