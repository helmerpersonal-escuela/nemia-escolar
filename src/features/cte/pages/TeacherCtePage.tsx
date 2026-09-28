import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, ExternalLink, FileText, ListChecks, Loader2, Plus, Printer, Sparkles, Trash2, Upload } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { useToast } from '../../../components/ui/Toast'
import { aiGenerate } from '../../../lib/aiClient'
import { printFormat } from '../../../components/formats/FormatDocument'
import { CTE_PORTAL_URL, currentSchoolYear, pickNextSession, sessionLabel, todayISO, type CteAgreement, type CteDocument, type CteSession } from '../lib/cteApi'
import { extractFileText } from '../lib/docText'

type TaskStatus = 'PENDIENTE' | 'EN_PROCESO' | 'CUMPLIDO'
interface Task { id: string, session_id: string, kind: 'TAREA' | 'COMPROMISO', description: string, due_date: string | null, status: TaskStatus, follow_up: string | null }
interface Material {
    resumen?: string
    por_tema?: { tema: string, ideas_clave?: string[], como_aplica?: string, actividades?: string[], preguntas?: string[], evidencias?: string[] }[]
    datos_para_compartir?: string[]
    compromisos_sugeridos?: string[]
}
interface Work { id?: string, topics: string[], available_topics: string[], material: Material | null, notes: string | null }

const STATUS: Record<TaskStatus, string> = { PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', CUMPLIDO: 'Cumplido' }
const clip = (s: string, n: number) => s.length > n ? s.slice(0, n) + ' […]' : s

/** CTE del docente: orientaciones de la sesión, temas, material de apoyo con IA y seguimiento de compromisos. */
export const TeacherCtePage = ({ canUpload = false }: { canUpload?: boolean }) => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const { showToast } = useToast()
    const qc = useQueryClient()
    const tenantId = tenant?.id
    const schoolYear = currentSchoolYear()
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [work, setWork] = useState<Work>({ topics: [], available_topics: [], material: null, notes: null })
    const [busy, setBusy] = useState<string | null>(null)
    const [customTopic, setCustomTopic] = useState('')
    const [newTask, setNewTask] = useState({ description: '', due_date: '', kind: 'TAREA' as 'TAREA' | 'COMPROMISO' })

    const { data: sessions = [] } = useQuery({
        queryKey: ['cte-sessions', tenantId, schoolYear],
        enabled: !!tenantId,
        queryFn: async () => {
            const load = () => supabase.from('cte_sessions').select('*').eq('tenant_id', tenantId!).eq('school_year', schoolYear).order('date')
            let { data } = await load()
            if (!data?.length) { await supabase.rpc('cte_ensure_sessions', { p_tenant: tenantId, p_school_year: schoolYear }); data = (await load()).data }
            return (data ?? []) as CteSession[]
        },
    })
    useEffect(() => { if (!sessionId && sessions.length) setSessionId(pickNextSession(sessions, todayISO())?.id ?? sessions[0].id) }, [sessions, sessionId])
    const session = sessions.find(s => s.id === sessionId)

    const { data: docs = [] } = useQuery({
        queryKey: ['cte-docs', tenantId, sessionId],
        enabled: !!tenantId && !!sessionId,
        queryFn: async () => ((await supabase.from('cte_documents').select('*').eq('tenant_id', tenantId!).or(`session_id.eq.${sessionId},session_id.is.null`).order('created_at', { ascending: false })).data ?? []) as CteDocument[],
    })
    const guides = docs.filter(d => d.session_id === sessionId || d.kind === 'GUIA_OFICIAL')

    const loadWork = useCallback(async () => {
        if (!sessionId || !profile?.id) return
        const { data } = await supabase.from('cte_teacher_work').select('*').eq('session_id', sessionId).eq('profile_id', profile.id).maybeSingle()
        setWork(data ? { id: data.id, topics: data.topics ?? [], available_topics: data.available_topics ?? [], material: data.material, notes: data.notes } : { topics: [], available_topics: [], material: null, notes: null })
    }, [sessionId, profile?.id])
    useEffect(() => { loadWork() }, [loadWork])

    const saveWork = async (patch: Partial<Work>) => {
        if (!tenantId || !sessionId) return
        const next = { ...work, ...patch }
        setWork(next)
        const { data, error } = await supabase.from('cte_teacher_work').upsert({
            tenant_id: tenantId, session_id: sessionId, topics: next.topics, available_topics: next.available_topics,
            material: next.material, notes: next.notes, updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id,profile_id' }).select('id').single()
        if (error) showToast('No se pudo guardar', 'error')
        else if (!next.id) setWork(w => ({ ...w, id: data.id }))
    }

    const { data: tasks = [] } = useQuery({
        queryKey: ['cte-tasks', profile?.id],
        enabled: !!profile?.id,
        queryFn: async () => ((await supabase.from('cte_teacher_tasks').select('*').eq('profile_id', profile!.id).order('created_at')).data ?? []) as Task[],
    })
    const { data: agreements = [] } = useQuery({
        queryKey: ['cte-my-agreements', profile?.id, tenantId],
        enabled: !!profile?.id && !!tenantId,
        queryFn: async () => ((await supabase.from('cte_agreements').select('*').eq('tenant_id', tenantId!).eq('responsible_profile_id', profile!.id).order('due_date')).data ?? []) as CteAgreement[],
    })
    const refreshTasks = () => { qc.invalidateQueries({ queryKey: ['cte-tasks'] }); qc.invalidateQueries({ queryKey: ['cte-my-agreements'] }) }

    const guideText = useMemo(() => [
        ...guides.map(d => `### ${d.title}\n${d.extracted_text ?? ''}`),
        work.notes ? `### Orientaciones pegadas por el docente\n${work.notes}` : '',
    ].filter(Boolean).join('\n\n'), [guides, work.notes])
    const agendaTopics = (session?.agenda ?? []).map(a => a.topic).filter(Boolean)
    const allTopics = [...new Set([...agendaTopics, ...work.available_topics])]

    const identifyTopics = async () => {
        if (guideText.trim().length < 200) { showToast('Primero sube o pega las orientaciones de la sesión', 'warning'); return }
        setBusy('Leyendo las orientaciones…')
        try {
            const raw = await aiGenerate(`De las siguientes "Orientaciones para la Sesión Ordinaria del Consejo Técnico Escolar" (SEP) enlista los TEMAS o actividades que se trabajarán, con el nombre que les da la guía, en orden. Máximo 12.
Devuelve SOLO JSON: {"temas":["..."]}

${clip(guideText, 40000)}`, true)
            const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
            const temas = (parsed.temas ?? []).map(String).filter(Boolean).slice(0, 12)
            await saveWork({ available_topics: temas })
        } catch (e: any) { showToast(e?.message || 'No se pudieron identificar los temas', 'error') }
        finally { setBusy(null) }
    }

    const generateMaterial = async () => {
        const topics = work.topics.length ? work.topics : allTopics
        if (!topics.length) { showToast('Elige al menos un tema', 'warning'); return }
        setBusy('Preparando tu material de apoyo…')
        try {
            const { data: snapshot } = await supabase.rpc('my_teaching_snapshot', { p_days: 60 })
            const raw = await aiGenerate(`Eres asesor pedagógico de la Nueva Escuela Mexicana. Prepara MATERIAL DE APOYO para que un docente participe en la sesión del Consejo Técnico Escolar "${session ? sessionLabel(session) : ''}".
Temas elegidos por el docente: ${topics.join(' | ')}
Contexto del docente: ${tenant?.educationalLevel === 'PRIMARY' ? 'primaria' : 'secundaria'}; ${tenant?.type === 'INDEPENDENT' ? 'trabaja de forma independiente' : `escuela ${tenant?.name ?? ''}`}.
Seguimiento de sus alumnos (cifras agregadas, sin nombres): ${JSON.stringify(snapshot ?? {})}
Usa esos datos para aterrizar cada tema a sus grupos (no inventes cifras). Sé práctico y breve.
${guideText ? `Orientaciones oficiales (extracto):\n${clip(guideText, 30000)}\n` : ''}
Devuelve SOLO JSON: {"resumen":"...","por_tema":[{"tema":"...","ideas_clave":["..."],"como_aplica":"cómo se relaciona con mis grupos y sus datos","actividades":["qué hacer en la sesión"],"preguntas":["preguntas para reflexionar con el colectivo"],"evidencias":["qué llevar a la sesión"]}],"datos_para_compartir":["dato de mis grupos útil para el colectivo"],"compromisos_sugeridos":["compromiso concreto y medible"]}`, true)
            const material = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Material
            await saveWork({ material, topics })
        } catch (e: any) { showToast(e?.message || 'No se pudo generar el material', 'error') }
        finally { setBusy(null) }
    }

    const uploadGuide = async (file: File) => {
        if (!tenantId) return
        setBusy('Guardando orientaciones…')
        try {
            const text = await extractFileText(file).catch(() => '')
            const path = `${tenantId}/${crypto.randomUUID()}-${file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)}`
            const { error: upErr } = await supabase.storage.from('cte_documents').upload(path, file, { contentType: file.type || undefined })
            if (upErr) throw upErr
            const { error } = await supabase.from('cte_documents').insert({ tenant_id: tenantId, session_id: sessionId, kind: 'GUIA_OFICIAL', title: file.name.replace(/\.[^.]+$/, ''), storage_path: path, mime_type: file.type || null, size_bytes: file.size, extracted_text: text || null })
            if (error) throw error
            qc.invalidateQueries({ queryKey: ['cte-docs'] })
        } catch { showToast('No se pudo subir el archivo', 'error') }
        finally { setBusy(null) }
    }

    const openDoc = async (d: CteDocument) => {
        if (!d.storage_path) return
        const { data } = await supabase.storage.from('cte_documents').createSignedUrl(d.storage_path, 300)
        if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
    }

    const addTask = async (description: string, kind: 'TAREA' | 'COMPROMISO', due?: string) => {
        if (!tenantId || !sessionId || description.trim().length < 2) return
        const { error } = await supabase.from('cte_teacher_tasks').insert({ tenant_id: tenantId, session_id: sessionId, kind, description: description.trim(), due_date: due || null })
        if (error) showToast('No se pudo agregar', 'error')
        refreshTasks()
    }
    const updateTask = async (t: Task, patch: Partial<Task>) => { await supabase.from('cte_teacher_tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', t.id); refreshTasks() }
    const deleteTask = async (t: Task) => { if (window.confirm('¿Eliminar?')) { await supabase.from('cte_teacher_tasks').delete().eq('id', t.id); refreshTasks() } }
    const updateAgreement = async (a: CteAgreement, status: string, follow: string) => {
        const { error } = await supabase.rpc('cte_update_my_agreement', { p_id: a.id, p_status: status, p_follow_up: follow })
        if (error) showToast('No se pudo actualizar', 'error')
        refreshTasks()
    }

    const sessionTasks = tasks.filter(t => t.session_id === sessionId)
    const pendingOthers = tasks.filter(t => t.session_id !== sessionId && t.status !== 'CUMPLIDO')
    const sessionName = (id: string) => { const s = sessions.find(x => x.id === id); return s ? sessionLabel(s) : '' }
    const card = 'bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 space-y-4'

    if (!tenantId) return null

    return (
        <div className="max-w-5xl mx-auto px-3 sm:px-0 pb-20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Consejo Técnico Escolar · {schoolYear}</p>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Mi CTE</h1>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">Consulta las orientaciones de cada sesión, elige los temas que trabajarás y recibe material de apoyo con los datos de tus grupos. Da seguimiento a tus compromisos.</p>
                </div>
                <div className="flex gap-2">
                    <select aria-label="Sesión" value={sessionId ?? ''} onChange={e => setSessionId(e.target.value)} className="min-h-11 px-3 rounded-xl bg-white border border-slate-200 text-sm font-bold max-w-[16rem]">
                        {sessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)} · {new Date(s.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</option>)}
                    </select>
                    <a href={CTE_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center gap-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold"><ExternalLink className="w-4 h-4" /> Portal SEP</a>
                </div>
            </div>

            {busy && <div className="flex items-center gap-3 bg-indigo-50 text-indigo-800 rounded-2xl p-4 text-sm font-bold"><Loader2 className="w-5 h-5 animate-spin" /> {busy}</div>}

            {/* 1. Orientaciones */}
            <section className={card}>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-600" /> Orientaciones de la sesión</h2>
                {guides.length ? (
                    <ul className="space-y-2">
                        {guides.map(d => (
                            <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="text-sm font-bold text-slate-800 flex-1 truncate">{d.title}</span>
                                {d.storage_path && <button onClick={() => openDoc(d)} className="text-xs font-black text-indigo-600">Abrir</button>}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-slate-500">{canUpload ? 'Sube las orientaciones que publica la SEP para esta sesión (PDF o Word).' : 'La dirección aún no sube las orientaciones de esta sesión. Descárgalas del portal de la SEP y pega aquí su texto, o espera a que se publiquen.'}</p>
                )}
                <div className="flex flex-wrap gap-2">
                    {canUpload && (
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black cursor-pointer">
                            <Upload className="w-4 h-4" /> Subir orientaciones
                            <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadGuide(f) }} />
                        </label>
                    )}
                </div>
                <details className="text-sm">
                    <summary className="cursor-pointer font-bold text-slate-600">Pegar texto de las orientaciones</summary>
                    <textarea defaultValue={work.notes ?? ''} key={sessionId ?? ''} onBlur={e => e.target.value !== (work.notes ?? '') && saveWork({ notes: e.target.value.slice(0, 100000) })} rows={6} className="mt-2 w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm" placeholder="Copia y pega aquí el texto de la guía de la sesión" aria-label="Texto de las orientaciones" />
                </details>
            </section>

            {/* 2. Temas */}
            <section className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><ListChecks className="w-5 h-5 text-indigo-600" /> Temas que trabajaré</h2>
                    <button onClick={identifyTopics} disabled={!!busy} className="text-xs font-black text-indigo-600 px-3 py-2 rounded-xl hover:bg-indigo-50">Identificar temas de la guía</button>
                </div>
                {allTopics.length === 0 ? <p className="text-sm text-slate-500">Aún no hay temas. Identifícalos de la guía o agrega el tuyo.</p> : (
                    <>
                        <button onClick={() => saveWork({ topics: work.topics.length === allTopics.length ? [] : allTopics })} className="text-xs font-bold text-slate-600 underline">{work.topics.length === allTopics.length ? 'Quitar todos' : 'Elegir todos los temas'}</button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {allTopics.map(t => {
                                const on = work.topics.includes(t)
                                return (
                                    <button key={t} onClick={() => saveWork({ topics: on ? work.topics.filter(x => x !== t) : [...work.topics, t] })} className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm font-bold ${on ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-100 text-slate-600'}`}>
                                        {on && <CheckCircle2 className="w-4 h-4 inline mr-1 -mt-0.5" />}{t}
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}
                <div className="flex gap-2">
                    <input value={customTopic} onChange={e => setCustomTopic(e.target.value)} placeholder="Agregar un tema propio" aria-label="Tema propio" className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
                    <button onClick={() => { if (customTopic.trim()) { saveWork({ available_topics: [...work.available_topics, customTopic.trim()], topics: [...work.topics, customTopic.trim()] }); setCustomTopic('') } }} className="px-4 rounded-xl bg-slate-900 text-white text-sm font-black"><Plus className="w-4 h-4" /></button>
                </div>
            </section>

            {/* 3. Material */}
            <section className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" /> Mi material de apoyo</h2>
                    <div className="flex gap-2">
                        {work.material && <button onClick={() => printFormat('cte-material', `CTE ${session ? sessionLabel(session) : ''}`)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"><Printer className="w-4 h-4" /> Imprimir</button>}
                        <button onClick={generateMaterial} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-black disabled:opacity-60"><Sparkles className="w-4 h-4" /> {work.material ? 'Volver a generar' : 'Generar material'}</button>
                    </div>
                </div>
                {!work.material ? <p className="text-sm text-slate-500">La IA toma las orientaciones, los temas que elegiste y el seguimiento de tus grupos (asistencia, conducta y calificaciones, sin nombres) para prepararte ideas clave, actividades, preguntas y evidencias.</p> : (
                    <div id="cte-material" className="space-y-4 text-sm text-slate-700">
                        {work.material.resumen && <p className="font-bold text-slate-800">{work.material.resumen}</p>}
                        {(work.material.por_tema ?? []).map((t, i) => (
                            <article key={i} className="rounded-2xl border border-slate-100 p-4 space-y-2 break-inside-avoid">
                                <h3 className="font-black text-slate-900">{t.tema}</h3>
                                {t.como_aplica && <p className="text-indigo-800 bg-indigo-50 rounded-xl p-2.5">{t.como_aplica}</p>}
                                {[['Ideas clave', t.ideas_clave], ['Actividades para la sesión', t.actividades], ['Preguntas para reflexionar', t.preguntas], ['Evidencias a llevar', t.evidencias]].map(([l, arr]) => (arr as string[] | undefined)?.length ? (
                                    <div key={l as string}><p className="text-xs font-black uppercase text-slate-500">{l as string}</p><ul className="list-disc pl-5">{(arr as string[]).map((x, j) => <li key={j}>{x}</li>)}</ul></div>
                                ) : null)}
                            </article>
                        ))}
                        {!!work.material.datos_para_compartir?.length && <div><p className="text-xs font-black uppercase text-slate-500">Datos de mis grupos para compartir</p><ul className="list-disc pl-5">{work.material.datos_para_compartir.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                        {!!work.material.compromisos_sugeridos?.length && (
                            <div>
                                <p className="text-xs font-black uppercase text-slate-500">Compromisos sugeridos</p>
                                <ul className="space-y-1.5">{work.material.compromisos_sugeridos.map((x, i) => (
                                    <li key={i} className="flex items-start gap-2"><span className="flex-1">• {x}</span>
                                        <button onClick={() => addTask(x, 'COMPROMISO')} className="shrink-0 text-xs font-black text-indigo-600 no-print">+ Agregar</button></li>
                                ))}</ul>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* 4. Compromisos y tareas */}
            <section className={card}>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Compromisos y tareas</h2>
                {agreements.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-black uppercase text-slate-500">Acuerdos del colectivo a mi cargo</p>
                        {agreements.map(a => <AgreementRow key={a.id} a={a} onSave={updateAgreement} session={a.session_id ? sessionName(a.session_id) : ''} />)}
                    </div>
                )}
                <div className="space-y-2">
                    <p className="text-xs font-black uppercase text-slate-500">De esta sesión</p>
                    {sessionTasks.length === 0 && <p className="text-sm text-slate-500">Sin tareas ni compromisos todavía.</p>}
                    {sessionTasks.map(t => <TaskRow key={t.id} t={t} onUpdate={updateTask} onDelete={deleteTask} />)}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
                        <input value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="Nueva tarea o compromiso" aria-label="Nueva tarea" className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
                        <select aria-label="Tipo" value={newTask.kind} onChange={e => setNewTask({ ...newTask, kind: e.target.value as any })} className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold"><option value="TAREA">Tarea</option><option value="COMPROMISO">Compromiso</option></select>
                        <input type="date" aria-label="Fecha compromiso" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
                        <button onClick={() => { addTask(newTask.description, newTask.kind, newTask.due_date); setNewTask({ description: '', due_date: '', kind: 'TAREA' }) }} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black">Agregar</button>
                    </div>
                </div>
                {pendingOthers.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-black uppercase text-amber-700">Pendientes de sesiones anteriores</p>
                        {pendingOthers.map(t => <TaskRow key={t.id} t={t} onUpdate={updateTask} onDelete={deleteTask} session={sessionName(t.session_id)} />)}
                    </div>
                )}
            </section>
        </div>
    )
}

const TaskRow = ({ t, onUpdate, onDelete, session }: { t: Task, onUpdate: (t: Task, p: Partial<Task>) => void, onDelete: (t: Task) => void, session?: string }) => (
    <div className="rounded-2xl border border-slate-100 p-3 space-y-2">
        <div className="flex items-start gap-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${t.kind === 'COMPROMISO' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{t.kind === 'COMPROMISO' ? 'Compromiso' : 'Tarea'}</span>
            <p className={`text-sm flex-1 ${t.status === 'CUMPLIDO' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.description}</p>
            <button onClick={() => onDelete(t)} aria-label="Eliminar" className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
            <select aria-label="Estado" value={t.status} onChange={e => onUpdate(t, { status: e.target.value as TaskStatus })} className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100 font-bold">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {t.due_date && <span className="text-slate-500">Para el {new Date(t.due_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
            {session && <span className="text-slate-400">· {session}</span>}
            <input defaultValue={t.follow_up ?? ''} onBlur={e => e.target.value !== (t.follow_up ?? '') && onUpdate(t, { follow_up: e.target.value })} placeholder="Avance / evidencia" aria-label="Seguimiento" className="flex-1 min-w-[10rem] px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100" />
        </div>
    </div>
)

const AgreementRow = ({ a, onSave, session }: { a: CteAgreement, onSave: (a: CteAgreement, s: string, f: string) => void, session: string }) => {
    const [follow, setFollow] = useState(a.follow_up ?? '')
    return (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
            <p className="text-sm text-slate-800">{a.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <select aria-label="Estado del acuerdo" value={a.status === 'NO_CUMPLIDO' ? 'PENDIENTE' : a.status} onChange={e => onSave(a, e.target.value, follow)} className="px-2 py-1.5 rounded-lg bg-white border border-slate-100 font-bold">
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {a.due_date && <span className="text-slate-500">Para el {new Date(a.due_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
                {session && <span className="text-slate-400">· {session}</span>}
                <input value={follow} onChange={e => setFollow(e.target.value)} onBlur={() => follow !== (a.follow_up ?? '') && onSave(a, a.status === 'NO_CUMPLIDO' ? 'PENDIENTE' : a.status, follow)} placeholder="Avance / evidencia" aria-label="Seguimiento del acuerdo" className="flex-1 min-w-[10rem] px-2 py-1.5 rounded-lg bg-white border border-slate-100" />
            </div>
        </div>
    )
}
