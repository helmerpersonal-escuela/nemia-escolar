import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { BookOpen } from 'lucide-react'

type Subject = {
    id: string
    name: string
    field_of_study: string
    requires_specification: boolean
}

type SelectedSubject = {
    selected: boolean
    customDetail: string
}

interface SubjectSelectorProps {
    educationalLevel: string
    selectedSubjects: Record<string, SelectedSubject>
    onChange: (subjects: Record<string, SelectedSubject>) => void
    readOnly?: boolean
}

export const SubjectSelector = ({ educationalLevel, selectedSubjects, onChange, readOnly = false }: SubjectSelectorProps) => {
    const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchSubjects = async () => {
            setLoading(true)
            const { data } = await supabase
                .from('subject_catalog')
                .select('*')
                .or(`educational_level.eq.${educationalLevel}${educationalLevel === 'TELESECUNDARIA' ? ',educational_level.eq.SECONDARY' : ''},educational_level.eq.BOTH`)
                .order('field_of_study')

            if (data) setAvailableSubjects(data)
            setLoading(false)
        }
        fetchSubjects()
    }, [educationalLevel])

    // Deduplicate subjects by normalized name (preferring UPPERCASE)
    const uniqueSubjects = availableSubjects.reduce((acc, current) => {
        const normalized = current.name.toUpperCase().trim()

        if (!acc.has(normalized)) {
            acc.set(normalized, current)
        } else {
            // If current is fully uppercase and stored is not, replace it
            const stored = acc.get(normalized)!
            if (current.name === normalized && stored.name !== normalized) {
                acc.set(normalized, current)
            }
        }
        return acc
    }, new Map<string, Subject>())

    // Group subjects by field
    const subjectsByField = Array.from(uniqueSubjects.values()).reduce((acc, subject) => {
        if (!acc[subject.field_of_study]) acc[subject.field_of_study] = []
        acc[subject.field_of_study].push(subject)
        return acc
    }, {} as Record<string, Subject[]>)

    if (loading) return <div className="text-gray-500 text-sm py-4">Cargando materias...</div>

    return (
        <div className="space-y-6">
            {Object.entries(subjectsByField).map(([field, subjects]) => (
                <div key={field} className="border-t pt-4 first:border-0 first:pt-0">
                    <h3 className="font-medium text-blue-700 mb-3 flex items-center">
                        <BookOpen className="w-4 h-4 mr-2" />
                        {field}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {subjects.map(subject => {
                            const isSelected = selectedSubjects[subject.id]?.selected || false
                            return (
                                <div key={subject.id} className={`p-3 rounded-lg border transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                                    <div className="flex items-start">
                                        <div className="flex h-5 items-center">
                                            <input
                                                type="checkbox"
                                                disabled={readOnly}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 disabled:opacity-50"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    onChange({
                                                        ...selectedSubjects,
                                                        [subject.id]: {
                                                            selected: e.target.checked,
                                                            customDetail: selectedSubjects[subject.id]?.customDetail || ''
                                                        }
                                                    })
                                                }}
                                            />
                                        </div>
                                        <div className="ml-3 text-sm leading-6 w-full">
                                            <label className={`font-medium ${readOnly ? 'text-gray-700' : 'text-gray-900'}`}>{subject.name}</label>
                                            {subject.requires_specification && isSelected && (
                                                <input
                                                    type="text"
                                                    disabled={readOnly}
                                                    placeholder="Especifique (ej. Informática)"
                                                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 disabled:bg-gray-100"
                                                    value={selectedSubjects[subject.id]?.customDetail || ''}
                                                    onChange={(e) => {
                                                        onChange({
                                                            ...selectedSubjects,
                                                            [subject.id]: {
                                                                ...selectedSubjects[subject.id],
                                                                customDetail: e.target.value
                                                            }
                                                        })
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}

            {availableSubjects.length === 0 && (
                <p className="text-gray-500 text-sm">No hay materias disponibles para este nivel educativo.</p>
            )}
        </div>
    )
}
