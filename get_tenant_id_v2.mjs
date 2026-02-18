import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getTenantId() {
    const userId = '85870a47-4730-401d-a96c-a3712e821b3d'
    const { data, error } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', userId)
        .single()

    if (data) {
        console.log('---DATA_START---')
        console.log(JSON.stringify(data))
        console.log('---DATA_END---')
    } else {
        console.error('Error finding tenant:', error);
    }
}

getTenantId()
