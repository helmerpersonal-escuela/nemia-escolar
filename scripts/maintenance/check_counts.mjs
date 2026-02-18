
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkCounts() {
    const tenantId = '77777777-7777-7777-7777-777777777777'
    const tables = ['groups', 'students', 'lesson_plans', 'analytical_programs', 'assignments', 'grades', 'attendance']
    const results = {}

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)

        results[table] = error ? `ERROR: ${error.message}` : count
    }

    console.log(JSON.stringify(results, null, 2))
}

checkCounts()
