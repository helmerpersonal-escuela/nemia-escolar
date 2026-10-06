#!/usr/bin/env node
// Generador de licencias de VUNLEK (herramienta del administrador; no forma parte de la app).
//
//   node tools/licencias/generar-licencia.mjs
//        → pregunta los datos uno por uno
//   node tools/licencias/generar-licencia.mjs --escuela "Escuela Secundaria Técnica 37" --cct 07DST0037X \
//        --expira 2027-07-31 --hwid PC-ABCDE-FGHJK-MNPQR-STVWX
//
// Opcionales: --plan "Anual"  --notas "Factura 123"  --clave <ruta de clave-privada.pem>  --salida <carpeta>
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { clavePublicaBase64, codigoDeLicencia, firmarLicencia, normalizarDatos, verificarLicencia } from './formato.mjs'
import { createPrivateKey } from 'node:crypto'

const args = process.argv.slice(2)
const valor = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const rutaClave = resolve(valor('--clave') ?? join(homedir(), '.vunlek-licencias', 'clave-privada.pem'))

if (!existsSync(rutaClave)) {
    console.error(`✖ No encontré la clave privada en:\n    ${rutaClave}\n  Créala una vez con:  node tools/licencias/generar-claves.mjs\n  o indica dónde está con  --clave <ruta>`)
    process.exit(1)
}
const privadaPem = readFileSync(rutaClave, 'utf8')

const campos = { escuela: valor('--escuela'), cct: valor('--cct'), expira: valor('--expira'), hwid: valor('--hwid'), plan: valor('--plan'), notas: valor('--notas') }
const faltan = ['escuela', 'cct', 'expira', 'hwid'].filter(c => !campos[c])
if (faltan.length) {
    if (!process.stdin.isTTY) { console.error(`✖ Faltan datos: ${faltan.map(f => `--${f}`).join(', ')}`); process.exit(1) }
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const preguntas = {
        escuela: 'Nombre de la escuela: ',
        cct: 'CCT o ID escolar: ',
        expira: 'Fecha de expiración (AAAA-MM-DD): ',
        hwid: 'ID de hardware (HWID) que muestra la app del cliente: ',
    }
    for (const c of faltan) campos[c] = await rl.question(preguntas[c])
    rl.close()
}

const { datos, errores } = normalizarDatos(campos)
if (errores.length) { console.error(`✖ No se generó la licencia:\n${errores.map(e => `   · ${e}`).join('\n')}`); process.exit(1) }

const licencia = firmarLicencia(datos, privadaPem)
// Comprobación inmediata con la clave pública: si esto falla, no se entrega nada
if (!verificarLicencia(licencia, clavePublicaBase64(createPrivateKey(privadaPem)))) {
    console.error('✖ La licencia recién firmada no pasó la verificación. No se guardó.')
    process.exit(1)
}

const salida = resolve(valor('--salida') ?? join(dirname(rutaClave), 'emitidas'))
mkdirSync(salida, { recursive: true })
const nombre = `${datos.cct}_${datos.expira}_${datos.id}.vunlek-licencia.json`.replace(/[^\w.\-]/g, '_')
const archivo = join(salida, nombre)
writeFileSync(archivo, `${JSON.stringify(licencia, null, 2)}\n`)

// Bitácora de lo emitido (para saber a quién se le dio qué y cuándo vence)
const bitacora = join(salida, 'emitidas.csv')
const celda = v => `"${String(v ?? '').replace(/"/g, '""')}"`
if (!existsSync(bitacora)) appendFileSync(bitacora, 'id,emitida,escuela,cct,expira,hwid,plan,notas,archivo\n')
appendFileSync(bitacora, [datos.id, datos.emitida, datos.escuela, datos.cct, datos.expira, datos.hwid, datos.plan, datos.notas, nombre].map(celda).join(',') + '\n')

console.log('✔ Licencia generada.\n')
console.log(`  Escuela:   ${datos.escuela}`)
console.log(`  CCT / ID:  ${datos.cct}`)
console.log(`  Expira:    ${datos.expira}`)
console.log(`  Equipo:    ${datos.hwid}`)
console.log(`  Folio:     ${datos.id}  (firmada con la clave ${licencia.clave})\n`)
console.log(`  Archivo para entregar:\n    ${archivo}\n`)
console.log(`  O este código de una línea (para pegar en la app):\n\n${codigoDeLicencia(licencia)}\n`)
