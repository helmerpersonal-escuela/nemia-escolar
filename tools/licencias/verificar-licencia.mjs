#!/usr/bin/env node
// Revisa un archivo de licencia con la clave pública (útil antes de entregarlo o para soporte).
//   node tools/licencias/verificar-licencia.mjs <archivo.vunlek-licencia.json> [--publica <clave-publica.txt>]
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { verificarLicencia } from './formato.mjs'

const args = process.argv.slice(2)
const i = args.indexOf('--publica')
const rutaPublica = resolve(i >= 0 ? args[i + 1] : join(homedir(), '.vunlek-licencias', 'clave-publica.txt'))
const archivo = args.find((a, n) => !a.startsWith('--') && n !== i + 1)
if (!archivo || !existsSync(archivo)) { console.error('✖ Indica el archivo de licencia a revisar.'); process.exit(1) }
if (!existsSync(rutaPublica)) { console.error(`✖ No encontré la clave pública en ${rutaPublica}`); process.exit(1) }

const lic = JSON.parse(readFileSync(archivo, 'utf8'))
const publica = readFileSync(rutaPublica, 'utf8').trim()
const firmaOk = verificarLicencia(lic, publica)
const datos = firmaOk ? JSON.parse(Buffer.from(lic.carga, 'base64url').toString('utf8')) : null
const igual = datos && JSON.stringify(datos) === JSON.stringify(lic.datos)
const vencida = datos && Date.parse(`${datos.expira}T23:59:59`) < Date.now()

if (!firmaOk) { console.error('✖ FIRMA INVÁLIDA: el archivo fue alterado o no se firmó con tu clave.'); process.exit(2) }
if (!igual) { console.error('✖ Los datos visibles no coinciden con los firmados (archivo alterado).'); process.exit(2) }
console.log(`✔ Firma válida.\n  ${datos.escuela} · ${datos.cct}\n  Equipo ${datos.hwid}\n  Expira ${datos.expira}${vencida ? '  ← YA VENCIÓ' : ''}`)
process.exit(vencida ? 3 : 0)
