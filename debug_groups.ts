import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugGroups() {
    console.log('--- Debugging Dashboard Groups ---')

    // 1. Get Groups
    const { data: groups, error: gError } = await supabase.from('groups').select('*')
    console.log('Groups in DB:', JSON.stringify(groups, null, 2))

    // 2. Get Schedules
    const { data: schedules, error: sError } = await supabase
        .from('schedules')
        .select('*, group:groups(grade, section), subject:subject_catalog(name)')
    console.log('Schedules in DB:', JSON.stringify(schedules, null, 2))

    console.log('--- End of Debug ---')
}

debugGroups()
