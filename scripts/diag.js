const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: 'c:/SistemaGestionEscolar/.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey })
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnostic() {
    try {
        const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc'
        const { data, error } = await supabase
            .from('lesson_plans')
            .select('id, title, subject_id, period_id')
            .eq('group_id', groupId)

        if (error) throw error
        console.log('Plans found:', data)
    } catch (e) {
        console.error('Diagnostic error:', e)
    }
}

diagnostic()
