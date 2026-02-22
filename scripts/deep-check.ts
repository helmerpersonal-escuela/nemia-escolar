import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function check() {
    console.log('--- BUSQUEDA GENERAL DE PERFILES ---')
    const { data: all } = await supabase.from('profiles').select('id, email, first_name, last_name, role')
    console.log(JSON.stringify(all, null, 2))

    console.log('\n--- BUSQUEDA EN GUARDIANS ---')
    const { data: guardians } = await supabase.from('guardians').select('*')
    console.log(JSON.stringify(guardians, null, 2))
}

check()
