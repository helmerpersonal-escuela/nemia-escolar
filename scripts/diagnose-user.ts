import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function diagnoseUser(email: string) {
    console.log(`--- Diagnóstico para: ${email} ---`)

    // 1. Check Auth Users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) {
        console.error('Error fetching auth users:', authError)
    } else {
        const authUser = users.find(u => u.email === email)
        if (authUser) {
            console.log('✅ Usuario encontrado en AUTH.USERS')
            console.log('   ID:', authUser.id)
            console.log('   Metadata:', authUser.user_metadata)
            console.log('   Confirmed:', authUser.email_confirmed_at ? 'SÍ' : 'NO')
        } else {
            console.log('❌ Usuario NO encontrado en AUTH.USERS')
        }
    }

    // 2. Check Profiles table
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle()

    if (profileError) {
        console.error('Error fetching profile:', profileError)
    } else if (profile) {
        console.log('✅ Perfil encontrado en PROFILES')
        console.log('   ID:', profile.id)
        console.log('   Role:', profile.role)
    } else {
        console.log('❌ Perfil NO encontrado en PROFILES')
    }
}

diagnoseUser('helmerferras@gmail.com')
