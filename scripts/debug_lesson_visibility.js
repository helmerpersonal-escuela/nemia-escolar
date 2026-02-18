
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- Fetching Lesson Plans for Debugging ---');

    // 1. Fetch recent lesson plans with raw references
    const { data: plans, error: plansError } = await supabase
        .from('lesson_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (plansError) {
        console.error('Plans Error:', plansError);
        return;
    }

    console.log(`Found ${plans.length} recent plans.`);

    // 2. Fetch groups, evaluation_periods, and subject_catalog to match IDs
    const { data: groups } = await supabase.from('groups').select('id, grade, section');
    const { data: periods } = await supabase.from('evaluation_periods').select('id, name');
    const { data: subjects } = await supabase.from('subject_catalog').select('id, name');

    const debugInfo = {
        recent_plans: plans.map(p => {
            const group = groups?.find(g => g.id === p.group_id);
            const period = periods?.find(pr => pr.id === p.period_id);
            const subject = subjects?.find(s => s.id === p.subject_id);
            return {
                ...p,
                group_name: group ? `${group.grade}° ${group.section}` : 'N/A',
                period_name: period ? period.name : 'N/A',
                subject_name: subject ? subject.name : 'N/A'
            };
        }),
        all_groups: groups,
        all_periods: periods,
        all_subjects: subjects?.filter(s => s.name.toUpperCase().includes('ESPAÑOL'))
    };

    fs.writeFileSync('lesson_plans_debug_full.json', JSON.stringify(debugInfo, null, 2));
    console.log('Debug info written to lesson_plans_debug_full.json');
}

run()
