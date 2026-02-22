import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function check() {
    console.log('--- Iniciando diagnóstico ---')
    const results: any = {}

    // 1. Helmerferras .com
    const { data: p1 } = await supabase.from('profiles').select('*').eq('email', 'helmerferras@gmail.com')
    results['helmerferras@gmail.com'] = p1

    // 2. Helmerferras .co
    const { data: p2 } = await supabase.from('profiles').select('*').eq('email', 'helmerferras@gmail.co')
    results['helmerferras@gmail.co'] = p2

    // 3. Daniela
    const { data: p3 } = await supabase.from('profiles').select('*').ilike('first_name', '%DANIELA%')
    results['DANIELA profiles'] = p3

    // 4. Counts by role
    const { data: roles } = await supabase.from('profiles').select('role')
    const counts: any = {}
    roles?.forEach(r => counts[r.role] = (counts[r.role] || 0) + 1)
    results['counts_by_role'] = counts

    fs.writeFileSync('diagnostic_output.json', JSON.stringify(results, null, 2))
    console.log('✅ Diagnóstico guardado en diagnostic_output.json')
}

check()
