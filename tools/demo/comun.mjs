// Lo que comparten los dos scripts de la escuela de prueba: configuración, candado de entorno y conexión.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DOMINIO_DEMO = 'demo.vunlek.test'
export const ARCHIVO_CREDENCIALES = join(RAIZ, 'demo_credentials.md')

/** Lee un archivo KEY=valor sin pisar lo que ya venga en el entorno. */
function cargarEnv(nombre) {
    const ruta = join(RAIZ, nombre)
    if (!existsSync(ruta)) return false
    for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(linea)
        if (!m || linea.trim().startsWith('#')) continue
        const valor = m[2].replace(/^(['"])(.*)\1$/, '$2')
        if (process.env[m[1]] === undefined) process.env[m[1]] = valor
    }
    return true
}

export function fallar(mensaje) {
    console.error(`\n✖ ${mensaje}\n`)
    process.exit(1)
}

/**
 * CANDADO DE ENTORNO. Estos scripts crean y borran datos: solo corren en desarrollo.
 * En producción (NODE_ENV distinto de "development", o dentro de Vercel / un servidor de CI)
 * se detienen antes de conectarse a la base de datos.
 */
export function exigirDesarrollo(accion) {
    const tieneArchivo = cargarEnv('.env.seed')
    if (process.env.NODE_ENV !== 'development') {
        fallar(`BLOQUEADO: "${accion}" solo se permite en desarrollo.\n` +
            `  NODE_ENV vale "${process.env.NODE_ENV ?? '(vacío)'}" y debe ser "development".\n` +
            (tieneArchivo ? '  Revisa la línea NODE_ENV=development de tu archivo .env.seed.'
                : '  Falta el archivo .env.seed en la raíz del proyecto (copia tools/demo/env.seed.ejemplo).'))
    }
    if (process.env.VERCEL || process.env.CI || process.env.NETLIFY) {
        fallar(`BLOQUEADO: "${accion}" no se ejecuta en un servidor de despliegue.`)
    }
}

export function conectar() {
    cargarEnv('.env') // por si la dirección del proyecto ya está ahí
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) fallar('Falta SUPABASE_URL en .env.seed.')
    if (!llave) fallar('Falta SUPABASE_SERVICE_ROLE_KEY en .env.seed (Supabase → Project Settings → API → service_role).')
    return createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** ¿Falta aplicar una migración? (la función o la tabla no existe todavía) */
export const faltaMigracion = e => ['PGRST202', 'PGRST205', '42883', '42P01'].includes(e?.code) || /could not find the (function|table)/i.test(e?.message ?? '')

/** Todas las cuentas de demostración que existan (por el dominio reservado de sus correos). */
export async function cuentasDemo(db) {
    const lista = []
    for (let page = 1; page <= 50; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
        if (error) fallar(`Supabase no pudo listar las cuentas (${error.message}). Revisa SUPABASE_URL y la llave service_role de .env.seed.`)
        lista.push(...data.users.filter(u => (u.email ?? '').toLowerCase().endsWith(`@${DOMINIO_DEMO}`)))
        if (data.users.length < 200) break
    }
    return lista
}
