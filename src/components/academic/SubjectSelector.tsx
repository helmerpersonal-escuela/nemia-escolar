import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Search, X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { TECH_SPECIALTIES, formatSubjectName } from '../../lib/subjectName'
import { buildSubjectOptions, matchesSearch, normalizeText, shortField, type CatalogSubject, type SubjectOption } from '../../lib/subjectCatalog'

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

// Las especialidades que más se ven; el resto se escribe en "Otra"
const TOP_SPECIALTIES = TECH_SPECIALTIES.slice(0, 12)

/**
 * Elegir materias sin saber de campos formativos:
 * 1) arriba, las que ya elegiste; 2) un buscador; 3) botones con todas las materias;
 * 4) al final, "¿No está tu materia?" para escribirla.
 */
export const SubjectSelector = ({ educationalLevel, selectedSubjects, onChange, readOnly = false }: SubjectSelectorProps) => {
    const [catalog, setCatalog] = useState<CatalogSubject[]>([])
    const [loading, setLoading] = useState(false)
    const [query, setQuery] = useState('')
    const [addingOther, setAddingOther] = useState(false)
    // Especialidad ya elegida: se muestra en una línea con "Cambiar" para no ocupar la pantalla
    const [editingDetail, setEditingDetail] = useState<Record<string, boolean>>({})

    useEffect(() => {
        let alive = true
        const fetchSubjects = async () => {
            setLoading(true)
            const { data } = await supabase
                .from('subject_catalog')
                .select('id, name, field_of_study, requires_specification')
                .or(`educational_level.eq.${educationalLevel}${educationalLevel === 'TELESECUNDARIA' ? ',educational_level.eq.SECONDARY' : ''},educational_level.eq.BOTH`)
            if (alive) {
                setCatalog((data ?? []) as CatalogSubject[])
                setLoading(false)
            }
        }
        fetchSubjects()
        return () => { alive = false }
    }, [educationalLevel])

    const { options, other } = useMemo(() => buildSubjectOptions(catalog), [catalog])

    const selectedIdOf = (o: SubjectOption) => o.ids.find(id => selectedSubjects[id]?.selected)
    const isSelected = (o: SubjectOption) => !!selectedIdOf(o)
    const detailOf = (o: SubjectOption) => {
        const id = selectedIdOf(o)
        return id ? selectedSubjects[id]?.customDetail || '' : ''
    }

    const setOption = (o: SubjectOption, selected: boolean, customDetail?: string) => {
        if (readOnly) return
        const next = { ...selectedSubjects }
        const currentId = selectedIdOf(o)
        const detail = customDetail ?? (currentId ? next[currentId]?.customDetail : '') ?? ''
        o.ids.forEach(id => { delete next[id] })
        if (selected) next[currentId ?? o.id] = { selected: true, customDetail: detail }
        onChange(next)
    }

    const chosen = [...options, ...(other ? [other] : [])].filter(isSelected)
    const visible = options.filter(o => matchesSearch(o, query))
    const needsDetail = chosen.filter(o => o.requiresSpecification)

    if (loading) {
        return <div className="text-slate-500 text-sm py-6 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando materias…</div>
    }
    if (options.length === 0) {
        return <p className="text-slate-500 text-sm">No hay materias disponibles para este nivel educativo.</p>
    }

    return (
        <div className="space-y-5">
            {/* 1. Lo elegido */}
            <div>
                <p className="text-sm font-black text-slate-800 mb-2">Mis materias {chosen.length > 0 && <span className="text-indigo-600">({chosen.length})</span>}</p>
                {chosen.length === 0 ? (
                    <p className="text-sm text-slate-500 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl px-4 py-3">
                        Aún no eliges ninguna. Toca abajo las materias que das.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {chosen.map(o => (
                            <span key={o.key} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-indigo-600 text-white text-sm font-bold">
                                {o.isOther ? (detailOf(o) || 'Otra materia') : formatSubjectName(o.name, detailOf(o))}
                                {!readOnly && (
                                    <button type="button" onClick={() => setOption(o, false)} aria-label={`Quitar ${o.name}`}
                                        className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Especialidad de Tecnología / cuál lengua, etc. */}
            {needsDetail.map(o => (
                <div key={`detail-${o.key}`} className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4">
                    {o.isTechnology && detailOf(o).trim() && !editingDetail[o.key] ? (
                        <p className="text-sm text-slate-700 flex flex-wrap items-center gap-2">
                            <span>Especialidad de Tecnología: <b>{detailOf(o)}</b></span>
                            {!readOnly && (
                                <button type="button" onClick={() => setEditingDetail(d => ({ ...d, [o.key]: true }))}
                                    className="font-bold text-amber-800 underline">Cambiar</button>
                            )}
                        </p>
                    ) : o.isTechnology ? (
                        <>
                            <p className="text-sm font-black text-slate-800">¿Qué especialidad de Tecnología das?</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {TOP_SPECIALTIES.map(sp => {
                                    const active = normalizeText(detailOf(o)) === normalizeText(sp)
                                    return (
                                        <button key={sp} type="button" disabled={readOnly} onClick={() => { setOption(o, true, sp); setEditingDetail(d => ({ ...d, [o.key]: false })) }}
                                            className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-colors ${active ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-amber-200 text-slate-700 hover:border-amber-400'}`}>
                                            {sp}
                                        </button>
                                    )
                                })}
                            </div>
                            <input
                                type="text"
                                list="tech-specialties"
                                disabled={readOnly}
                                value={TOP_SPECIALTIES.some(sp => normalizeText(sp) === normalizeText(detailOf(o))) ? '' : detailOf(o)}
                                onChange={e => { setEditingDetail(d => ({ ...d, [o.key]: true })); setOption(o, true, e.target.value) }}
                                onBlur={() => setEditingDetail(d => ({ ...d, [o.key]: false }))}
                                placeholder="¿Otra? Escríbela aquí (ej. Apicultura)"
                                aria-label="Otra especialidad de Tecnología"
                                className="mt-3 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2.5 text-sm font-bold focus:border-amber-400 focus:outline-none"
                            />
                        </>
                    ) : o.isOther ? (
                        <label className="block">
                            <span className="text-sm font-black text-slate-800">Escribe el nombre de tu materia o actividad</span>
                            <input type="text" disabled={readOnly} value={detailOf(o)} autoFocus={addingOther}
                                onChange={e => setOption(o, true, e.target.value)}
                                placeholder="Ej. Club de lectura, Robótica, Taller de danza"
                                className="mt-2 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2.5 text-sm font-bold focus:border-amber-400 focus:outline-none" />
                        </label>
                    ) : (
                        <label className="block">
                            <span className="text-sm font-black text-slate-800">{o.name}: ¿cuál?</span>
                            <input type="text" disabled={readOnly} value={detailOf(o)}
                                onChange={e => setOption(o, true, e.target.value)}
                                placeholder="Ej. Tseltal, Tsotsil, Chol"
                                className="mt-2 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2.5 text-sm font-bold focus:border-amber-400 focus:outline-none" />
                        </label>
                    )}
                </div>
            ))}

            {/* 2. Buscador */}
            {!readOnly && (
                <div className="relative">
                    <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Escribe tu materia (ej. Biología)"
                        aria-label="Buscar materia"
                        className="w-full rounded-2xl border-2 border-slate-200 bg-white pl-10 pr-3 py-3 text-base font-medium focus:border-indigo-400 focus:outline-none"
                    />
                </div>
            )}

            {/* 3. Todas las materias como botones */}
            <div>
                {!readOnly && <p className="text-xs font-bold text-slate-500 mb-2">Toca las que das (puedes elegir varias):</p>}
                {visible.length === 0 ? (
                    <div className="text-sm text-slate-600 bg-slate-50 rounded-2xl p-4">
                        No encontramos “{query}”.
                        {other && !readOnly && (
                            <button type="button" onClick={() => { setOption(other, true, query.trim()); setAddingOther(true); setQuery('') }}
                                className="ml-1 font-bold text-indigo-700 underline">Agregarla como otra materia</button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {visible.map(o => {
                            const on = isSelected(o)
                            return (
                                <button
                                    key={o.key}
                                    type="button"
                                    disabled={readOnly}
                                    aria-pressed={on}
                                    onClick={() => setOption(o, !on)}
                                    className={`text-left rounded-2xl border-2 px-3 py-2.5 min-h-[3.5rem] transition-all flex items-start gap-2 ${on ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
                                >
                                    <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                        {on && <Check className="w-3.5 h-3.5" />}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-bold text-slate-900 leading-tight">{o.name}</span>
                                        <span className="block text-[11px] text-slate-500 mt-0.5 leading-tight">{shortField(o.field)}</span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* 4. Al final: lo que no está en la lista */}
            {other && !readOnly && !isSelected(other) && (
                <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                    <p className="text-sm text-slate-600">¿No está tu materia?</p>
                    <button type="button" onClick={() => { setOption(other, true, ''); setAddingOther(true) }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-700 self-start">
                        <Plus className="w-4 h-4" /> Agregar otra materia
                    </button>
                </div>
            )}

            <datalist id="tech-specialties">
                {TECH_SPECIALTIES.map(t => <option key={t} value={t} />)}
            </datalist>
        </div>
    )
}
