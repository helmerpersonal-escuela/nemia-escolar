import { useEffect, useMemo, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { HeartHandshake, Loader2, Printer, RefreshCw, Users, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { EmptyState } from '../../../components/ui/EmptyState'
import { familyAccessUrl } from '../lib/familyCode'

interface GroupRow { id: string; grade: string; section: string }
interface CodeRow { student_id: string; student_name: string; code: string; linked_accounts: number }

const groupLabel = (g: GroupRow) => `${g.grade}° ${g.section}`

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Arma la hoja para imprimir: 8 recortes por hoja carta, con código y QR. */
function buildPrintHtml(school: string, sections: { group: string; rows: CodeRow[] }[]): string {
    const baseUrl = familyAccessUrl()
    const slips = sections.flatMap(sec => sec.rows.map(r => {
        const qr = renderToStaticMarkup(<QRCodeSVG value={familyAccessUrl(r.code)} size={92} level="M" />)
        return `
        <div class="slip">
          <div class="head"><b>${escapeHtml(school)}</b><span>${escapeHtml(sec.group)}</span></div>
          <div class="body">
            <div class="txt">
              <div class="who">${escapeHtml(r.student_name)}</div>
              <div class="lbl">Código para madre, padre o tutor</div>
              <div class="code">${escapeHtml(r.code)}</div>
              <ol>
                <li>Entra a <b>${escapeHtml(baseUrl.replace(/^https?:\/\//, ''))}</b> o escanea el código QR.</li>
                <li>Escribe el código y entra con tu cuenta de Google o tu correo.</li>
              </ol>
              <div class="note">Guárdalo. Es personal: con él se ven las calificaciones de tu hijo(a).</div>
            </div>
            <div class="qr">${qr}</div>
          </div>
        </div>`
    })).join('')

    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Códigos para familias</title>
    <style>
      @page { size: letter; margin: 10mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
      .slip { border: 1px dashed #94a3b8; padding: 10px 12px; height: 63mm; page-break-inside: avoid; break-inside: avoid; }
      .head { display: flex; justify-content: space-between; font-size: 10px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; }
      .body { display: flex; gap: 8px; align-items: flex-start; }
      .txt { flex: 1; min-width: 0; }
      .who { font-size: 12px; font-weight: bold; }
      .lbl { font-size: 9px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: .05em; }
      .code { font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 2px 0 4px; }
      ol { margin: 0; padding-left: 16px; font-size: 9.5px; line-height: 1.35; }
      .note { font-size: 8.5px; color: #64748b; margin-top: 4px; }
      .qr svg { display: block; }
    </style></head><body><div class="grid">${slips}</div>
    <script>window.onload = function () { setTimeout(function () { window.print() }, 250) }</script>
    </body></html>`
}

/**
 * Control escolar: códigos para que madres, padres y tutores liguen su cuenta.
 * Se imprime un recorte por alumno; nada de correos masivos ni contraseñas temporales.
 */
export const FamilyCodesPage = () => {
    const { data: tenant } = useTenant()
    const [groups, setGroups] = useState<GroupRow[]>([])
    const [groupId, setGroupId] = useState<string>('')
    const [rows, setRows] = useState<CodeRow[]>([])
    const [loading, setLoading] = useState(false)
    const [printingAll, setPrintingAll] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!tenant?.id) return
        supabase.from('groups').select('id, grade, section').eq('tenant_id', tenant.id)
            .order('grade').order('section')
            .then(({ data, error: e }) => {
                if (e) { setError('No se pudieron cargar los grupos.'); return }
                const list = (data ?? []) as GroupRow[]
                setGroups(list)
                if (list.length && !groupId) setGroupId(list[0].id)
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenant?.id])

    const load = async (gid: string, regenerate = false) => {
        setLoading(true)
        setError(null)
        const { data, error: e } = await supabase.rpc('family_codes_for_group', { p_group: gid, p_regenerate: regenerate })
        setLoading(false)
        if (e) { setError(e.message); setRows([]); return }
        setRows((data ?? []) as CodeRow[])
    }

    useEffect(() => { if (groupId) void load(groupId) }, [groupId])

    const group = useMemo(() => groups.find(g => g.id === groupId), [groups, groupId])
    const linked = rows.filter(r => r.linked_accounts > 0).length

    const openPrint = (html: string) => {
        const w = window.open('', '_blank')
        if (!w) { setError('Tu navegador bloqueó la ventana para imprimir. Permite ventanas emergentes para este sitio.'); return }
        w.document.open()
        w.document.write(html)
        w.document.close()
    }

    const printGroup = () => {
        if (!group || !rows.length) return
        openPrint(buildPrintHtml(tenant?.name ?? '', [{ group: groupLabel(group), rows }]))
    }

    const printAll = async () => {
        setPrintingAll(true)
        setError(null)
        const sections: { group: string; rows: CodeRow[] }[] = []
        for (const g of groups) {
            const { data, error: e } = await supabase.rpc('family_codes_for_group', { p_group: g.id, p_regenerate: false })
            if (e) { setError(e.message); setPrintingAll(false); return }
            if (data?.length) sections.push({ group: groupLabel(g), rows: data as CodeRow[] })
        }
        setPrintingAll(false)
        if (!sections.length) { setError('Todavía no hay alumnos inscritos en los grupos.'); return }
        openPrint(buildPrintHtml(tenant?.name ?? '', sections))
    }

    const regenerateOne = async (studentId: string) => {
        if (!window.confirm('¿Cambiar el código de este alumno? El código anterior dejará de servir. Las cuentas que ya están ligadas siguen funcionando.')) return
        const { data, error: e } = await supabase.rpc('regenerate_family_code', { p_student: studentId })
        if (e) { setError(e.message); return }
        setRows(prev => prev.map(r => r.student_id === studentId ? { ...r, code: String(data) } : r))
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5"><HeartHandshake className="w-4 h-4" /> Familias</p>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">Códigos para madres, padres y tutores</h1>
                    <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                        Imprime un recorte por alumno y entrégalo a su familia. Con ese código entran desde su celular y solo ven
                        la asistencia, calificaciones y avisos de su hijo(a). No se envían correos.
                    </p>
                </div>
                <button type="button" onClick={printAll} disabled={printingAll || !groups.length}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-50">
                    {printingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Imprimir todos los grupos
                </button>
            </header>

            {groups.length === 0 ? (
                <EmptyState icon={Users} title="Aún no hay grupos" description="Da de alta los grupos y a sus alumnos; después aquí aparecerán sus códigos." action={{ label: 'Ir a grupos', to: '/groups' }} />
            ) : (
                <section className="bg-white rounded-3xl border border-slate-200 overflow-clip">
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-slate-100">
                        <label className="text-sm font-bold text-slate-700" htmlFor="grupo-codigos">Grupo</label>
                        <select id="grupo-codigos" value={groupId} onChange={e => setGroupId(e.target.value)}
                            className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white">
                            {groups.map(g => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
                        </select>
                        <p className="text-sm text-slate-500 sm:ml-2">
                            {rows.length ? <><b>{linked}</b> de {rows.length} familias ya entraron</> : null}
                        </p>
                        <button type="button" onClick={printGroup} disabled={!rows.length}
                            className="sm:ml-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm disabled:opacity-50">
                            <Printer className="w-4 h-4" /> Imprimir este grupo
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500" /></div>
                    ) : rows.length === 0 ? (
                        <p className="p-8 text-center text-sm text-slate-500">Este grupo todavía no tiene alumnos inscritos.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {rows.map(r => (
                                <li key={r.student_id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                    <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 truncate">{r.student_name}</span>
                                    <span className="font-mono text-base font-black tracking-widest text-slate-900">{r.code}</span>
                                    <span className={`text-xs font-bold inline-flex items-center gap-1 ${r.linked_accounts ? 'text-emerald-700' : 'text-slate-400'}`}>
                                        {r.linked_accounts ? <><CheckCircle2 className="w-4 h-4" /> {r.linked_accounts} {r.linked_accounts === 1 ? 'cuenta' : 'cuentas'}</> : 'Sin entrar'}
                                    </span>
                                    <button type="button" onClick={() => regenerateOne(r.student_id)}
                                        className="text-xs font-bold text-slate-500 hover:text-rose-600 inline-flex items-center gap-1 self-start sm:self-auto">
                                        <RefreshCw className="w-3.5 h-3.5" /> Cambiar código
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
        </div>
    )
}
