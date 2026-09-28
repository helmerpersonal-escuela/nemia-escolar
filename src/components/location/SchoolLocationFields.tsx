import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Crosshair, Loader2, MapPin } from 'lucide-react'
import { WizardField, wizardInput } from '../wizard/Wizard'
import { supabase } from '../../lib/supabase'
import { filterSettlements, geocodeMx, loadMunicipalities, loadSettlements, loadStates, normalizeGeo } from '../../lib/geoMx'

const LocationMap = lazy(() => import('./LocationMap'))

export interface SchoolLocation {
    stateCve: string
    state: string
    munCve: string          // '' si el municipio se escribió a mano
    municipality: string
    settlement: string      // colonia / localidad
    zip: string
    street: string
    lat: number | null
    lng: number | null
    pinned: boolean         // true si el usuario marcó el punto en el mapa
}

export const emptyLocation: SchoolLocation = { stateCve: '', state: '', munCve: '', municipality: '', settlement: '', zip: '', street: '', lat: null, lng: null, pinned: false }

export const isLocationComplete = (l: SchoolLocation) => !!(l.state && l.municipality.trim() && l.settlement.trim())

const OTHER = '__otro__'

/** Estado → municipio → colonia (catálogo SEPOMEX) y mapa para marcar la escuela. */
export function SchoolLocationFields({ value, onChange }: { value: SchoolLocation; onChange: (v: SchoolLocation) => void }) {
    const set = (patch: Partial<SchoolLocation>) => onChange({ ...value, ...patch })
    const [manualMun, setManualMun] = useState(!!value.municipality && !value.munCve)
    const [openList, setOpenList] = useState(false)
    const [center, setCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng, zoom: 16 } : null)
    const [locating, setLocating] = useState(false)
    const listId = 'colonias-sugeridas'

    const states = useQuery({ queryKey: ['geo-states'], queryFn: loadStates, staleTime: Infinity })
    const muns = useQuery({ queryKey: ['geo-mun', value.stateCve], queryFn: () => loadMunicipalities(value.stateCve), enabled: !!value.stateCve, staleTime: Infinity })
    const sets = useQuery({ queryKey: ['geo-col', value.stateCve, value.munCve], queryFn: () => loadSettlements(value.stateCve, value.munCve), enabled: !!value.stateCve && !!value.munCve, staleTime: Infinity })

    const suggestions = useMemo(() => filterSettlements(sets.data ?? [], value.settlement), [sets.data, value.settlement])
    const inCatalog = !!sets.data?.some(s => normalizeGeo(s.name) === normalizeGeo(value.settlement))

    // Al cambiar lo capturado, el mapa se enfoca ahí (y coloca el pin aproximado si aún no se marcó)
    const valueRef = useRef(value)
    valueRef.current = value
    useEffect(() => {
        if (!value.state) return
        const t = setTimeout(async () => {
            const hit = await geocodeMx({ state: value.state, municipality: value.municipality, settlement: value.settlement, cp: value.zip })
            if (!hit) return
            setCenter(hit)
            const cur = valueRef.current
            if (!cur.pinned && hit.zoom >= 12) onChange({ ...cur, lat: hit.lat, lng: hit.lng })
        }, 700)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.state, value.municipality, value.settlement])

    const useMyLocation = () => {
        if (!navigator.geolocation) return
        setLocating(true)
        navigator.geolocation.getCurrentPosition(
            pos => {
                setLocating(false)
                const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                setCenter({ ...p, zoom: 17 })
                set({ ...p, pinned: true })
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 10000 },
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <WizardField label="Estado" required>
                    <select aria-label="Estado" className={wizardInput} value={value.stateCve}
                        onChange={e => {
                            const st = states.data?.find(s => s.cve === e.target.value)
                            setManualMun(false)
                            onChange({ ...value, stateCve: e.target.value, state: st?.name ?? '', munCve: '', municipality: '', settlement: '', zip: '', pinned: false })
                        }}>
                        <option value="">{states.isLoading ? 'Cargando…' : 'Selecciona el estado'}</option>
                        {states.data?.map(s => <option key={s.cve} value={s.cve}>{s.name}</option>)}
                    </select>
                </WizardField>

                <WizardField label="Municipio" required hint={manualMun ? 'Escríbelo como aparece en documentos oficiales.' : undefined}>
                    {manualMun ? (
                        <div className="flex gap-2">
                            <input aria-label="Municipio" className={wizardInput} value={value.municipality} placeholder="Nombre del municipio"
                                onChange={e => set({ municipality: e.target.value, munCve: '' })} />
                            <button type="button" onClick={() => { setManualMun(false); set({ municipality: '', munCve: '' }) }} className="shrink-0 px-3 rounded-2xl text-xs font-black text-indigo-700 hover:bg-indigo-50">Lista</button>
                        </div>
                    ) : (
                        <select aria-label="Municipio" className={wizardInput} value={value.munCve} disabled={!value.stateCve}
                            onChange={e => {
                                if (e.target.value === OTHER) { setManualMun(true); set({ munCve: '', municipality: '', settlement: '', zip: '' }); return }
                                const m = muns.data?.find(x => x.cve === e.target.value)
                                onChange({ ...value, munCve: e.target.value, municipality: m?.name ?? '', settlement: '', zip: '', pinned: false })
                            }}>
                            <option value="">{!value.stateCve ? 'Primero elige el estado' : muns.isLoading ? 'Cargando…' : 'Selecciona el municipio'}</option>
                            {muns.data?.map(m => <option key={m.cve} value={m.cve}>{m.name}</option>)}
                            {value.stateCve && <option value={OTHER}>Otro (no aparece en la lista)</option>}
                        </select>
                    )}
                </WizardField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 relative">
                    <WizardField label="Colonia o localidad" required
                        hint={value.settlement && sets.data && !inCatalog ? 'No está en el catálogo: se guardará tal como la escribiste.' : 'Escribe para buscar; si no aparece, escríbela completa.'}>
                        <input aria-label="Colonia o localidad" className={wizardInput} value={value.settlement} disabled={!value.municipality}
                            placeholder={value.municipality ? 'Ej. Centro' : 'Primero elige el municipio'}
                            role="combobox" aria-expanded={openList && suggestions.length > 0} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
                            onFocus={() => setOpenList(true)}
                            onBlur={() => setTimeout(() => setOpenList(false), 150)}
                            onChange={e => { set({ settlement: e.target.value, pinned: value.pinned }); setOpenList(true) }} />
                    </WizardField>
                    {openList && suggestions.length > 0 && !inCatalog && (
                        <ul id={listId} role="listbox" className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-xl py-1">
                            {suggestions.map(s => (
                                <li key={s.name + s.cp} role="option" aria-selected={false}>
                                    <button type="button" onMouseDown={e => e.preventDefault()}
                                        onClick={() => { set({ settlement: s.name, zip: s.cp }); setOpenList(false) }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center justify-between gap-3">
                                        <span className="text-sm font-bold text-slate-800">{s.name}</span>
                                        <span className="text-xs text-slate-500 shrink-0">{s.type} · CP {s.cp}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <WizardField label="Código postal">
                    <input aria-label="Código postal" inputMode="numeric" maxLength={5} className={wizardInput} value={value.zip} placeholder="00000"
                        onChange={e => set({ zip: e.target.value.replace(/\D/g, '').slice(0, 5) })} />
                </WizardField>
            </div>

            <WizardField label="Calle y número" hint="Opcional.">
                <input aria-label="Calle y número" className={wizardInput} value={value.street} placeholder="Ej. Av. Central Poniente 123"
                    onChange={e => set({ street: e.target.value })} />
            </WizardField>

            <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-600 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-indigo-600" /> Ubicación en el mapa</span>
                    <button type="button" onClick={useMyLocation} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-indigo-700 hover:bg-indigo-50">
                        {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />} Estoy en la escuela
                    </button>
                </div>
                <Suspense fallback={<div className="h-64 sm:h-80 rounded-2xl bg-slate-100 flex items-center justify-center text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando mapa…</div>}>
                    <LocationMap center={center} pin={value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null}
                        onPin={p => set({ lat: p.lat, lng: p.lng, pinned: true })} />
                </Suspense>
                <p className="text-xs text-slate-500">
                    {value.pinned ? 'Ubicación marcada. Puedes arrastrar el pin para ajustarla.' : 'El mapa se acerca a lo que capturas. Toca el mapa o arrastra el pin para marcar la entrada de la escuela.'}
                </p>
            </div>
        </div>
    )
}

/** Guarda la ubicación en school_details (dirección) y tenants (coordenadas). */
export async function saveSchoolLocation(tenantId: string, loc: SchoolLocation, school: { name: string; cct?: string | null }) {
    const { error: e1 } = await supabase.from('school_details').upsert({
        tenant_id: tenantId,
        official_name: school.name || 'Escuela',
        cct: school.cct || '',
        address_state: loc.state || null,
        address_state_code: loc.stateCve || null,
        address_municipality: loc.municipality.trim() || null,
        address_municipality_code: loc.munCve ? `${loc.stateCve}${loc.munCve}` : null,
        address_neighborhood: loc.settlement.trim() || null,
        address_zip_code: loc.zip || null,
        address_street: loc.street.trim() || null,
    } as any, { onConflict: 'tenant_id' })
    if (e1) throw e1
    const address = [loc.street, loc.settlement && `Col. ${loc.settlement}`, loc.zip && `C.P. ${loc.zip}`, loc.municipality, loc.state].filter(Boolean).join(', ')
    const { error: e2 } = await supabase.from('tenants').update({ address, location_lat: loc.lat, location_lng: loc.lng } as any).eq('id', tenantId)
    if (e2) throw e2
}

/** Lee la ubicación guardada (para retomar el asistente o editarla en Ajustes). */
export async function loadSchoolLocation(tenantId: string): Promise<SchoolLocation | null> {
    const [{ data: sd }, { data: t }] = await Promise.all([
        supabase.from('school_details').select('address_state, address_state_code, address_municipality, address_municipality_code, address_neighborhood, address_zip_code, address_street').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('tenants').select('location_lat, location_lng').eq('id', tenantId).maybeSingle(),
    ])
    if (!sd?.address_state) return null
    const s = sd as any
    return {
        stateCve: s.address_state_code || '', state: s.address_state || '',
        munCve: s.address_municipality_code ? String(s.address_municipality_code).slice(2) : '', municipality: s.address_municipality || '',
        settlement: s.address_neighborhood || '', zip: s.address_zip_code || '', street: s.address_street || '',
        lat: (t as any)?.location_lat ?? null, lng: (t as any)?.location_lng ?? null, pinned: (t as any)?.location_lat != null,
    }
}
