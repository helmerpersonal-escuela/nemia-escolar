#!/usr/bin/env node
// Crea una ESCUELA DE PRUEBA completa, con datos ficticios, para probar VUNLEK de inmediato.
//
//   npm run demo:crear
//
// Crea: 1 escuela · 3 ciclos · 6 grupos · 1 directora · 10 docentes · 50 alumnos con calificaciones ·
// 25 madres/padres con cuenta (5 de ellos con 2 o 3 hijos en grados distintos) · 18 planeaciones ·
// 4 programas analíticos (uno por campo formativo). Al final imprime las cuentas para entrar.
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { ARCHIVO_CREDENCIALES, DOMINIO_DEMO, conectar, cuentasDemo, exigirDesarrollo, fallar, faltaMigracion } from './comun.mjs'

exigirDesarrollo('crear la escuela de prueba')
const db = conectar()

// 1. Que no haya ya una escuela de prueba ni cuentas de un intento anterior
const { data: previas, error: ePrevias } = await db.from('demo_runs').select('id')
if (ePrevias) fallar(faltaMigracion(ePrevias)
    ? 'Falta aplicar en Supabase la migración supabase/migrations/20261017100000_escuela_de_prueba.sql'
    : `No se pudo consultar la base de datos: ${ePrevias.message}`)
if (previas.length) fallar('Ya existe una escuela de prueba. Bórrala primero con:  npm run demo:borrar -- --confirmar')
if ((await cuentasDemo(db)).length) fallar('Quedaron cuentas de demostración de un intento anterior. Límpialas con:  npm run demo:borrar -- --confirmar')

// 2. Cuentas de acceso. La contraseña se genera aquí, al azar, en cada ejecución: no está escrita en ningún lado.
const clave = `Demo-${randomBytes(6).toString('base64url')}-${10 + (randomBytes(1)[0] % 90)}`
const dos = n => String(n).padStart(2, '0')
const plan = [
    { kind: 'DIRECTOR', n: 1, email: `demo.direccion@${DOMINIO_DEMO}` },
    ...Array.from({ length: 10 }, (_, i) => ({ kind: 'TEACHER', n: i + 1, email: `demo.profe${dos(i + 1)}@${DOMINIO_DEMO}` })),
    ...Array.from({ length: 25 }, (_, i) => ({ kind: 'TUTOR', n: i + 1, email: `demo.tutor${dos(i + 1)}@${DOMINIO_DEMO}` })),
    { kind: 'STUDENT', n: 1, email: `demo.alumno01@${DOMINIO_DEMO}` },
]

const creadas = []
/** Si algo falla a medias, se quitan las cuentas que este script alcanzó a crear. */
async function deshacer(motivo) {
    console.error(`\n✖ ${motivo}\n  Deshaciendo las ${creadas.length} cuentas creadas…`)
    for (const c of creadas) await db.auth.admin.deleteUser(c.id).catch(() => { })
    process.exit(1)
}

process.stdout.write(`Creando ${plan.length} cuentas de demostración `)
for (const p of plan) {
    const { data, error } = await db.auth.admin.createUser({ email: p.email, password: clave, email_confirm: true, user_metadata: { demo: true } })
    if (error || !data?.user) await deshacer(`No se pudo crear ${p.email}: ${error?.message ?? 'sin respuesta'}`)
    creadas.push({ ...p, id: data.user.id })
    process.stdout.write('.')
}
console.log(' listo')

// 3. La escuela, con todo su contenido, en una sola operación de la base de datos
console.log('Creando la escuela, grupos, alumnos, calificaciones, planeaciones y programas…')
const { data: res, error: eSeed } = await db.rpc('demo_seed', { p_people: creadas.map(({ id, kind, n }) => ({ id, kind, n })) })
if (eSeed) await deshacer(`No se pudo crear la escuela: ${eSeed.message}`)

// 3b. Comisiones, asistencia e incidencias de ejemplo (si falla, la escuela ya quedó creada)
const { error: eExtras } = await db.rpc('demo_extras')
if (eExtras) console.warn(`  Aviso: no se agregaron comisiones ni asistencia de ejemplo (${eExtras.message}).`)

// 4. Resultado y credenciales
const correo = id => creadas.find(c => c.id === id)?.email
const de = kind => res.people.filter(p => p.kind === kind).sort((a, b) => a.n - b.n)
const tutores = de('TUTOR')
const tres = tutores.filter(t => t.children.length === 3)
const dosHijos = tutores.filter(t => t.children.length === 2)
const uno = tutores.filter(t => t.children.length === 1)
const c = res.counts

const L = []
L.push('# Escuela de prueba de VUNLEK (datos ficticios)', '')
L.push(`**${res.school}** · CCT ${res.cct}`, '')
L.push(`Contraseña de TODAS las cuentas de demostración:  \`${clave}\``, '')
L.push(`${c.ciclos} ciclos · ${c.grupos} grupos · ${c.docentes} docentes · ${c.alumnos} alumnos · ${c.tutores} tutores (${c.vinculos} vínculos con alumnos)`)
L.push(`${c.materias_por_grupo} materias asignadas · ${c.actividades} actividades · ${c.calificaciones} calificaciones · ${c.planeaciones} planeaciones · ${c.programas_analiticos} programas analíticos`, '')
L.push('## Para empezar', '')
L.push(`- Dirección:  ${correo(de('DIRECTOR')[0].id)}  (${de('DIRECTOR')[0].name})`)
L.push(`- Docente:    ${correo(de('TEACHER')[0].id)}  (${de('TEACHER')[0].name} · ${de('TEACHER')[0].detail})`)
if (de('STUDENT')[0]) L.push(`- Alumno:     ${correo(de('STUDENT')[0].id)}  (${de('STUDENT')[0].name} · ${de('STUDENT')[0].detail})`)
L.push(`- Tutor con 3 hijos:  ${correo(tres[0].id)}  (${tres[0].name})`)
for (const h of tres[0].children) L.push(`    · ${h}`)
L.push('', '## Tutores con varios hijos (para probar el cambio entre hijos)', '')
for (const t of [...tres, ...dosHijos]) L.push(`- ${correo(t.id)}  ${t.name} → ${t.children.join(' · ')}`)
L.push('', '## Docentes', '')
for (const t of de('TEACHER')) L.push(`- ${correo(t.id)}  ${t.name} · ${t.detail}`)
L.push('', '## Tutores con un hijo', '')
for (const t of uno) L.push(`- ${correo(t.id)}  ${t.name} → ${t.children[0]}`)
L.push('', 'Para borrar todo esto:  npm run demo:borrar -- --confirmar', '')

writeFileSync(ARCHIVO_CREDENCIALES, L.join('\n'))
console.log(`\n${'='.repeat(78)}\n${L.join('\n').replace(/^#+ /gm, '').replace(/[`*]/g, '')}${'='.repeat(78)}`)
console.log(`\n✔ Lista. Las cuentas quedaron también en ${ARCHIVO_CREDENCIALES} (ese archivo no se sube a GitHub).`)
console.log('  Inicia tu servidor local (npm run dev) y entra con cualquiera de ellas.\n')
