
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testRpc() {
    console.log('Testing exec_sql RPC...')
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1 as test' })

    if (error) {
        console.error('RPC failed:', error.message)
    } else {
        console.log('RPC SUCCEEDED!', data)
    }
}

testRpc()
