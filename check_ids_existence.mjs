import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkExistence() {
    const userId = '85870a47-4730-401d-a96c-a3712e821b3d'
    const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc'

    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('id', userId)
    const { count: groupCount } = await supabase.from('groups').select('*', { count: 'exact', head: true }).eq('id', groupId)

    console.log('USER_COUNT:' + userCount)
    console.log('GROUP_COUNT:' + groupCount)
}

checkExistence()
