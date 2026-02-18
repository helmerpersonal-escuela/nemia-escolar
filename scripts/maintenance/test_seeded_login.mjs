
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSeededUser() {
    console.log(`--- CHECKING test@nemia.com / nemia123 ---`)
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@nemia.com',
        password: 'nemia123'
    })

    if (error) {
        console.error('Login Failed:', error.message)
    } else {
        console.log('Login SUCCEEDED for test@nemia.com!')
    }
}

checkSeededUser()
