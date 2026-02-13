
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function listUsers() {
    console.log('--- DETAILED PROFILES LIST ---')
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, tenant_id')
        .limit(20)

    if (error) {
        console.error('Error:', error.message)
    } else {
        console.log(JSON.stringify(data, null, 2))
    }
}

listUsers()
