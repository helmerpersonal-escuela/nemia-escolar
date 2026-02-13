
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkGodModeGroups() {
    console.log('Checking for groups with tenant_id = 00000000-0000-0000-0000-000000000000')

    const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .eq('tenant_id', '00000000-0000-0000-0000-000000000000')

    if (groupsError) {
        console.error('Groups Query Error:', groupsError)
    } else {
        console.log(`Groups found: ${groups.length}`)
        if (groups.length > 0) {
            console.log('Groups:', JSON.stringify(groups, null, 2))
        }
    }
}

checkGodModeGroups()
