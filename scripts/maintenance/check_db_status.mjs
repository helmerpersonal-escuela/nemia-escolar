
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTable() {
    console.log('--- DB STATUS DIAGNOSTIC (ANON) ---')
    console.log('Target:', supabaseUrl)

    const { data: pt, error: ptError } = await supabase
        .from('profile_tenants')
        .select('*')
        .limit(1)

    if (ptError) {
        console.error('profile_tenants query failed:')
        console.error('  Code:', ptError.code)
        console.error('  Message:', ptError.message)
        console.error('  Status:', ptError.status)
    } else {
        console.log('profile_tenants query SUCCEEDED. Data:', pt)
    }

    const { data: pr, error: prError } = await supabase
        .from('profile_roles')
        .select('*')
        .limit(1)

    if (prError) {
        console.error('profile_roles query failed:', prError.message)
    } else {
        console.log('profile_roles query SUCCEEDED.')
    }

    const { data: p, error: pError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)

    if (pError) {
        console.error('profiles query failed:', pError.message)
    } else {
        console.log('profiles query SUCCEEDED.')
    }
}

checkTable()
