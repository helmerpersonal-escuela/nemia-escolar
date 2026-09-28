import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Sparkles, Check } from 'lucide-react'
import { aiGenerate } from '../../../../lib/aiClient'
import { toCampo, FIELD_KEY } from '../../../analytical-program/lib/teacherScope'

interface Props {
    analyticalProgram: any
    campo: string
    subjectName?: string
    grade?: string | number
    value: string
    onPick: (title: string) => void
}

/** Contenidos y problemática del programa analítico del campo (y del grado, si se conoce). */
function programSummary(program: any, campo: string, grade?: string | number) {
    const c = toCampo(campo)
    const byFields = program?.program_by_fields || {}
    const items: any[] = (c ? byFields[FIELD_KEY[c]] || byFields[c] : null) || []
    const g = Number(grade) || null
    const contents = items.slice(0, 8).map(it => ({
        content: it.contentName || it.content || '',
        pda: (g && it[`pda_grade_${g}`]) || it.pda_grade_1 || it.pda || '',
        link: it.community_link || '',
        subject: it.subject_name || '',
    })).filter(x => x.content)
    const problems: string[] = (program?.group_diagnosis?.problem_situations || program?.problem_statements || [])
        .map((p: any) => (typeof p === 'string' ? p : p?.description)).filter(Boolean)
    return { contents, problems }
}

/** Títulos de respaldo (sin IA) a partir de los contenidos y la problemática del programa. */
function fallbackTitles(contents: { content: string }[], problems: string[], subject?: string): string[] {
    const prob = problems[0]?.replace(/\.$/, '')
    const out: string[] = []
    for (const c of contents.slice(0, 3)) {
        const base = c.content.split(/[.:;]/)[0].trim()
        out.push(prob ? `${base}: respuestas desde la comunidad a ${prob.charAt(0).toLowerCase()}${prob.slice(1)}` : `${base} en mi comunidad`)
    }
    if (subject && prob) out.push(`${subject} para transformar nuestra comunidad: ${prob.toLowerCase()}`)
    return [...new Set(out)].slice(0, 4)
}

const cacheKey = (programId: string, campo: string, subject: string, grade: string) => `vunlek_titles:${programId}:${campo}:${subject}:${grade}`

/** Propuestas de título del proyecto (al menos 3) basadas en el programa analítico del campo formativo. */
export function TitleSuggestions({ analyticalProgram, campo, subjectName, grade, value, onPick }: Props) {
    const { contents, problems } = useMemo(() => programSummary(analyticalProgram, campo, grade), [analyticalProgram, campo, grade])
    const key = analyticalProgram?.id ? cacheKey(analyticalProgram.id, campo, subjectName || '', String(grade || '')) : ''
    const [titles, setTitles] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    const generate = async (force = false) => {
        if (!analyticalProgram) return
        if (!force && key) {
            try { const cached = JSON.parse(sessionStorage.getItem(key) || 'null'); if (Array.isArray(cached) && cached.length >= 3) { setTitles(cached); return } } catch { /* nada */ }
        }
        const fallback = fallbackTitles(contents, problems, subjectName)
        if (!contents.length) { setTitles(fallback); return }
        setLoading(true)
        try {
            const prompt = `Eres docente experto en la Nueva Escuela Mexicana. Propón 4 títulos distintos para un proyecto didáctico.
Asignatura: ${subjectName || 'la del docente'} (campo formativo: ${campo}). Grado: ${grade ? `${grade}°` : 'no indicado'}.
Problemática de la comunidad: ${problems.join('; ') || 'no registrada'}.
Contenidos del programa analítico de este campo:
${contents.map((c, i) => `${i + 1}. ${c.content}${c.pda ? ` — PDA: ${c.pda}` : ''}${c.link ? ` — Vínculo: ${c.link}` : ''}`).join('\n')}
Reglas: cada título de 5 a 12 palabras, atractivo para estudiantes, en español, que una un contenido de la lista con la problemática; solo de esta asignatura, sin nombrar otras materias ni campos formativos; sin comillas ni numeración.
Responde ÚNICAMENTE JSON: {"titulos":["...","...","...","..."]}`
            const text = await aiGenerate(prompt, true)
            let parsed: any = {}
            try { parsed = JSON.parse(text) } catch { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {} }
            const list = ((parsed.titulos || parsed.titles || []) as any[]).map(t => String(t).replace(/^["'\d.\-\s]+|["']$/g, '').trim()).filter(t => t.length > 3)
            const final = [...new Set([...list, ...fallback])].slice(0, 4)
            setTitles(final)
            if (key && final.length >= 3) sessionStorage.setItem(key, JSON.stringify(final))
        } catch {
            setTitles(fallback)
        } finally {
            setLoading(false)
        }
    }

    // Se proponen solas en cuanto hay programa, materia y campo
    useEffect(() => {
        setTitles([])
        if (analyticalProgram && campo) generate(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analyticalProgram?.id, campo, subjectName, grade])

    if (!analyticalProgram) return null

    return (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-xs font-black text-indigo-900 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-indigo-600" /> Propuestas de título según tu programa analítico</p>
                <button type="button" onClick={() => generate(true)} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-700 hover:bg-white disabled:opacity-40">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Otras propuestas
                </button>
            </div>
            {loading && !titles.length ? (
                <div className="space-y-2" aria-busy="true">
                    {[0, 1, 2].map(i => <div key={i} className="h-11 rounded-xl bg-white/80 animate-pulse" />)}
                </div>
            ) : titles.length === 0 ? (
                <p className="text-xs text-indigo-800">Tu programa analítico aún no tiene contenidos para este campo. Complétalo para recibir propuestas.</p>
            ) : (
                <div role="radiogroup" aria-label="Propuestas de título" className="grid grid-cols-1 gap-2">
                    {titles.map(t => {
                        const active = value.trim() === t
                        return (
                            <button key={t} type="button" role="radio" aria-checked={active} onClick={() => onPick(t)}
                                className={`text-left px-4 py-3 rounded-xl border-2 text-sm font-bold transition flex items-start gap-3 ${active ? 'border-indigo-600 bg-white text-indigo-900' : 'border-transparent bg-white text-slate-700 hover:border-indigo-200'}`}>
                                <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${active ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>{active && <Check className="w-3 h-3 text-white" />}</span>
                                {t}
                            </button>
                        )
                    })}
                </div>
            )}
            <p className="text-xs text-slate-500 mt-2">Elige la que más te acomode o escribe tu propio título.</p>
        </div>
    )
}
