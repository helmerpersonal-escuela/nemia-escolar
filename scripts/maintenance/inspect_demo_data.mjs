
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectAll() {
    console.log('--- SCANNING ALL TENANTS FOR DATA ---')

    // 1. List all tenants
    const { data: tenants } = await supabase.from('tenants').select('id, name')

    if (!tenants || tenants.length === 0) {
        console.log('No tenants found.')
        return
    }

    for (const t of tenants) {
        const { count: g } = await supabase.from('groups').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id)
        const { count: s } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id)

        console.log(`[${t.id}] ${t.name}: Groups=${g}, Students=${s}`)
    }

    console.log('\n--- GLOBAL CHECKS ---')
    const { count: totalGroups } = await supabase.from('groups').select('*', { count: 'exact', head: true })
    const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true })
    console.log(`Total Groups in DB: ${totalGroups}`)
    console.log(`Total Students in DB: ${totalStudents}`)
}

inspectAll()
