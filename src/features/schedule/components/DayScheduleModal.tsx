import { X, Clock, Users, Coffee } from 'lucide-react'

type DayScheduleModalProps = {
    isOpen: boolean
    onClose: () => void
    timelineItems: any[]
    currentTime: Date
    currentClass: any
    currentBreak: any
}

export const DayScheduleModal = ({
    isOpen,
    onClose,
    timelineItems,
    currentTime,
    currentClass,
    currentBreak
}: DayScheduleModalProps) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-blue-600" />
                        Horario del Día
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 space-y-3">
                    {timelineItems.length > 0 ? (
                        timelineItems.map((item, index) => {
                            const isClass = item.type === 'class'
                            const isPast = currentTime.toLocaleTimeString('en-US', { hour12: false }) > item.end_time
                            const isCurrent = isClass
                                ? currentClass?.id === item.id
                                : currentBreak?.name === item.name

                            if (!isClass) {
                                // Break Item
                                return (
                                    <div key={`break-${index}`} className={`p-3 rounded-xl border border-dashed border-green-200 bg-green-50/50 flex items-center justify-center ${isCurrent ? 'ring-2 ring-green-400' : ''}`}>
                                        <Coffee className="w-4 h-4 text-green-600 mr-2" />
                                        <span className="text-sm font-bold text-green-700 mr-2">{item.name || 'Receso'}</span>
                                        <span className="text-xs text-green-600 font-medium">
                                            {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                                        </span>
                                    </div>
                                )
                            }

                            // Class Item
                            return (
                                <div key={item.id} className={`p-4 rounded-xl border transition-all ${isCurrent
                                    ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-400 shadow-sm'
                                    : isPast
                                        ? 'bg-gray-50 border-gray-100 opacity-60'
                                        : 'bg-white border-gray-100 shadow-sm'
                                    }`}>
                                    <div className="flex items-center">
                                        <div className="w-16 flex-shrink-0 text-center mr-4">
                                            <span className={`block text-sm font-black ${isCurrent ? 'text-blue-700' : 'text-gray-900'}`}>
                                                {item.start_time.slice(0, 5)}
                                            </span>
                                            <span className="text-xs text-gray-400 font-medium">
                                                {item.end_time.slice(0, 5)}
                                            </span>
                                        </div>

                                        <div className="w-px h-10 bg-gray-200 mr-4"></div>

                                        <div className="flex-1">
                                            <h4 className={`font-bold text-base ${isCurrent ? 'text-blue-800' : 'text-gray-800'}`}>
                                                {item.subject?.name || item.custom_subject}
                                            </h4>
                                            <div className="flex items-center text-xs text-gray-500 mt-1">
                                                <Users className="w-3 h-3 mr-1" />
                                                <span className="font-medium">{item.group?.grade}° "{item.group?.section}"</span>
                                            </div>
                                        </div>

                                        {isCurrent && (
                                            <div className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded uppercase tracking-wider">
                                                Ahora
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="py-12 text-center text-gray-400">
                            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No hay clases para hoy</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
