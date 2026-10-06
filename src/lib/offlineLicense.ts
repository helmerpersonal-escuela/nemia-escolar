/**
 * Validador de licencias locales (sin internet).
 *
 * La licencia la firma el administrador con su clave PRIVADA Ed25519 (tools/licencias).
 * Aquí solo hay claves PÚBLICAS: permiten comprobar la firma, no crearla, así que con el
 * código de la app no se puede hacer un generador de licencias.
 *
 * Se comprueba, en este orden: formato → firma → que los datos visibles sean los firmados →
 * que la licencia sea de este equipo (HWID) → que no haya vencido → que el reloj no se haya atrasado.
 */
import * as ed from '@noble/ed25519'
import { LICENSE_PUBLIC_KEYS } from './offlineLicenseKey'

export const LICENSE_FORMAT = 'vunlek-licencia-v1'
export const LICENSE_CODE_PREFIX = 'VNLK1'

export interface LicenseData {
    id: string
    escuela: string
    cct: string
    /** AAAA-MM-DD; la licencia vale hasta el final de ese día. */
    expira: string
    hwid: string
    emitida: string
    plan?: string
    notas?: string
}

export interface LicenseFile {
    formato: string
    datos?: LicenseData
    carga: string
    firma: string
    clave?: string
}

export type LicenseStatus =
    | 'VALIDA'
    | 'SIN_LICENCIA'   // no se ha cargado ninguna
    | 'SIN_CLAVE'      // la app no trae clave pública (falta npm run licencias:claves)
    | 'FORMATO'        // no es una licencia de VUNLEK o está incompleta
    | 'FIRMA'          // la firma no corresponde: alterada o hecha con otra clave
    | 'ALTERADA'       // los datos visibles no son los que se firmaron
    | 'OTRO_EQUIPO'    // es válida, pero para otra computadora
    | 'VENCIDA'
    | 'RELOJ'          // la fecha del equipo es anterior a la última vez que se usó

export interface LicenseResult {
    ok: boolean
    status: LicenseStatus
    message: string
    license: LicenseData | null
    /** Días que faltan para vencer (0 = vence hoy). Solo cuando hay datos firmados válidos. */
    daysLeft: number | null
}

export const LICENSE_MESSAGE: Record<LicenseStatus, string> = {
    VALIDA: 'Licencia válida.',
    SIN_LICENCIA: 'Este equipo todavía no tiene una licencia.',
    SIN_CLAVE: 'Esta versión de la app no puede comprobar licencias. Actualiza la aplicación.',
    FORMATO: 'El archivo o código no es una licencia de VUNLEK. Revisa que esté completo.',
    FIRMA: 'La licencia no es auténtica: fue modificada o no la emitió VUNLEK.',
    ALTERADA: 'Los datos de la licencia fueron modificados. Pide que te la envíen de nuevo.',
    OTRO_EQUIPO: 'Esta licencia es de otra computadora. Envía el identificador de este equipo para que te generen la suya.',
    VENCIDA: 'La licencia venció. Solicita la renovación.',
    RELOJ: 'La fecha de este equipo parece estar atrasada. Corrige la fecha y la hora e inténtalo de nuevo.',
}

const DAY = 86_400_000
const LAST_SEEN_KEY = 'vunlek_license_last_seen'
/** Tolerancia al comparar con la última fecha vista (cambios de zona horaria, ajustes pequeños). */
const CLOCK_TOLERANCE = 2 * DAY

// ---------------------------------------------------------------- utilidades

const fromBase64 = (b64: string): Uint8Array => {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
}
const fromBase64Url = (s: string): Uint8Array => {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    return fromBase64(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))
}
const B64URL = /^[A-Za-z0-9_-]+$/
const normalizeHwid = (v: string) => String(v ?? '').trim().toUpperCase()

/** Compara dos objetos planos sin depender del orden de sus campos. */
const sameData = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort()
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k])
}

/** Fin del día de expiración, en la hora local del equipo. */
export const expiryInstant = (expira: string): number => {
    const [y, m, d] = expira.split('-').map(Number)
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

/** Acepta el archivo .json (texto u objeto) o el código de una línea "VNLK1.carga.firma". */
export function parseLicense(input: string | LicenseFile | null | undefined): LicenseFile | null {
    if (!input) return null
    if (typeof input === 'object') return input.carga && input.firma ? input : null
    const text = input.trim()
    if (!text) return null
    if (text.startsWith(`${LICENSE_CODE_PREFIX}.`)) {
        const [, carga, firma, ...rest] = text.replace(/\s+/g, '').split('.')
        return carga && firma && !rest.length ? { formato: LICENSE_FORMAT, carga, firma } : null
    }
    try {
        const obj = JSON.parse(text)
        return obj && typeof obj === 'object' && obj.carga && obj.firma ? obj as LicenseFile : null
    } catch {
        return null
    }
}

const result = (status: LicenseStatus, license: LicenseData | null = null, daysLeft: number | null = null): LicenseResult =>
    ({ ok: status === 'VALIDA', status, message: LICENSE_MESSAGE[status], license, daysLeft })

export interface ValidateOptions {
    /** Identificador de este equipo (ver hardwareId.ts). */
    hwid: string
    /** Para pruebas: fecha "actual". */
    now?: number
    /** Para pruebas o rotación: claves públicas a usar en lugar de las incrustadas. */
    publicKeys?: string[]
    /** Última fecha en que la app vio una licencia válida (protección contra atrasar el reloj). */
    lastSeen?: number | null
}

/** Comprueba una licencia. No guarda nada ni usa la red. */
export async function validateLicense(input: string | LicenseFile | null | undefined, opts: ValidateOptions): Promise<LicenseResult> {
    if (input == null || input === '') return result('SIN_LICENCIA')
    const keys = (opts.publicKeys ?? LICENSE_PUBLIC_KEYS).filter(Boolean)
    if (!keys.length) return result('SIN_CLAVE')

    const lic = parseLicense(input)
    if (!lic || lic.formato !== LICENSE_FORMAT || !B64URL.test(lic.carga) || !B64URL.test(lic.firma)) return result('FORMATO')

    // 1. Firma: se verifica sobre los bytes exactos que se firmaron
    let signature: Uint8Array
    try { signature = fromBase64Url(lic.firma) } catch { return result('FORMATO') }
    if (signature.length !== 64) return result('FORMATO')
    const message = new TextEncoder().encode(`${LICENSE_FORMAT}\n${lic.carga}`)
    let signed = false
    for (const key of keys) {
        try {
            if (await ed.verifyAsync(signature, message, fromBase64(key))) { signed = true; break }
        } catch { /* clave mal escrita: se prueba la siguiente */ }
    }
    if (!signed) return result('FIRMA')

    // 2. Datos: solo se confía en lo que está dentro de la carga firmada
    let data: LicenseData
    try {
        data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(lic.carga)))
    } catch {
        return result('FORMATO')
    }
    if (!data || typeof data !== 'object' || !data.escuela || !data.cct || !data.hwid || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.expira))) return result('FORMATO')
    // La copia legible del archivo debe decir lo mismo que lo firmado
    if (lic.datos && !sameData(lic.datos as any, data as any)) return result('ALTERADA')

    const now = opts.now ?? Date.now()
    const daysLeft = Math.floor((expiryInstant(data.expira) - now) / DAY)

    // 3. Equipo
    if (normalizeHwid(data.hwid) !== normalizeHwid(opts.hwid)) return result('OTRO_EQUIPO', data, daysLeft)
    // 4. Vigencia
    if (now > expiryInstant(data.expira)) return result('VENCIDA', data, daysLeft)
    // 5. Reloj atrasado (alguien regresó la fecha para estirar una licencia)
    if (opts.lastSeen && now < opts.lastSeen - CLOCK_TOLERANCE) return result('RELOJ', data, daysLeft)
    if (Date.parse(data.emitida) - now > CLOCK_TOLERANCE) return result('RELOJ', data, daysLeft)

    return result('VALIDA', data, daysLeft)
}

// ---------------------------------------------------------------- licencia guardada en el equipo

const STORED_KEY = 'vunlek_license'

export function readStoredLicense(): string | null {
    try { return localStorage.getItem(STORED_KEY) } catch { return null }
}

/** Valida y, solo si es válida para este equipo, la guarda. */
export async function installLicense(input: string, hwid: string): Promise<LicenseResult> {
    const r = await validateLicense(input, { hwid, lastSeen: readLastSeen() })
    if (r.ok) {
        const lic = parseLicense(input)!
        try {
            localStorage.setItem(STORED_KEY, JSON.stringify(lic))
            localStorage.setItem(LAST_SEEN_KEY, String(Date.now()))
        } catch { /* sin almacenamiento: vale para esta sesión */ }
    }
    return r
}

/** Comprueba la licencia guardada. Llamar al abrir la app (funciona sin internet). */
export async function checkStoredLicense(hwid: string): Promise<LicenseResult> {
    const r = await validateLicense(readStoredLicense(), { hwid, lastSeen: readLastSeen() })
    if (r.ok) { try { localStorage.setItem(LAST_SEEN_KEY, String(Math.max(Date.now(), readLastSeen() ?? 0))) } catch { /* sin almacenamiento */ } }
    return r
}

export function removeStoredLicense(): void {
    try { localStorage.removeItem(STORED_KEY) } catch { /* sin almacenamiento */ }
}

function readLastSeen(): number | null {
    try {
        const n = Number(localStorage.getItem(LAST_SEEN_KEY))
        return Number.isFinite(n) && n > 0 ? n : null
    } catch {
        return null
    }
}
