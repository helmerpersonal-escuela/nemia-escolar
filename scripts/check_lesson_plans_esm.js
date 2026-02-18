
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('Fetching recent lesson plans...');
    const { data, error } = await supabase
        .from('lesson_plans')
        .select(`
            id,
            title,
            group_id,
            subject_id,
            period_id,
            created_at,
            groups (name),
            evaluation_periods (name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Recent Lesson Plans summary:', data.map(lp => ({
        id: lp.id,
        title: lp.title,
        group: lp.groups?.name,
        period: lp.evaluation_periods?.name,
        subject_id: lp.subject_id
    })));

    fs.writeFileSync('recent_lesson_plans_debug.json', JSON.stringify(data, null, 2));
}

run()
