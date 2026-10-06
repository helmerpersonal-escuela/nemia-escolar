// @vitest-environment node
import { generateKeyPairSync } from 'node:crypto'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { expiryInstant, parseLicense, validateLicense, type LicenseFile } from './offlineLicense'

// Se usa el generador REAL del administrador (tools/licencias) para firmar,
// y el validador de la app para comprobar: así se prueba que ambos se entienden.
const toolPath = resolve(__dirname, '../../tools/licencias/formato.mjs')
const HWID = 'PC-ABCDE-FGHJK-MNPQR-STVWX'
const NOW = new Date(2026, 9, 6, 12, 0, 0).getTime()

let tool: any
let publicKey: string
let otherPublicKey: string
let make: (over?: Record<string, unknown>, pem?: string) => LicenseFile
let privatePem: string
let otherPem: string

beforeAll(async () => {
    tool = await import(/* @vite-ignore */ toolPath)
    const a = generateKeyPairSync('ed25519'), b = generateKeyPairSync('ed25519')
    privatePem = a.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
    otherPem = b.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
    publicKey = tool.clavePublicaBase64(a.privateKey)
    otherPublicKey = tool.clavePublicaBase64(b.privateKey)
    make = (over = {}, pem = privatePem) => {
        const datos = { id: 'LIC-1', escuela: 'Escuela Secundaria Técnica de Ejemplo', cct: '07DST9999X', expira: '2027-07-31', hwid: HWID, emitida: new Date(NOW - 3600_000).toISOString(), ...over }
        return tool.firmarLicencia(datos, pem)
    }
})

const check = (lic: any, extra: Record<string, unknown> = {}) => validateLicense(lic, { hwid: HWID, now: NOW, publicKeys: [publicKey], ...extra })

describe('licencias locales (Ed25519)', () => {
    it('acepta una licencia firmada por el administrador', async () => {
        const r = await check(make())
        expect(r.status).toBe('VALIDA')
        expect(r.ok).toBe(true)
        expect(r.license?.cct).toBe('07DST9999X')
        expect(r.daysLeft).toBeGreaterThan(290)
    })

    it('acepta el archivo como texto y el código de una línea', async () => {
        const lic = make()
        expect((await check(JSON.stringify(lic))).ok).toBe(true)
        expect((await check(tool.codigoDeLicencia(lic))).ok).toBe(true)
        expect((await check(`  ${tool.codigoDeLicencia(lic)}\n`)).ok).toBe(true)
    })

    it('rechaza una licencia firmada con otra clave (un "keygen" no tiene la clave privada)', async () => {
        expect((await check(make({}, otherPem))).status).toBe('FIRMA')
    })

    it('rechaza si se cambia la fecha en los datos visibles', async () => {
        const lic = make()
        const tampered = { ...lic, datos: { ...lic.datos!, expira: '2099-12-31' } }
        expect((await check(tampered)).status).toBe('ALTERADA')
    })

    it('rechaza si se cambia la carga firmada (aunque se rehaga con otros datos)', async () => {
        const lic = make()
        const forged = make({ expira: '2099-12-31' }, otherPem)
        expect((await check({ ...lic, carga: forged.carga, datos: forged.datos })).status).toBe('FIRMA')
        const flipped = lic.firma.slice(0, -2) + (lic.firma.endsWith('AA') ? 'BB' : 'AA')
        expect((await check({ ...lic, firma: flipped })).status).toBe('FIRMA')
    })

    it('rechaza la licencia de otra computadora', async () => {
        const r = await check(make({ hwid: 'PC-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ' }))
        expect(r.status).toBe('OTRO_EQUIPO')
        expect(r.ok).toBe(false)
    })

    it('no distingue mayúsculas ni espacios en el HWID', async () => {
        expect((await check(make(), { hwid: `  ${HWID.toLowerCase()} ` })).ok).toBe(true)
    })

    it('vale todo el día de expiración y vence al día siguiente', async () => {
        const lic = make({ expira: '2026-10-06' })
        expect((await check(lic)).status).toBe('VALIDA')
        expect((await check(lic)).daysLeft).toBe(0)
        expect((await check(lic, { now: expiryInstant('2026-10-06') + 1000 })).status).toBe('VENCIDA')
    })

    it('detecta el reloj atrasado', async () => {
        const lic = make()
        expect((await check(lic, { lastSeen: NOW + 30 * 86_400_000 })).status).toBe('RELOJ')
        expect((await check(lic, { lastSeen: NOW + 3600_000 })).status).toBe('VALIDA')
        // Fecha del equipo anterior a la emisión de la licencia
        expect((await check(lic, { now: NOW - 10 * 86_400_000 })).status).toBe('RELOJ')
    })

    it('distingue: sin licencia, sin clave y formato inválido', async () => {
        expect((await check(null)).status).toBe('SIN_LICENCIA')
        expect((await check(make(), { publicKeys: [] })).status).toBe('SIN_CLAVE')
        expect((await check('hola')).status).toBe('FORMATO')
        expect((await check('VNLK1.solo-una-parte')).status).toBe('FORMATO')
        expect((await check({ ...make(), formato: 'otra-cosa' })).status).toBe('FORMATO')
        expect(parseLicense('{"carga":"a"}')).toBeNull()
    })

    it('acepta varias claves públicas (rotación)', async () => {
        expect((await check(make({}, otherPem), { publicKeys: [publicKey, otherPublicKey] })).ok).toBe(true)
        expect((await check(make(), { publicKeys: ['no-es-una-clave', publicKey] })).ok).toBe(true)
    })
})
