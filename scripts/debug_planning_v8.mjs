
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://aveqziaewxcglhteufft.supabase.co";
const supabaseAnonKey = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc';
    const results = {};

    // 1. List all plans for this group
    const { data: plans, error: plansError } = await supabase
        .from('lesson_plans')
        .select('*, subject_catalog(name)')
        .eq('group_id', groupId);
    results.plans = plans || [];
    results.plansError = plansError;

    // 2. List all subjects for this group
    const { data: subjects, error: subjectsError } = await supabase
        .from('group_subjects')
        .select('*, subject_catalog(name)')
        .eq('group_id', groupId);
    results.subjects = subjects || [];
    results.subjectsError = subjectsError;

    // 3. List evaluation periods
    const { data: periods, error: periodsError } = await supabase
        .from('evaluation_periods')
        .select('*');
    results.periods = periods || [];

    fs.writeFileSync('debug_output_v8.json', JSON.stringify(results, null, 2));
    console.log('Results written to debug_output_v8.json');
}
inspect();
