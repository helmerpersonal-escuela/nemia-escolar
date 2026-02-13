
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function listTables() {
    const tables = ['profiles', 'tenants', 'groups', 'students', 'subjects', 'subject_catalog', 'profile_subjects', 'group_subjects']
    const results = {}

    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1)
        results[table] = error ? `ERROR: ${error.code} - ${error.message}` : 'EXISTS'
    }

    console.log(JSON.stringify(results, null, 2))
}

listTables()
