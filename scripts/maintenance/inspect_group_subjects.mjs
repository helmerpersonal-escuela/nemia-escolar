
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectGroups() {
    console.log('--- INSPECTING group_subjects columns ---')
    // We try to get columns by just trying to select something that likely doesn't exist to get an error with column names, OR just select * if it has one row.
    // If it has no rows, we can't get columns via Select * easily with Anon.
    // But maybe we can guess.

    const { data, error } = await supabase.from('group_subjects').select('*').limit(1)
    if (error) {
        console.log('Error:', error.message)
    } else {
        console.log('Columns:', Object.keys(data[0] || {}))
    }
}

inspectGroups()
