
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://aveqziaewxcglhteufft.supabase.co";
const supabaseAnonKey = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J";

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc';

async function inspect() {
    const results = {};

    // 1. Get Group Subjects
    const { data: gs } = await supabase
        .from('group_subjects')
        .select('*, subject_catalog(name)')
        .eq('group_id', groupId);
    results.groupSubjects = gs || [];

    // 2. Get Lesson Plans for this group
    const { data: plans } = await supabase
        .from('lesson_plans')
        .select('*')
        .eq('group_id', groupId);
    results.plans = plans || [];

    // 3. Get Periods
    const { data: periods } = await supabase
        .from('evaluation_periods')
        .select('*')
        .order('start_date');
    results.periods = periods || [];

    fs.writeFileSync('debug_output_v5.json', JSON.stringify(results, null, 2));
    console.log('Results written to debug_output_v5.json');
}
inspect();
