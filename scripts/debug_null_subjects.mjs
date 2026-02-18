
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://aveqziaewxcglhteufft.supabase.co";
const supabaseAnonKey = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const results = {};

    // Check for any plans with NULL subject_id
    const { count: nullCount } = await supabase
        .from('lesson_plans')
        .select('*', { count: 'exact', head: true })
        .is('subject_id', null);
    results.nullSubjectPlans = nullCount;

    // Check for any plans for the specific group
    const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc';
    const { data: groupPlans } = await supabase
        .from('lesson_plans')
        .select('id, title, subject_id, group_id')
        .eq('group_id', groupId);
    results.groupPlans = groupPlans || [];

    fs.writeFileSync('debug_output_v7.json', JSON.stringify(results, null, 2));
    console.log('Results written to debug_output_v7.json');
}
inspect();
