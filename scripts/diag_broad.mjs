import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: 'c:/SistemaGestionEscolar/.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnostic() {
    try {
        console.log('--- Database Audit ---')

        // 1. Check groups count
        const { count: groupCount } = await supabase.from('groups').select('*', { count: 'exact', head: true })
        console.log('Total Groups:', groupCount)

        // 2. Check lesson_plans count
        const { count: planCount } = await supabase.from('lesson_plans').select('*', { count: 'exact', head: true })
        console.log('Total Lesson Plans:', planCount)

        // 3. Get recent plans
        const { data: recentPlans } = await supabase
            .from('lesson_plans')
            .select('id, title, group_id, subject_id, period_id')
            .order('created_at', { ascending: false })
            .limit(5)

        console.log('\nRecent Lesson Plans:')
        console.table(recentPlans)

        // 4. Verify specific group
        const targetGroup = '5c444b42-4db3-43a4-bac6-5f0922ecdacc'
        const { data: groupData } = await supabase.from('groups').select('id, name').eq('id', targetGroup).maybeSingle()
        console.log(`\nTarget Group (${targetGroup}):`, groupData || 'NOT FOUND')

    } catch (e) {
        console.error('Diagnostic error:', e)
    }
}

diagnostic()
