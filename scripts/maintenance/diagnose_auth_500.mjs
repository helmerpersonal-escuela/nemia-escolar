
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseAnonKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function diagnose() {
    console.log('--- AUTH DIAGNOSTIC ---')

    // Check working user
    const { data: working, error: err1 } = await supabase.auth.signInWithPassword({
        email: 'usuario@prueba.com',
        password: '123456'
    })

    if (err1) {
        console.error('Working user failed now too:', err1.message)
    } else {
        console.log('Working user OK. ID:', working.user.id)
    }

    // Check seeded user
    const { error: err2 } = await supabase.auth.signInWithPassword({
        email: 'test@nemia.com',
        password: 'nemia123'
    })

    if (err2) {
        console.error('Seeded user failed with:', err2.message)
    } else {
        console.log('Seeded user OK!')
    }

    // Attempt to register a NEW demo user via API to see if it fixes it
    const newDemoEmail = 'demo.' + Math.random().toString(36).substring(7) + '@nemia.com'
    console.log(`\nAttempting to register new user via API: ${newDemoEmail}`)
    const { data: reg, error: regErr } = await supabase.auth.signUp({
        email: newDemoEmail,
        password: 'Password123!',
        options: {
            data: { firstName: 'Demo', role: 'INDEPENDENT_TEACHER' }
        }
    })

    if (regErr) {
        console.error('Registration via API failed:', regErr.message)
    } else {
        console.log('Registration via API SUCCEEDED! User ID:', reg.user?.id)
    }
}

diagnose()
