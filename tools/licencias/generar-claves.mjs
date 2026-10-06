#!/usr/bin/env node
// Genera, UNA sola vez, el par de claves Ed25519 de las licencias de VUNLEK.
//
//   node tools/licencias/generar-claves.mjs            → crea las claves en la carpeta del usuario
//   node tools/licencias/generar-claves.mjs --instalar → además pega la clave pública en la app
//   node tools/licencias/generar-claves.mjs --carpeta "E:\\claves-vunlek"
//
// La clave PRIVADA es lo único que permite emitir licencias: guárdala fuera del repositorio,
// con copia en una memoria USB, y no la envíes por correo ni por mensaje.
import { createPrivateKey, generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clavePublicaBase64, idDeClave } from './formato.mjs'

const args = process.argv.slice(2)
const valor = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const carpeta = resolve(valor('--carpeta') ?? join(homedir(), '.vunlek-licencias'))
const rutaPrivada = join(carpeta, 'clave-privada.pem')
const rutaPublica = join(carpeta, 'clave-publica.txt')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const archivoApp = join(repo, 'src', 'lib', 'offlineLicenseKey.ts')

if (carpeta.startsWith(repo)) {
    console.error('✖ Elige una carpeta FUERA del repositorio: la clave privada no debe subirse a GitHub.')
    process.exit(1)
}
function instalarEnApp(publicaB64) {
    if (!existsSync(archivoApp)) { console.error(`✖ No encontré ${archivoApp}; pega la clave pública a mano.`); process.exit(1) }
    const texto = readFileSync(archivoApp, 'utf8')
    const marca = '    // <claves-publicas>'
    if (texto.includes(`'${publicaB64}'`)) { console.log('✔ La clave pública ya estaba instalada en la app.'); return }
    if (!texto.includes(marca)) { console.error('✖ El archivo de la app no tiene la marca <claves-publicas>; pega la clave a mano.'); process.exit(1) }
    writeFileSync(archivoApp, texto.replace(marca, `${marca}\n    '${publicaB64}',`))
    console.log('✔ Clave pública instalada en src/lib/offlineLicenseKey.ts (sube ese cambio con git).')
}

if (existsSync(rutaPrivada)) {
    if (args.includes('--instalar')) {
        // Las claves ya existen: solo se copia la pública a la app
        instalarEnApp(clavePublicaBase64(createPrivateKey(readFileSync(rutaPrivada, 'utf8'))))
        process.exit(0)
    }
    console.error(`✖ Ya existe una clave privada en:\n    ${rutaPrivada}\n` +
        '  No se reemplaza: con otra clave, la app dejaría de aceptar las licencias que ya entregaste.\n' +
        '  Para copiar su clave pública a la app usa:  node tools/licencias/generar-claves.mjs --instalar')
    process.exit(1)
}

const { privateKey } = generateKeyPairSync('ed25519')
const publicaB64 = clavePublicaBase64(privateKey)
mkdirSync(carpeta, { recursive: true })
writeFileSync(rutaPrivada, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
writeFileSync(rutaPublica, `${publicaB64}\n`)

console.log('✔ Claves creadas.\n')
console.log(`  Clave PRIVADA (secreta): ${rutaPrivada}`)
console.log(`  Clave pública:           ${rutaPublica}`)
console.log(`  Identificador:           ${idDeClave(publicaB64)}\n`)
console.log(`  Clave pública (va dentro de la app):\n\n    ${publicaB64}\n`)

if (args.includes('--instalar')) instalarEnApp(publicaB64)
else console.log('  Para instalarla en la app:  node tools/licencias/generar-claves.mjs --instalar')
console.log('\n  Haz ahora una copia de la carpeta en una memoria USB y guárdala en un lugar seguro.')
