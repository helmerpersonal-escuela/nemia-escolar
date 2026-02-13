
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function diagnose() {
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, tenant_id, role')

    if (pError) {
        console.error('Error fetching profiles:', pError)
        return
    }

    console.log('--- PROFILES ---')
    for (const profile of profiles) {
        const { data: tenant } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', profile.tenant_id)
            .single()

        const { data: roles } = await supabase
            .from('profile_roles')
            .select('role')
            .eq('profile_id', profile.id)

        console.log(`User: ${profile.full_name} (${profile.id})`)
        console.log(`  Active Role: ${profile.role}`)
        console.log(`  Current Tenant: ${tenant?.name} (Type: ${tenant?.type}, ID: ${profile.tenant_id})`)
        console.log(`  Available Roles: ${roles?.map(r => r.role).join(', ')}`)
        console.log('----------------')
    }

    const { data: allTenants } = await supabase.from('tenants').select('*')
    console.log('\n--- ALL TENANTS ---')
    allTenants?.forEach(t => {
        console.log(`- ${t.name} (${t.type}, ID: ${t.id})`)
    })
}

diagnose()
