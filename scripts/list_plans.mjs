import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function listPlans() {
    const { data, error } = await supabase
        .from('lesson_plans')
        .select('id, title, group_id, subject_id')
        .limit(10)

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log(`Found ${data.length} plans.`)
    data.forEach(p => console.log(JSON.stringify(p)))
}

listPlans()
