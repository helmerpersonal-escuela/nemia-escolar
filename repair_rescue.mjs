
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Robust .env reader
function getEnv() {
    const envPath = path.resolve(process.cwd(), '.env')
    let envBuffer = fs.readFileSync(envPath)
    let envContent = envBuffer.toString('utf8').replace(/\0/g, '')

    // Detect UTF-16LE
    if (envBuffer[0] === 0xff && envBuffer[1] === 0xfe) {
        envContent = envBuffer.toString('utf16le')
    }

    const env = {}
    envContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const parts = trimmed.split('=')
        const key = parts[0].trim()
        const value = parts.slice(1).join('=').trim()
        if (key) env[key] = value
    })
    return env
}

async function repair() {
    const env = getEnv()
    const supabaseUrl = env.VITE_SUPABASE_URL
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        console.log('Error: Missing credentials')
        return
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Connected to Supabase. Looking for Helmer\'s data...')

    // 1. Identify all profiles related to "Helmer"
    const { data: profiles } = await supabase.from('profiles').select('*').ilike('full_name', '%Helmer%')

    if (!profiles || profiles.length === 0) {
        console.log('No profiles found for "Helmer"')
        return
    }

    const userProfile = profiles[0]
    console.log(`Found profile: ${userProfile.full_name} (${userProfile.id})`)
    console.log(`Current Tenant: ${userProfile.tenant_id} | Role: ${userProfile.role}`)

    // 2. Scan all tenants to find where the data is
    const { data: allTenants } = await supabase.from('tenants').select('*')
    const tenantCounts = []

    const dataTables = ['groups', 'academic_years', 'students', 'group_subjects', 'schedule_settings']

    for (const tenant of allTenants) {
        let totalRecords = 0
        for (const table of dataTables) {
            const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id)
            totalRecords += (count || 0)
        }
        tenantCounts.push({ ...tenant, totalRecords })
    }

    // Sort by record count
    tenantCounts.sort((a, b) => b.totalRecords - a.totalRecords)

    console.log('\nTenant Audit:')
    tenantCounts.forEach(t => {
        console.log(`- [${t.totalRecords} records] ${t.name} (${t.type}, ID: ${t.id})`)
    })

    const bestTenant = tenantCounts[0]

    if (!bestTenant || bestTenant.totalRecords === 0) {
        console.log('No tenant found with meaningful data.')
        return
    }

    if (bestTenant.id === userProfile.tenant_id && userProfile.role === 'TEACHER') {
        console.log('\nUser is already linked to the best tenant with TEACHER role. No repair needed?')
        // But user says they see "Director" screen. Let's check profile role again.
    }

    // 3. APPLY REPAIR
    console.log(`\n>>> REPAIRING: Linking ${userProfile.full_name} to Tenant ${bestTenant.name} as TEACHER`)

    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            tenant_id: bestTenant.id,
            role: 'TEACHER' // Force TEACHER role to restore teacher dashboard
        })
        .eq('id', userProfile.id)

    if (updateError) {
        console.error('Update error:', updateError.message)
    } else {
        console.log('Profile successfully updated.')

        // Also ensure the tenant type is INDEPENDENT if it's the teacher's workspace
        if (bestTenant.type === 'SCHOOL') {
            await supabase.from('tenants').update({ type: 'INDEPENDENT' }).eq('id', bestTenant.id)
            console.log('Tenant type reverted to INDEPENDENT')
        }

        // Also ensure profile_roles has TEACHER
        await supabase.from('profile_roles').upsert({ profile_id: userProfile.id, role: 'TEACHER' })
        console.log('TEACHER role added to profile_roles')
    }
}

repair()
