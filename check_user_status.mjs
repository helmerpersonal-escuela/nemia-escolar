
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkNewUser() {
    const email = 'usuario@prueba.com'
    const password = '123456'

    console.log(`--- CHECKING ${email} ---`)

    // 1. Try to login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (loginError) {
        console.error('Login Failed:', loginError.message)
    } else {
        console.log('Login SUCCEEDED!')
        console.log('User ID:', loginData.user.id)

        // 2. Check profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', loginData.user.id)
            .single()

        if (profileError) {
            console.error('Profile not found:', profileError.message)
        } else {
            console.log('Profile found:', profile)
        }
    }
}

checkNewUser()
