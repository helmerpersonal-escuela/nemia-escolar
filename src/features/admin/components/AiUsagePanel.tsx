import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Save } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { wizardInput } from '../../../components/wizard/Wizard'

const db = supabase as any
const input = wizardInput.replace('px-4 py-3', 'px-3 py-2.5')
// Precio aproximado por millón de tokens (USD), septiembre 2026. ~4 caracteres en español = 1 token.
const PRICES: Record<string, { in: number; out: number; label: string }> = {
    'gemini-2.5-flash': { in: 0.30, out: 2.50, label: 'Gemini 2.5 Flash (actual)' },
    'gpt-oss-120b': { in: 0.15, out: 0.60, label: 'Groq GPT-OSS 120B (recomendado)' },
    'gemini-3.1-flash-lite': { in: 0.25, out: 1.50, label: 'Gemini 3.1 Flash-Lite' },
}
const usd = (n: number) => `$${n.toFixed(2)} USD`

/** Modo dios · Límites de IA por docente y consumo real. */
export const AiUsagePanel = () => {
    const qc = useQueryClient()
    const [days, setDays] = useState(30)
    const { data: summary } = useQuery({
        queryKey: ['god', 'ai-usage', days],
        queryFn: async () => ((await db.rpc('admin_ai_usage_summary', { p_days: days })).data ?? null) as any,
    })
    const { data: settings } = useQuery({
        queryKey: ['god', 'ai-limits'],
        queryFn: async () => {
            const { data } = await db.from('system_settings').select('key, value').in('key', ['ai_daily_limit', 'ai_daily_char_limit'])
            return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value])) as Record<string, string>
        },
    })
    const [limit, setLimit] = useState('')
    const [chars, setChars] = useState('')
    useEffect(() => { if (settings) { setLimit(settings.ai_daily_limit ?? '30'); setChars(settings.ai_daily_char_limit ?? '250000') } }, [settings])

    const save = async () => {
        await db.from('system_settings').upsert([
            { key: 'ai_daily_limit', value: String(Math.max(1, Number(limit) || 30)), updated_at: new Date().toISOString() },
            { key: 'ai_daily_char_limit', value: String(Math.max(10000, Number(chars) || 250000)), updated_at: new Date().toISOString() },
        ])
        qc.invalidateQueries({ queryKey: ['god', 'ai-limits'] })
    }

    const t = summary?.totals ?? { requests: 0, users: 0, in_chars: 0, out_chars: 0 }
    const inTok = t.in_chars / 4, outTok = t.out_chars / 4
    const perUser = t.users ? t.requests / t.users : 0

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
            <h4 className="font-black text-slate-900 flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600" /> Límites y consumo de IA</h4>
            <div className="grid grid-cols-2 gap-3">
                <label><span className="block text-[11px] font-black text-slate-500 mb-1">Solicitudes por docente al día</span>
                    <input className={input} type="number" min={1} value={limit} onChange={e => setLimit(e.target.value)} /></label>
                <label><span className="block text-[11px] font-black text-slate-500 mb-1">Caracteres enviados al día</span>
                    <input className={input} type="number" min={10000} step={10000} value={chars} onChange={e => setChars(e.target.value)} /></label>
            </div>
            <button onClick={save} className="w-full py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-black inline-flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Guardar límites</button>
            <p className="text-xs text-slate-500">Uso típico de un docente: 5–12 solicitudes al día; días de planeación: 20–28. El límite se cuenta en las últimas 24 horas.</p>

            <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-black text-slate-700">Consumo real</span>
                    <select className="px-2 py-1.5 rounded-xl border border-slate-200 text-xs font-bold" value={days} onChange={e => setDays(Number(e.target.value))}>
                        <option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {[['Solicitudes', t.requests], ['Docentes', t.users], ['Prom. por docente', perUser.toFixed(1)], ['Tokens (ent/sal)', `${Math.round(inTok / 1000)}k / ${Math.round(outTok / 1000)}k`]].map(([k, v]) => (
                        <div key={k as string} className="rounded-2xl bg-slate-50 p-3"><div className="text-lg font-black text-slate-900">{v}</div><div className="text-[11px] font-bold text-slate-500">{k}</div></div>
                    ))}
                </div>
                <div className="mt-3 space-y-1 text-sm">
                    {Object.values(PRICES).map(p => (
                        <div key={p.label} className="flex justify-between"><span className="text-slate-600">{p.label}</span><b>{usd((inTok * p.in + outTok * p.out) / 1e6)}</b></div>
                    ))}
                    <p className="text-[11px] text-slate-400">Costo estimado del periodo con cada modelo (aproximado; los modelos que "razonan" cobran tokens extra).</p>
                </div>
                {summary?.top_users?.length > 0 && (
                    <div className="mt-4">
                        <span className="text-xs font-black text-slate-500">Docentes con más uso</span>
                        <ul className="mt-1 divide-y divide-slate-100 text-sm">
                            {summary.top_users.map((u: any) => (
                                <li key={u.user_id} className="py-1.5 flex justify-between gap-2"><span className="truncate">{u.name ?? u.user_id}</span><span className="text-slate-500 shrink-0">{u.requests} sol. · máx {u.max_day}/día</span></li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}
