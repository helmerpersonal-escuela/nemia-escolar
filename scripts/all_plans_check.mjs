
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://aveqziaewxcglhteufft.supabase.co";
const supabaseAnonKey = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const results = {};

    // 1. Get all lesson plans (limit to see if any exist)
    const { data: allPlans, error: plansError } = await supabase
        .from('lesson_plans')
        .select('id, title, subject_id, group_id, tenant_id')
        .limit(20);
    results.allPlans = allPlans || [];
    results.plansError = plansError;

    // 2. Count null subjects
    const { count: nullCount } = await supabase
        .from('lesson_plans')
        .select('*', { count: 'exact', head: true })
        .is('subject_id', null);
    results.nullCount = nullCount;

    // 3. Count total plans
    const { count: totalCount } = await supabase
        .from('lesson_plans')
        .select('*', { count: 'exact', head: true });
    results.totalCount = totalCount;

    fs.writeFileSync('all_plans_check.json', JSON.stringify(results, null, 2));
    console.log('Results written to all_plans_check.json');
}
inspect();
