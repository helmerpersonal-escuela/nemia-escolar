
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'
const supabaseKey = 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    console.log('--- Checking lesson_plans schema ---')
    const { data, error } = await supabase.from('lesson_plans').select('*').limit(1)

    if (error) {
        if (error.code === '42P01') {
            console.log('Table lesson_plans does not exist.')
        } else {
            console.error('Error fetching from lesson_plans:', error)
        }
    } else {
        console.log('Table lesson_plans exists.')
        if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]))
        } else {
            console.log('Table exists but is empty.')
            const testColumns = [
                'id', 'tenant_id', 'group_id', 'subject_id', 'period_id', 'title',
                'temporality', 'start_date', 'end_date', 'campo_formativo',
                'metodologia', 'problem_context', 'objectives', 'contents',
                'pda', 'ejes_articuladores', 'activities_sequence', 'resources',
                'evaluation_plan', 'status'
            ]
            for (const col of testColumns) {
                const { error: colError } = await supabase.from('lesson_plans').select(col).limit(1)
                if (colError) {
                    console.log(`Column ${col} NOT found`)
                } else {
                    console.log(`Column ${col} exists.`)
                }
            }
        }
    }
}

checkSchema()
