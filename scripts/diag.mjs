import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: 'c:/SistemaGestionEscolar/.env' })

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
            .select('id, title, subject_id, period_id, campo_formativo')
            .eq('group_id', groupId)

        if (error) throw error
        console.log('Plans found for group:', groupId)
        console.table(data)

        // Check group_subjects
        const { data: gs } = await supabase
            .from('group_subjects')
            .select('id, subject_catalog_id, custom_name')
            .eq('group_id', groupId)

        console.log('\nGroup Subjects:')
        console.table(gs)

    } catch (e) {
        console.error('Diagnostic error:', e)
    }
}

diagnostic()
