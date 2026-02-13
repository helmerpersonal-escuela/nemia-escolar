
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function registerTestUser() {
    const email = 'test@nemia.com'
    const password = 'nemia123'

    console.log(`--- REGISTERING ${email} ---`)

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                firstName: 'Profesor',
                lastNamePaternal: 'Test',
                role: 'INDEPENDENT_TEACHER',
                tenantId: '77777777-7777-7777-7777-777777777777'
            }
        }
    })

    if (error) {
        if (error.message.includes('already registered')) {
            console.log('User already exists. Attempting login check...')
            const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
            if (loginErr) {
                console.error('Login failed even for existing user:', loginErr.message)
            } else {
                console.log('Login SUCCEEDED. The user exists and can log in.')
            }
        } else {
            console.error('Registration failed:', error.message)
        }
    } else {
        console.log('User registered successfully!', data.user?.id)
        if (data.session) {
            console.log('Session created! Login works.')
        } else {
            console.log('Check email for confirmation (if enabled) or run SQL fix to confirm.')
        }
    }
}

registerTestUser()
