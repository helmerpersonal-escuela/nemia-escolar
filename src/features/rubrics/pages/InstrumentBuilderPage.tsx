import { useEffect, useMemo, useState } from 'react'
import { WizardAlert, WizardField, WizardFooter, WizardLayout, WizardStepHeader, wizardInput } from '../../../components/wizard/Wizard'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
    CheckSquare, List, FileText, HelpCircle,
    Search, MessageSquare, Clock, Users, Database,
    Brain, Wand2, ArrowLeft, Check
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { aiGenerate } from '../../../lib/aiClient'
import { CAMPOS_FORMATIVOS, useCatalog } from '../../../lib/nemCatalog'
import { useOfficialPdas } from '../../pdas/components/OfficialPdasSection'
import { fillFormat, useFormats } from '../../../lib/formats'

const INSTRUMENT_TYPES = [
    { id: 'ANALYTIC', title: 'Rúbrica Analítica', icon: Database, description: 'Matriz detallada con criterios y niveles de desempeño.' },
    { id: 'CHECKLIST', title: 'Lista de Cotejo', icon: CheckSquare, description: 'Lista de verificación de sí/no para requisitos.' },
    { id: 'QUIZ', title: 'Cuestionario', icon: HelpCircle, description: 'Preguntas abiertas o cerradas para evaluar conocimientos.' },
    { id: 'OBSERVATION', title: 'Hoja de Observación', icon: Search, description: 'Registro de comportamientos o habilidades en tiempo real.' },
    { id: 'JOURNAL', title: 'Diario Reflexivo', icon: FileText, description: 'Prompts para que el alumno reflexione sobre su aprendizaje.' },
    { id: 'TEST', title: 'Prueba Corta', icon: Clock, description: 'Evaluación rápida con preguntas de opción múltiple.' },
    { id: 'INTERVIEW', title: 'Guía de Entrevista', icon: MessageSquare, description: 'Preguntas estructuradas para diálogo 1 a 1.' },
    { id: 'PORTFOLIO', title: 'Portafolio', icon: List, description: 'Colección organizada de evidencias de aprendizaje.' },
    { id: 'MAP', title: 'Mapa Conceptual', icon: Database, description: 'Estructura para organizar conceptos visualmente.' },
    { id: 'SELF_ASSESSMENT', title: 'Autoevaluación', icon: Users, description: 'Escala para que el alumno juzgue su propio trabajo.' },
]

/** Estructura que se pide a la IA según el tipo de instrumento (la misma que dibuja el visor). */
const SHAPES: Record<string, string> = {
    ANALYTIC: '{"criteria":[{"title":"...","weight":25,"levels":[{"title":"Destacado","score":4,"descriptor":"..."},{"title":"Satisfactorio","score":3,"descriptor":"..."},{"title":"En proceso","score":2,"descriptor":"..."},{"title":"Requiere apoyo","score":1,"descriptor":"..."}]}]}',
    CHECKLIST: '{"items":[{"text":"indicador observable"}]}',
    OBSERVATION: '{"items":[{"text":"conducta o habilidad a observar"}]}',
    SELF_ASSESSMENT: '{"items":[{"text":"afirmación en primera persona"}],"scale":["Siempre","A veces","Aún no"]}',
    QUIZ: '{"questions":[{"text":"...","type":"OPEN"}]}',
    TEST: '{"questions":[{"text":"...","type":"MULTIPLE","options":["a","b","c","d"],"answer":0}]}',
    INTERVIEW: '{"questions":[{"text":"...","type":"OPEN"}]}',
    JOURNAL: '{"questions":[{"text":"pregunta de reflexión","type":"OPEN"}]}',
    PORTFOLIO: '{"items":[{"text":"evidencia a integrar y criterio"}]}',
    MAP: '{"items":[{"text":"concepto clave o relación esperada"}]}',
}

export const InstrumentBuilderPage = () => {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const [step, setStep] = useState(1)
    const [selectedType, setSelectedType] = useState<any>(null)
    const [topic, setTopic] = useState('')
    const [campo, setCampo] = useState<string>(CAMPOS_FORMATIVOS[0])
    const [grade, setGrade] = useState<number | ''>('')
    const [pdaIds, setPdaIds] = useState<string[]>([])
    const [pdaSearch, setPdaSearch] = useState('')
    const [ejes, setEjes] = useState<string[]>([])
    const [metodologia, setMetodologia] = useState('')
    const [formatId, setFormatId] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const ejesList = useCatalog('EJE')
    const metodologias = useCatalog('METODOLOGIA', campo)
    const { data: formats = [] } = useFormats('INSTRUMENTO')
    useEffect(() => { const d = formats.find(f => f.is_default); if (d) setFormatId(prev => prev || d.id) }, [formats])
    const { rows: officialPdas } = useOfficialPdas({ campo })
    const { data: customPdas = [] } = useQuery({
        queryKey: ['custom-pdas', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => ((await supabase.from('custom_pdas').select('id, field_of_study, subject_name, grade, content, pda').eq('tenant_id', tenant!.id)).data ?? []) as any[],
    })

    const pdaOptions = useMemo(() => {
        const t = pdaSearch.trim().toLowerCase()
        const all = [
            ...officialPdas.map(p => ({ id: `o:${p.id}`, label: p.pda, content: p.content, grade: p.grade, tag: p.subject_name ?? 'Oficial' })),
            ...customPdas.filter(p => p.field_of_study === campo).map(p => ({ id: `c:${p.id}`, label: p.pda, content: p.content, grade: p.grade, tag: 'Propio' })),
        ]
        return all.filter(p => (grade === '' || !p.grade || p.grade === grade) && (!t || `${p.label} ${p.content}`.toLowerCase().includes(t))).slice(0, 60)
    }, [officialPdas, customPdas, campo, grade, pdaSearch])
    const selectedPdas = [...officialPdas.map(p => ({ id: `o:${p.id}`, text: p.pda, content: p.content })), ...customPdas.map(p => ({ id: `c:${p.id}`, text: p.pda, content: p.content }))].filter(p => pdaIds.includes(p.id))

    const toggle = (list: string[], v: string, set: (x: string[]) => void) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])

    const generateInstrument = async () => {
        if (!topic.trim() || !tenant) return
        setIsGenerating(true)
        setError(null)
        const meta = { campo, grade: grade || null, pdas: selectedPdas.map(p => p.text), contenidos: [...new Set(selectedPdas.map(p => p.content))], ejes, metodologia: metodologia || null }
        let content: any
        try {
            const prompt = `Diseña un instrumento de evaluación formativa tipo "${selectedType.title}" para ${tenant.educationalLevel === 'PRIMARY' ? 'primaria' : 'secundaria'}${grade ? `, ${grade}° grado` : ''}, de acuerdo con la Nueva Escuela Mexicana.
Tema o actividad: ${topic}
Campo formativo: ${campo}
${meta.contenidos.length ? `Contenidos: ${meta.contenidos.join('; ')}\n` : ''}${meta.pdas.length ? `Procesos de desarrollo de aprendizaje (PDA) que debe evaluar: ${meta.pdas.join(' | ')}\n` : ''}${ejes.length ? `Ejes articuladores a considerar: ${ejes.join(', ')}\n` : ''}${metodologia ? `Metodología: ${metodologia}\n` : ''}Los criterios o reactivos deben ser observables, redactados para el alumno o el docente según corresponda y alineados a los PDA.
Devuelve SOLO JSON con esta forma: ${SHAPES[selectedType.id] ?? SHAPES.CHECKLIST}`
            const raw = await aiGenerate(prompt, true)
            content = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
            const fmt = formats.find(f => f.id === formatId)
            if (fmt) {
                content.format = { id: fmt.id, spec: fmt.spec, filled: await fillFormat(fmt.spec, `Instrumento: ${selectedType.title}\nTema: ${topic}\n${JSON.stringify(meta)}\nContenido generado: ${JSON.stringify(content)}`, { escuela: tenant.name ?? '', cct: tenant.cct ?? '', campo, grado: grade ? `${grade}°` : '' }) }
            }
        } catch (e: any) {
            setIsGenerating(false)
            setError(`No se pudo generar con IA: ${e?.message || 'intenta de nuevo'}`)
            return
        }
        content.meta = meta
        const { data, error: insErr } = await supabase.from('rubrics').insert({
            tenant_id: tenant.id,
            title: `${selectedType.title}: ${topic}`,
            description: [campo, ...ejes].join(' · '),
            type: selectedType.id,
            content,
            is_ai_generated: true,
            original_prompt: topic,
        }).select('id').single()
        setIsGenerating(false)
        if (insErr || !data) { setError('No se pudo guardar el instrumento'); return }
        navigate(`/rubrics/ver/${data.id}`)
    }

    const chip = (on: boolean) => `px-3 py-2 rounded-xl text-xs font-bold border-2 transition ${on ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-600'}`

    return (
        <WizardLayout
            eyebrow="Banco de instrumentos"
            title={step === 1 ? 'Nuevo instrumento de evaluación' : `Crear ${selectedType.title.toLowerCase()}`}
            subtitle={step === 1 ? 'Rúbricas, listas de cotejo, exámenes y más.' : 'Elige los PDA, ejes y metodología; la IA arma el instrumento y lo puedes imprimir con tu formato.'}
            steps={[{ label: 'Tipo de instrumento' }, { label: 'Qué evaluar' }]}
            current={step - 1}
            onStepClick={i => setStep(i + 1)}
            width="lg"
            headerAction={<button onClick={() => navigate('/rubrics')} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100"><ArrowLeft className="w-4 h-4" /> Volver</button>}
            footer={step === 2 ? (
                <WizardFooter onBack={() => setStep(1)} onNext={generateInstrument} nextDisabled={!topic.trim()} loading={isGenerating}
                    nextLabel={isGenerating ? 'Generando…' : 'Generar con IA'} nextIcon={isGenerating ? Brain : Wand2} />
            ) : undefined}
        >
            {step === 1 && (
                <>
                    <WizardStepHeader title="¿Qué quieres crear?" description="Elige el tipo de instrumento." />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {INSTRUMENT_TYPES.map(type => (
                            <button key={type.id} onClick={() => { setSelectedType(type); setStep(2) }} className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-indigo-300 transition text-left flex flex-col group h-full">
                                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3"><type.icon className="w-5 h-5" /></div>
                                <h3 className="font-black text-slate-900 mb-1">{type.title}</h3>
                                <p className="text-sm text-slate-500">{type.description}</p>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {step === 2 && (
                <div className="space-y-5">
                    <WizardStepHeader icon={selectedType.icon} title="Qué vas a evaluar" description="Solo el tema es obligatorio; lo demás hace el instrumento más preciso." />
                    {error && <WizardAlert>{error}</WizardAlert>}
                    <WizardField label="Tema o actividad" required>
                        <input aria-label="Tema o Actividad" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej. La Revolución Mexicana, ecuaciones de segundo grado…" className={wizardInput} autoFocus />
                    </WizardField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <WizardField label="Campo formativo">
                            <select value={campo} onChange={e => { setCampo(e.target.value); setPdaIds([]); setMetodologia('') }} className={wizardInput}>{CAMPOS_FORMATIVOS.map(c => <option key={c}>{c}</option>)}</select>
                        </WizardField>
                        <WizardField label="Grado">
                            <select value={grade} onChange={e => setGrade(e.target.value === '' ? '' : Number(e.target.value))} className={wizardInput}>
                                <option value="">Cualquiera</option>
                                {(tenant?.educationalLevel === 'PRIMARY' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]).map(g => <option key={g} value={g}>{g}°</option>)}
                            </select>
                        </WizardField>
                    </div>

                    <div>
                        <span className="block text-xs font-black text-slate-600 mb-1.5">PDA a evaluar ({pdaIds.length})</span>
                        <input value={pdaSearch} onChange={e => setPdaSearch(e.target.value)} placeholder="Buscar PDA oficial o propio…" aria-label="Buscar PDA" className={`${wizardInput} mb-2`} />
                        <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-2xl border border-slate-100 p-2 bg-slate-50">
                            {pdaOptions.length === 0 && <p className="text-xs text-slate-500 p-2">Sin PDA para este campo. Puedes crear los tuyos en “PDAs, ejes y metodologías”.</p>}
                            {pdaOptions.map(p => {
                                const on = pdaIds.includes(p.id)
                                return (
                                    <button key={p.id} type="button" onClick={() => toggle(pdaIds, p.id, setPdaIds)} className={`w-full text-left rounded-xl p-2.5 border-2 ${on ? 'border-indigo-500 bg-white' : 'border-transparent bg-white/60'}`}>
                                        <span className="text-[10px] font-black uppercase text-indigo-600">{p.tag}{p.grade ? ` · ${p.grade}°` : ''}</span>
                                        <span className="flex items-start gap-2 text-xs text-slate-700">{on && <Check className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />}{p.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div>
                        <span className="block text-xs font-black text-slate-600 mb-1.5">Ejes articuladores</span>
                        <div className="flex flex-wrap gap-2">
                            {ejesList.map(e => <button key={e.id} type="button" onClick={() => toggle(ejes, e.name, setEjes)} className={chip(ejes.includes(e.name))}>{e.name}{!e.official ? ' ★' : ''}</button>)}
                        </div>
                    </div>

                    <WizardField label="Metodología (opcional)">
                        <select value={metodologia} onChange={e => setMetodologia(e.target.value)} className={wizardInput}>
                            <option value="">Sin metodología específica</option>
                            {metodologias.map(m => <option key={m.id} value={m.name}>{m.name}{m.official && m.field_of_study === campo ? ' (sugerida para este campo)' : ''}</option>)}
                        </select>
                    </WizardField>

                    <WizardField label="Formato" hint={formats.length ? undefined : 'Sube el formato de tu escuela en “Mis formatos” para que salga igual.'}>
                        <select value={formatId} onChange={e => setFormatId(e.target.value)} className={wizardInput}>
                            <option value="">Formato VUNLEK</option>
                            {formats.map(f => <option key={f.id} value={f.id}>{f.name}{f.is_default ? ' (predeterminado)' : ''}</option>)}
                        </select>
                    </WizardField>
                </div>
            )}
        </WizardLayout>
    )
}
