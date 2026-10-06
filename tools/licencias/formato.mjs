// Formato de las licencias locales de VUNLEK (compartido por el generador y el verificador).
//
// Una licencia es un JSON con los datos legibles, esos mismos datos en bytes exactos ("carga")
// y la firma Ed25519 de esos bytes. La firma solo se puede PRODUCIR con la clave privada
// (que nunca sale de la computadora del administrador); la app la COMPRUEBA con la clave
// pública que lleva dentro. Con la clave pública no se pueden fabricar licencias: por eso
// no es posible hacer un "keygen" a partir de la app.
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto'

export const FORMATO = 'vunlek-licencia-v1'
export const PREFIJO_CODIGO = 'VNLK1'
/** Lo que realmente se firma: el nombre del formato + la carga (evita reutilizar firmas de otro uso). */
export const mensajeFirmado = carga => Buffer.from(`${FORMATO}\n${carga}`, 'utf8')

export const b64url = buf => Buffer.from(buf).toString('base64url')

/** Clave pública "cruda" (32 bytes) en base64, tal como se pega en la app. */
export function clavePublicaBase64(llave) {
    const publica = llave.type === 'private' ? createPublicKey(llave) : llave
    const der = publica.export({ type: 'spki', format: 'der' })
    return der.subarray(der.length - 32).toString('base64')
}

/** Identificador corto de una clave pública (para saber con cuál se firmó). */
export const idDeClave = publicaB64 => createHash('sha256').update(Buffer.from(publicaB64, 'base64')).digest('hex').slice(0, 8)

export function normalizarDatos({ escuela, cct, expira, hwid, plan, notas }) {
    const limpio = v => String(v ?? '').trim().replace(/\s+/g, ' ')
    const datos = {
        id: `LIC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`,
        escuela: limpio(escuela),
        cct: limpio(cct).toUpperCase(),
        expira: limpio(expira),
        hwid: limpio(hwid).toUpperCase(),
        emitida: new Date().toISOString(),
    }
    if (limpio(plan)) datos.plan = limpio(plan)
    if (limpio(notas)) datos.notas = limpio(notas)

    const errores = []
    if (datos.escuela.length < 3) errores.push('Falta el nombre de la escuela.')
    if (!datos.cct) errores.push('Falta la CCT o ID escolar.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.expira) || Number.isNaN(Date.parse(`${datos.expira}T00:00:00Z`))) errores.push('La fecha de expiración debe ser AAAA-MM-DD (por ejemplo 2027-07-31).')
    else if (Date.parse(`${datos.expira}T23:59:59Z`) < Date.now()) errores.push('La fecha de expiración ya pasó.')
    if (datos.hwid.length < 8) errores.push('Falta el ID de hardware (HWID) que muestra la app en la computadora del cliente.')
    return { datos, errores }
}

/** Firma los datos con la clave privada (PEM) y devuelve la licencia completa. */
export function firmarLicencia(datos, privadaPem) {
    const privada = createPrivateKey(privadaPem)
    if (privada.asymmetricKeyType !== 'ed25519') throw new Error('La clave privada no es Ed25519.')
    const carga = b64url(JSON.stringify(datos))
    const firma = b64url(sign(null, mensajeFirmado(carga), privada))
    return { formato: FORMATO, datos, carga, firma, clave: idDeClave(clavePublicaBase64(privada)) }
}

/** Código de una sola línea, para enviarlo por mensaje y pegarlo en la app. */
export const codigoDeLicencia = lic => `${PREFIJO_CODIGO}.${lic.carga}.${lic.firma}`

/** Comprobación del lado del administrador (la app usa su propio validador). */
export function verificarLicencia(lic, publicaB64) {
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicaB64, 'base64')])
    const publica = createPublicKey({ key: spki, format: 'der', type: 'spki' })
    return verify(null, mensajeFirmado(lic.carga), publica, Buffer.from(lic.firma, 'base64url'))
}
