import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getGroupTenant() {
    const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc'
    const { data, error } = await supabase
        .from('groups')
        .select('tenant_id')
        .eq('id', groupId)
        .single()

    if (data) {
        console.log('GROUP_TENANT:' + data.tenant_id);
    } else {
        console.error('Error finding group tenant:', error);
    }
}

getGroupTenant()
