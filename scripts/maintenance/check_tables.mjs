
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTables() {
    const tables = ['profile_tenants', 'profile_roles', 'special_schedule_structure', 'tenants', 'profiles']
    console.log('--- TABLE EXISTENCE CHECK ---')

    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1)
        if (error) {
            if (error.code === 'PGRST204') {
                console.log(`[MISSING] ${table}`)
            } else {
                console.log(`[ERROR  ] ${table}: ${error.message} (${error.code})`)
            }
        } else {
            console.log(`[EXISTS ] ${table}`)
        }
    }
}

checkTables()
