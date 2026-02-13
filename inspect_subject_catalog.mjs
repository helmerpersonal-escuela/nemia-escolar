
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectColumns() {
    console.log('--- INSPECTING subject_catalog ---')
    const { data, error } = await supabase.from('subject_catalog').select('*').limit(1)
    if (error) {
        console.error('Error:', error.message)
    } else {
        console.log('Columns:', Object.keys(data[0] || {}))
        console.log('Sample Data:', data[0])
    }
}

inspectColumns()
