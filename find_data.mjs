
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Read .env file with more robust parsing
const envPath = path.resolve(process.cwd(), '.env')
let envBuffer = fs.readFileSync(envPath)
console.log('File length:', envBuffer.length)
console.log('First 50 bytes (hex):', envBuffer.slice(0, 50).toString('hex'))

let envContent = envBuffer.toString('utf8')
// Detect UTF-16
if (envBuffer[0] === 0xff && envBuffer[1] === 0xfe) {
    console.log('Detected UTF-16LE encoding')
    envContent = envBuffer.toString('utf16le')
}
const lines = envContent.split(/\r?\n/)
lines.forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const parts = trimmed.split('=')
    const key = parts[0].trim()
    const value = parts.slice(1).join('=').trim()
    if (key) {
        env[key] = value
    }
})

console.log('Available env keys:', Object.keys(env))

const supabaseUrl = env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars in .env file')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findData() {
    // Common tables where a teacher would have data
    const tables = ['groups', 'academic_years', 'students', 'group_subjects', 'schedule_settings']
    const results = {}

    console.log('Searching for data in tables...')
    for (const table of tables) {
        try {
            const { data, error } = await supabase.from(table).select('tenant_id').limit(100)
            if (error) {
                console.log(`Error reading table ${table}: ${error.message}`)
                continue
            }
            if (data && data.length > 0) {
                data.forEach(row => {
                    results[row.tenant_id] = (results[row.tenant_id] || 0) + 1
                })
            }
        } catch (e) {
            console.log(`Table ${table} not accessible.`)
        }
    }

    console.log('\n--- TENANTS WITH DATA ---')
    if (Object.keys(results).length === 0) {
        console.log('No data found in checked tables.')
    }

    for (const [tid, count] of Object.entries(results)) {
        const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tid).maybeSingle()
        console.log(`Tenant: ${tenant?.name || 'Unknown'} (${tenant?.type || 'N/A'}, ID: ${tid}) has ${count} sample records.`)
    }

    // Also check the user's current profile
    const { data: profiles } = await supabase.from('profiles').select('*').limit(10)
    console.log('\n--- SAMPLE PROFILES ---')
    profiles?.forEach(p => {
        console.log(`User: ${p.full_name} | Role: ${p.role} | TenantID: ${p.tenant_id}`)
    })
}

findData()
