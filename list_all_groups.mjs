import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function listGroups() {
    const { data: groups, error } = await supabase.from('groups').select('id, name, section, tenant_id')

    if (groups) {
        console.log('TOTAL_GROUPS:' + groups.length)
        groups.forEach(g => console.log(`GRP: ${g.id} | ${g.name || ''} | ${g.section || ''} | ${g.tenant_id}`));
    } else {
        console.error('Error listing groups:', error);
    }
}

listGroups()
