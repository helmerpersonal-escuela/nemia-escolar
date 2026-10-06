#!/usr/bin/env node
// Borra la ESCUELA DE PRUEBA y todo lo que se creó con ella. No toca escuelas ni cuentas reales.
//
//   npm run demo:borrar                  → solo muestra qué se borraría
//   npm run demo:borrar -- --confirmar   → lo borra
//
// CANDADO: solo corre con NODE_ENV=development (ver exigirDesarrollo en comun.mjs).
import { existsSync, unlinkSync } from 'node:fs'
import { ARCHIVO_CREDENCIALES, conectar, cuentasDemo, exigirDesarrollo, fallar, faltaMigracion } from './comun.mjs'

exigirDesarrollo('borrar la escuela de prueba')
const confirmar = process.argv.includes('--confirmar')
const db = conectar()

const { data: runs, error } = await db.from('demo_runs').select('id, tenant_id, user_ids, summary, created_at')
if (error) fallar(faltaMigracion(error)
    ? 'Falta aplicar en Supabase la migración supabase/migrations/20261017100000_escuela_de_prueba.sql'
    : `No se pudo consultar la base de datos: ${error.message}`)
const anotadas = new Set(runs.flatMap(r => r.user_ids))
const sueltas = (await cuentasDemo(db)).filter(u => !anotadas.has(u.id))

if (!runs.length && !sueltas.length) {
    console.log('\n✔ No hay escuela de prueba ni cuentas de demostración. No hay nada que borrar.\n')
    process.exit(0)
}

console.log('\nSe borraría:')
for (const r of runs) {
    const { count: alumnos } = await db.from('students').select('id', { count: 'exact', head: true }).eq('tenant_id', r.tenant_id)
    console.log(`  · ${r.summary?.school ?? 'Escuela de prueba'} (creada el ${new Date(r.created_at).toLocaleDateString('es-MX')}): ${alumnos ?? 0} alumnos, ${r.user_ids.length} cuentas y todo su contenido`)
}
if (sueltas.length) console.log(`  · ${sueltas.length} cuentas de demostración sueltas (@demo.vunlek.test), de un intento anterior`)
console.log('  Nada más: las escuelas y cuentas reales no se tocan.')

if (!confirmar) {
    console.log('\nEsto fue solo una vista previa. Para borrar de verdad:\n\n    npm run demo:borrar -- --confirmar\n')
    process.exit(0)
}

// 1. La escuela y todo lo que cuelga de ella, en una sola operación (o se borra todo, o no se borra nada)
if (runs.length) {
    const { data: res, error: ePurge } = await db.rpc('demo_purge')
    if (ePurge) fallar(faltaMigracion(ePurge)
        ? 'Falta activar el borrado: ejecuta en Supabase (SQL Editor) el archivo\n  supabase/migrations/20261017110000_borrar_escuela_de_prueba.sql  y vuelve a intentarlo.'
        : `No se borró nada: ${ePurge.message}`)
    const filas = Object.values(res.rows ?? {}).reduce((a, b) => a + Number(b), 0)
    console.log(`\n✔ Escuela de prueba borrada: ${filas} registros en ${Object.keys(res.rows ?? {}).length} tablas y ${res.users} cuentas. Registros sobrantes: ${res.leftover}.`)
}

// 2. Cuentas de demostración que hubieran quedado sueltas (por ejemplo, de un intento que falló a medias)
let quitadas = 0
for (const u of await cuentasDemo(db)) {
    const { error: e } = await db.auth.admin.deleteUser(u.id)
    if (e) console.error(`  ✖ No se pudo quitar ${u.email}: ${e.message}`)
    else quitadas++
}
if (quitadas) console.log(`✔ ${quitadas} cuentas de demostración sueltas eliminadas.`)

if (existsSync(ARCHIVO_CREDENCIALES)) { unlinkSync(ARCHIVO_CREDENCIALES); console.log('✔ Se eliminó demo_credentials.md.') }
console.log('\nListo: no queda ningún dato de prueba.\n')
