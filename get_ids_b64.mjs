import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getIds() {
    const userId = '85870a47-4730-401d-a96c-a3712e821b3d'
    const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc'

    const { data: userData } = await supabase.from('profiles').select('tenant_id').eq('id', userId).single()
    const { data: groupData } = await supabase.from('groups').select('tenant_id').eq('id', groupId).single()

    console.log('USER_TENANT_B64:' + Buffer.from(userData.tenant_id).toString('base64'))
    console.log('GROUP_TENANT_B64:' + Buffer.from(groupData.tenant_id).toString('base64'))
}

getIds()
