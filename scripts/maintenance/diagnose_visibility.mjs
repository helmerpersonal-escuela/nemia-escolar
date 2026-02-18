
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function diagnostic() {
    console.log('--- DATA VISIBILITY DIAGNOSTIC ---')

    // 1. Current User
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        console.log('No user logged in.')
        return
    }
    console.log('Logged User:', user.email, `(${user.id})`)

    // 2. Current Profile Tenant
    const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single()
    console.log('Current Active Tenant ID:', profile?.tenant_id)

    // 3. Count Programs
    const { count: progCountAll } = await supabase.from('analytical_programs').select('*', { count: 'exact', head: true })
    const { count: progCountTenant } = await supabase.from('analytical_programs').select('*', { count: 'exact', head: true }).eq('tenant_id', profile?.tenant_id)
    console.log('Analytical Programs - Total:', progCountAll, '| Current Tenant:', progCountTenant)

    // 4. Count Plans
    const { count: planCountAll } = await supabase.from('lesson_plans').select('*', { count: 'exact', head: true })
    const { count: planCountTenant } = await supabase.from('lesson_plans').select('*', { count: 'exact', head: true }).eq('tenant_id', profile?.tenant_id)
    console.log('Lesson Plans - Total:', planCountAll, '| Current Tenant:', planCountTenant)

    // 5. If discrepant, show tenant_ids of existing data
    if (progCountAll > 0) {
        const { data: progs } = await supabase.from('analytical_programs').select('tenant_id, school_data').limit(5)
        console.log('Sample Programs Tenant IDs:', progs?.map(p => p.tenant_id))
    }
    if (planCountAll > 0) {
        const { data: plans } = await supabase.from('lesson_plans').select('tenant_id, title').limit(5)
        console.log('Sample Plans Tenant IDs:', plans?.map(p => p.tenant_id))
    }
}

diagnostic()
