
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error, count } = await supabase
        .from('analytical_programs')
        .select('*', { count: 'exact', head: true })

    if (error) {
        console.error('Error:', error)
    } else {
        console.log('Count:', count)
    }
}

check()
