import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkUser() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('email')
        .ilike('email', '%dama%')

    if (error) {
        fs.writeFileSync('output-clean.txt', 'Error fetching profiles: ' + error.message)
    } else {
        let out = ''
        profiles.forEach(p => {
            out += `Email: '${p.email}'\n`
            out += `Length: ${p.email.length}\n`
            out += `Chars: ${p.email.split('').map(c => c.charCodeAt(0)).join(',')}\n`
        })
        fs.writeFileSync('output-clean.txt', out)
    }
}

checkUser()
