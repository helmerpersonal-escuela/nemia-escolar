import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function check() {
    console.log('--- Buscando helmerferras ---')
    const { data: profiles } = await supabase.from('profiles').select('*').ilike('email', '%helmerferras%')
    console.log('Profiles found:', profiles)

    console.log('\n--- Buscando DANIELA ---')
    const { data: daniela } = await supabase.from('profiles').select('*').ilike('first_name', '%DANIELA%')
    console.log('Daniela found:', daniela)

    console.log('\n--- Buscando todos los Tutores ---')
    const { data: tutors } = await supabase.from('profiles').select('*').eq('role', 'TUTOR')
    console.log('Tutors found:', tutors)
}

check()
