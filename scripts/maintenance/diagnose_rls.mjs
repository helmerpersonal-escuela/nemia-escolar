
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Hopefully this exists in the environment

if (!supabaseUrl || !supabaseServiceKey) {
    console.log('Error: Missing environment variables (VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPolicies() {
    console.log('--- RLS Policies for chat_rooms ---')
    const { data, error } = await supabase.rpc('check_policies_rpc', { tname: 'chat_rooms' })

    if (error) {
        // If RPC doesn't exist, try raw query if service key allows (usually it doesn't allow raw pg_catalog via REST)
        console.log('RPC check_policies_rpc failed. Trying to query via REST if possible...')
        const { data: policies, error: polError } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'chat_rooms')

        if (polError) {
            console.error('Could not fetch policies via REST:', polError)
        } else {
            console.log('Policies found:', policies)
        }
    } else {
        console.log('Policies from RPC:', data)
    }
}

checkPolicies()
