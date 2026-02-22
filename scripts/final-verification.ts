import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function check() {
    const { data } = await supabase.from('profiles')
        .select('id, email, first_name, last_name_paternal, role')
        .eq('id', 'ecd127be-a39c-48a9-8661-e50ffb2248fd')
        .single()

    console.log('--- FINAL STATE OF TUTOR ---')
    console.log(JSON.stringify(data, null, 2))
}

check()
