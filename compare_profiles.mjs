
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function compare() {
    console.log('--- COMPARING AUTH RECORDS ---')

    // Check if we can read profiles (which might show info)
    const { data: p1 } = await supabase.from('profiles').select('*').eq('full_name', 'Usuario Prueba').single()
    const { data: p2 } = await supabase.from('profiles').select('*').eq('full_name', 'Profesor Test NEMIA').single()

    console.log('Profile Working:', p1?.id)
    console.log('Profile Seeded:', p2?.id)

    // Note: Can't query auth.users directly with anon key usually.
    // I'll skip this and use a SQL script via write_to_file to inspect.
}

compare()
