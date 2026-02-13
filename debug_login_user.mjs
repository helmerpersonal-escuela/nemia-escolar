
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkUser() {
    console.log('--- USER SEARCH DIAGNOSTIC ---')

    // Search by name or common patterns
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .or('full_name.ilike.%test%,first_name.ilike.%test%')

    if (error) {
        console.error('Error searching profiles:', error.message)
    } else {
        console.log('Profiles matching "test":', profiles)
    }

    // Also just list some users to see what's there
    const { data: allProfiles, error: allErr } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .limit(10)

    if (allErr) {
        console.error('Error listing profiles:', allErr.message)
    } else {
        console.log('Top 10 profiles:', allProfiles)
    }
}

checkUser()
