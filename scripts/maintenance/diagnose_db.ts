import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnose() {
    console.log('--- Final Diagnostic Report ---')

    // 1. Profiles
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*')
    if (pError) console.error('Error Profiles:', pError.message)
    else console.log('Profiles:', JSON.stringify(profiles, null, 2))

    // 2. Tenants
    const { data: tenants, error: tError } = await supabase.from('tenants').select('*')
    if (tError) console.error('Error Tenants:', tError.message)
    else console.log('Tenants:', JSON.stringify(tenants, null, 2))

    // 3. Groups
    const { data: groups, error: gError } = await supabase.from('groups').select('*')
    if (gError) console.error('Error Groups:', gError.message)
    else console.log('Groups:', groups?.length || 0)

    // 4. Students
    const { data: students, error: sError } = await supabase.from('students').select('*')
    if (sError) console.error('Error Students:', sError.message)
    else console.log('Students:', students?.length || 0)

    // 5. Evidence
    const { data: evidence, error: eError } = await supabase.from('evidence_portfolio').select('*')
    if (eError) console.error('Error Evidence:', eError.message)
    else console.log('Evidence:', evidence?.length || 0)

    console.log('--- End of Report ---')
}

diagnose()
