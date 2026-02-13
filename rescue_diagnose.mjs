
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function diagnose() {
    console.log('--- DIAGNOSING helmerferras@gmail.com ---')

    // 1. Find the profile
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%HELMER%') // Searching by name since I don't have directly linked email usually, or if email is in profile

    if (pError) {
        console.error('Error fetching profiles:', pError)
        return
    }

    if (!profiles || profiles.length === 0) {
        console.log('No profiles found with "Helmer" in name.')
        // Try to find if there's any profile with a tenant that looks like a school vs independent
    }

    for (const profile of profiles) {
        console.log(`\n Profile Found: ${profile.full_name} (${profile.id})`)
        console.log(`  Current Role: ${profile.role}`)
        console.log(`  Current Tenant ID: ${profile.tenant_id}`)

        // Get Tenant
        const { data: tenant } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).single()
        console.log(`  Current Tenant Name: ${tenant?.name} (Type: ${tenant?.type})`)

        // Check for other tenants in profile_tenants if it exists
        try {
            const { data: pt } = await supabase.from('profile_tenants').select('*, tenants(*)').eq('profile_id', profile.id)
            if (pt && pt.length > 0) {
                console.log('  Workspaces in profile_tenants:')
                pt.forEach(link => {
                    console.log(`    - ${link.tenants.name} (${link.tenants.type}, Role: ${link.role})`)
                })
            } else {
                console.log('  No entries in profile_tenants.')
            }
        } catch (e) {
            console.log('  profile_tenants table might not exist yet.')
        }

        // Check for data presence in other tables using this tenant_id
        const tables = ['groups', 'academic_years', 'group_subjects', 'students']
        console.log('  Data Check (Current Tenant):')
        for (const table of tables) {
            const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id)
            console.log(`    - ${table}: ${count} records`)
        }

        // Check if there are ANY other tenants that might belong to this user (not linked)
        // This is hard without being able to run raw SQL for "ALL tenants" easily if RLS is on 
        // but service role should see all.
    }

    console.log('\n--- ALL TENANTS IN DB ---')
    const { data: allTenants } = await supabase.from('tenants').select('*')
    allTenants?.forEach(t => {
        console.log(`ID: ${t.id} | Name: ${t.name} | Type: ${t.type} | Created: ${t.created_at}`)
    })
}

diagnose()
