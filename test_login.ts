import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'damahel2017@gmail.com',
        password: '455004'
    })

    if (error) {
        console.error('Login Failed:', error.message)
    } else {
        console.log('Login Succeeded!')
        console.log('User:', data.user?.email)
    }
}

testLogin()
