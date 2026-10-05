import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { IdCard, Loader2, Nfc, Keyboard, CheckCircle2, Printer, Radio, Square } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useToast } from '../../../components/ui/Toast'
import { beep, cardQr, cardUrl, listenNfc, nfcSupport, normalizeCode } from '../../../lib/cards'

type Group = { id: string; grade: string; section: string }
type Student = { id: string; first_name: string; last_name_paternal: string; last_name_maternal: string | null }
type Card = { student_id: string; code: string; kind: 'TOKEN' | 'NFC_UID' | 'READER' }

/**
 * Credenciales: genera el código de cada alumno, lo graba en su etiqueta NFC desde el celular,
 * enrola lectores USB e imprime los códigos QR. Lo puede hacer el administrador técnico.
 */
export const CardsPage = () => {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    const { showToast } = useToast()
    const [params, setParams] = useSearchParams()
    const [groups, setGroups] = useState<Group[]>([])
    const groupId = params.get('groupId') ?? ''
    const [students, setStudents] = useState<Student[]>([])
    const [cards, setCards] = useState<Card[]>([])
    const [loading, setLoading] = useState(false)
    const [current, setCurrent] = useState<string | null>(null)
    const [mode, setMode] = useState<'NFC' | 'LECTOR' | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!tenantId) return
        supabase.from('groups').select('id, grade, section').eq('tenant_id', tenantId).is('archived_at', null).order('grade').order('section')
            .then(({ data }) => setGroups((data as Group[]) ?? []))
    }, [tenantId])

    const load = useCallback(async () => {
        if (!groupId) return
        setLoading(true)
        const [{ data: st }, { error }] = await Promise.all([
            supabase.from('students').select('id, first_name, last_name_paternal, last_name_maternal').eq('group_id', groupId).order('last_name_paternal').order('last_name_maternal').order('first_name'),
            supabase.rpc('ensure_card_tokens', { p_group: groupId }),
        ])
        if (error) showToast('No se pudieron preparar las credenciales: ' + error.message, 'error')
        const list = (st as Student[]) ?? []
        setStudents(list)
        const { data: c } = list.length ? await supabase.from('student_cards').select('student_id, code, kind').in('student_id', list.map(s => s.id)) : { data: [] }
        setCards((c as Card[]) ?? [])
        setLoading(false)
    }, [groupId, showToast])
    useEffect(() => { load() }, [load])

    const tokenOf = useCallback((id: string) => cards.find(c => c.student_id === id && c.kind === 'TOKEN')?.code ?? '', [cards])
    const hasNfc = useCallback((id: string) => cards.some(c => c.student_id === id && c.kind !== 'TOKEN'), [cards])
    const pendingList = useMemo(() => students.filter(s => !hasNfc(s.id)), [students, hasNfc])
    const name = (s: Student) => [s.last_name_paternal, s.last_name_maternal, s.first_name].filter(Boolean).join(' ')
    const cur = students.find(s => s.id === current) ?? null

    // Al terminar con un alumno pasa solo al siguiente que falte
    const advance = useCallback((doneId: string) => {
        const i = students.findIndex(s => s.id === doneId)
        const next = [...students.slice(i + 1), ...students.slice(0, i)].find(s => s.id !== doneId && !hasNfc(s.id))
        setCurrent(next?.id ?? null)
        if (!next) { setMode(null); setStatus('Listo: todos los alumnos del grupo tienen su credencial.') }
    }, [students, hasNfc])

    const link = useCallback(async (studentId: string, code: string, kind: 'NFC_UID' | 'READER') => {
        const { error } = await supabase.rpc('link_card', { p_student: studentId, p_code: code, p_kind: kind })
        if (error) { beep(false); setStatus('No se pudo ligar: ' + error.message); return false }
        setCards(c => [...c.filter(x => x.code !== normalizeCode(code)), { student_id: studentId, code: normalizeCode(code), kind }])
        beep(true)
        return true
    }, [])

    // Programación por NFC: al acercar la etiqueta se graba la dirección del alumno seleccionado y se liga su número de serie
    const curRef = useRef<Student | null>(null); curRef.current = cur
    const tokenRef = useRef(tokenOf); tokenRef.current = tokenOf
    const advRef = useRef(advance); advRef.current = advance
    useEffect(() => {
        if (mode !== 'NFC') return
        let stop: (() => void) | undefined, cancelled = false
        listenNfc(async r => {
            const s = curRef.current
            if (!s) { setStatus('Elige primero a un alumno.'); return }
            const token = tokenRef.current(s.id)
            if (!token) { setStatus('Ese alumno aún no tiene código; recarga la página.'); return }
            if (r.serial) { if (!(await link(s.id, r.serial, 'NFC_UID'))) return }
            setStatus(`Credencial de ${s.first_name} ${s.last_name_paternal} grabada.`)
            setTimeout(() => advRef.current(s.id), 0)
            return cardUrl(token)
        }, msg => { beep(false); setStatus(msg) })
            .then(s => { if (cancelled) s(); else stop = s })
            .catch(e => { setMode(null); setStatus(e?.message || 'No se pudo usar NFC.') })
        return () => { cancelled = true; stop?.() }
    }, [mode, link])

    useEffect(() => {
        if (mode !== 'LECTOR') return
        const t = setInterval(() => inputRef.current?.focus(), 700)
        return () => clearInterval(t)
    }, [mode])

    const start = (m: 'NFC' | 'LECTOR') => { setStatus(null); setCurrent(c => c ?? pendingList[0]?.id ?? students[0]?.id ?? null); setMode(m) }

    return (
        <div className="max-w-5xl mx-auto space-y-4 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 flex items-start gap-3 print:hidden">
                <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><IdCard className="w-6 h-6" /></div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Credenciales de alumnos</h1>
                    <p className="text-slate-600 text-sm">Graba la etiqueta NFC de cada credencial desde tu celular, enrola un lector USB o imprime los códigos QR. La credencial solo lleva un código, no datos del alumno.</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-slate-100 flex flex-wrap items-center gap-3 print:hidden">
                <select aria-label="Grupo" value={groupId} onChange={e => { setMode(null); setCurrent(null); setParams(e.target.value ? { groupId: e.target.value } : {}) }}
                    className="min-h-[44px] rounded-2xl border border-slate-200 px-3 font-bold bg-white">
                    <option value="">Elige un grupo…</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.grade}° {g.section}</option>)}
                </select>
                {groupId && !loading && (
                    <>
                        <span className="text-sm text-slate-600">{students.length - pendingList.length} de {students.length} con credencial ligada</span>
                        <div className="ml-auto flex flex-wrap gap-2">
                            <button type="button" onClick={() => (mode === 'NFC' ? setMode(null) : start('NFC'))} disabled={nfcSupport() === 'none' || !students.length}
                                className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-2xl text-sm font-black disabled:opacity-40 ${mode === 'NFC' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                {mode === 'NFC' ? <Square className="w-4 h-4" /> : <Nfc className="w-4 h-4" />} {mode === 'NFC' ? 'Detener' : 'Grabar etiquetas NFC'}
                            </button>
                            <button type="button" onClick={() => (mode === 'LECTOR' ? setMode(null) : start('LECTOR'))} disabled={!students.length}
                                className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-2xl text-sm font-black disabled:opacity-40 ${mode === 'LECTOR' ? 'bg-rose-600 text-white' : 'border border-slate-200 text-slate-800 hover:bg-slate-50'}`}>
                                {mode === 'LECTOR' ? <Square className="w-4 h-4" /> : <Keyboard className="w-4 h-4" />} {mode === 'LECTOR' ? 'Detener' : 'Enrolar con lector USB'}
                            </button>
                            <button type="button" onClick={() => window.print()} disabled={!students.length} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-2xl text-sm font-black border border-slate-200 text-slate-800 hover:bg-slate-50 disabled:opacity-40">
                                <Printer className="w-4 h-4" /> Imprimir QR
                            </button>
                        </div>
                    </>
                )}
            </div>

            {groupId && nfcSupport() === 'none' && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl p-3 print:hidden">
                    Para <b>grabar</b> etiquetas NFC abre esta pantalla en Chrome desde un celular Android con NFC. Desde computadora puedes enrolar un lector USB o imprimir los QR.
                </p>
            )}

            {mode && (
                <div className="rounded-3xl bg-slate-900 text-white p-5 text-center space-y-2 print:hidden" aria-live="assertive">
                    <Radio className="w-8 h-8 mx-auto text-emerald-400 animate-pulse" />
                    <p className="text-sm font-bold opacity-80">{mode === 'NFC' ? 'Acerca la etiqueta o credencial en blanco de' : 'Pasa por el lector la credencial de'}</p>
                    <p className="text-2xl font-black">{cur ? name(cur) : 'Elige un alumno de la lista'}</p>
                    {mode === 'LECTOR' && (
                        <form onSubmit={async e => {
                            e.preventDefault()
                            const v = inputRef.current?.value ?? ''; if (inputRef.current) inputRef.current.value = ''
                            if (!cur || normalizeCode(v).length < 4) return
                            if (await link(cur.id, v, 'READER')) { setStatus(`Credencial de ${cur.first_name} ${cur.last_name_paternal} enrolada.`); advance(cur.id) }
                        }}>
                            <input ref={inputRef} aria-label="Código del lector" autoComplete="off" className="w-full max-w-xs min-h-[44px] rounded-2xl px-3 text-center font-mono text-slate-900" placeholder="Esperando al lector…" />
                        </form>
                    )}
                    {status && <p className="text-sm font-bold text-emerald-300">{status}</p>}
                </div>
            )}
            {!mode && status && <p className="text-sm font-bold text-emerald-800 bg-emerald-50 rounded-2xl p-3 print:hidden">{status}</p>}

            {loading ? <p className="flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Preparando credenciales…</p> : groupId && (
                <>
                    <ul className="bg-white rounded-3xl border border-slate-100 divide-y divide-slate-100 print:hidden">
                        {students.map((s, i) => (
                            <li key={s.id}>
                                <button type="button" onClick={() => setCurrent(s.id)} aria-pressed={current === s.id}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${current === s.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                    <span className="w-7 text-sm text-slate-400 font-bold">{i + 1}</span>
                                    <span className="flex-1 font-bold text-slate-900 text-sm">{name(s)}</span>
                                    {hasNfc(s.id)
                                        ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" /> Credencial ligada</span>
                                        : <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Solo QR</span>}
                                </button>
                            </li>
                        ))}
                        {!students.length && <li className="p-4 text-sm text-slate-500">Este grupo no tiene alumnos.</li>}
                    </ul>

                    {/* Hoja para imprimir: un QR por alumno */}
                    <div className="hidden print:grid grid-cols-3 gap-4">
                        {students.map(s => tokenOf(s.id) && (
                            <div key={s.id} className="border border-slate-300 rounded-lg p-3 text-center break-inside-avoid">
                                <QRCodeSVG value={cardQr(tokenOf(s.id))} size={120} className="mx-auto" />
                                <p className="text-xs font-bold mt-2 leading-tight">{name(s)}</p>
                                <p className="text-[10px] text-slate-500">{groups.find(g => g.id === groupId)?.grade}° {groups.find(g => g.id === groupId)?.section} · {(tenant as any)?.name}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
